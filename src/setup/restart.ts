import {
    RestartEvent,
    RestartEventType,
    RestartLog,
    RestartStatus,
} from "../code/types";
import {
    seoDt,
    tN,
} from "../code/utils";
import {
    RESTART_EVENTS_MAX,
    RESTART_LOG_FILE,
    RESTART_MAX,
    RESTART_POLL_MS,
    RESTART_SETTLE_MS,
    RESTART_STALE_MS,
    RESTART_WINDOW_MS,
} from "./constants";
import {
    acquireLock,
    readRootFile,
    releaseLock,
    run,
    sleepSync,
    writeRootFile,
} from "./utils";
import { waitForPhoenixd } from "./health";

const
    /** Coerce number fallback. */
    asNumber = (value: unknown, fallback: number): number =>
        typeof value == `number` && Number.isFinite(value)
            ? value
            : fallback,

    /** Process alive check. */
    pidAlive = (pid: number): boolean => {
        if (!Number.isInteger(pid) || pid <= 0) return false;
        try { process.kill(pid, 0); return true; }
        catch (e) {
            // EPERM means alive
            return (e as NodeJS.ErrnoException)?.code == `EPERM`;
        };
    },

    /** Validate restart event. */
    isRestartEvent = (value: unknown): value is RestartEvent =>
        !!value && typeof value == `object`
        && typeof (value as RestartEvent).time == `number`
        && typeof (value as RestartEvent).pid == `number`
        && typeof (value as RestartEvent).event == `string`,

    /** Normalize persisted events. */
    normalizeEvents = (value: unknown): RestartEvent[] =>
        Array.isArray(value) ? value.filter(isRestartEvent) : [],

    /** Normalize restart log. */
    normalizeRestartLog = (
        raw: Partial<RestartLog>,
    ): RestartLog => ({
        status: raw.status == RestartStatus.Restarting
            ? RestartStatus.Restarting
            : RestartStatus.Idle,
        pid: asNumber(raw.pid, 0),
        startedAt: asNumber(raw.startedAt, 0),
        lastRestartAt: asNumber(raw.lastRestartAt, 0),
        restartCount: asNumber(raw.restartCount, 0),
        windowStart: asNumber(raw.windowStart, tN()),
        events: normalizeEvents(raw.events),
    }),

    /** Restart log defaults. */
    defaultRestartLog = (): RestartLog => normalizeRestartLog({}),

    /** Read restart log. */
    readRestartLog = (): RestartLog => {
        try {
            const raw = readRootFile(RESTART_LOG_FILE);
            return raw
                ? normalizeRestartLog(
                    JSON.parse(raw) as Partial<RestartLog>
                )
                : defaultRestartLog();
        } catch (e) {
            console.error(
                seoDt(),
                `readRestartLog failed`,
                e instanceof Error ? e.message : String(e)
            );
            return defaultRestartLog();
        };
    },

    /** Persist restart log. */
    writeRestartLog = (log: RestartLog): boolean => {
        try {
            const
                tmp = `${RESTART_LOG_FILE}.tmp`,
                payload = JSON.stringify({
                    ...log,
                    events: log.events.slice(-RESTART_EVENTS_MAX),
                });
            writeRootFile(tmp, payload);
            run(`mv`, `-f`, tmp, RESTART_LOG_FILE);
            return true;
        } catch (e) {
            console.error(
                seoDt(),
                `writeRestartLog failed`,
                e instanceof Error ? e.message : String(e)
            );
            return false;
        };
    },

    /** Enforce settle delay. */
    settleAfterRestart = (since: number): void => {
        const remaining = RESTART_SETTLE_MS - (tN() - since);
        if (remaining > 0) sleepSync(remaining / 1000);
    },

    /** Wait out restart. */
    waitOutRestart = (): void => {
        for (;;) {
            const log = readRestartLog();
            if (log.status != RestartStatus.Restarting) return;
            if (log.pid === process.pid) return;
            if (!pidAlive(log.pid)) return;
            if (tN() - log.startedAt >= RESTART_STALE_MS) return;
            sleepSync(RESTART_POLL_MS / 1000);
        };
    },

    /** Append restart event. */
    appendEvent = (log: RestartLog, event: RestartEventType): void => {
        (log.events = log.events || []).push({
            time: tN(),
            pid: process.pid,
            event,
        });
    },

    /** Coordinated phoenixd restart. */
    requestPhoenixRestart = (): boolean | undefined => {
        try {
            const existing = readRestartLog();

            // join peer restart
            if (existing.status == RestartStatus.Restarting
                && existing.pid !== process.pid
                && pidAlive(existing.pid)
                && tN() - existing.startedAt < RESTART_STALE_MS
            ) {
                settleAfterRestart(existing.lastRestartAt);
                waitOutRestart();
                return waitForPhoenixd();
            };

            // lock held, wait
            if (!acquireLock()) {
                settleAfterRestart(existing.lastRestartAt);
                waitOutRestart();
                return waitForPhoenixd();
            };

            let
                claimed = false,
                restartAt = 0;
            try {
                const
                    log = readRestartLog(),
                    time = tN();

                // reset rate-limit window
                if (time - log.windowStart > RESTART_WINDOW_MS) {
                    log.restartCount = 0;
                    log.windowStart = time;
                };

                if (log.restartCount >= RESTART_MAX) {
                    appendEvent(log, RestartEventType.RateLimited);
                    writeRestartLog(log);
                    return;
                };

                // live owner only
                const
                    inProgress = log.status == RestartStatus.Restarting
                        && log.pid !== process.pid
                        && pidAlive(log.pid)
                        && time - log.startedAt < RESTART_STALE_MS,
                    stale = log.status == RestartStatus.Restarting
                        && !inProgress;

                if (inProgress) {
                    appendEvent(log, RestartEventType.Skip);
                    writeRestartLog(log);
                    restartAt = log.lastRestartAt;
                } else {
                    log.status = RestartStatus.Restarting;
                    log.pid = process.pid;
                    log.startedAt = time;
                    log.lastRestartAt = time;
                    log.restartCount += 1;
                    appendEvent(
                        log,
                        stale
                            ? RestartEventType.Override
                            : RestartEventType.Start
                    );
                    if (!writeRestartLog(log)) return;
                    claimed = true;
                    restartAt = time;
                };
            } finally {
                releaseLock();
            };

            // join restarting process
            if (!claimed) {
                settleAfterRestart(restartAt);
                waitOutRestart();
                return waitForPhoenixd();
            };

            let ok = false;
            try {
                run(`systemctl`, `restart`, `phoenixd`);
                ok = true;
            } catch {
                try {
                    run(`pkill`, `-x`, `phoenixd`);
                    run(`systemctl`, `start`, `phoenixd`);
                    ok = true;
                } catch (e) {
                    console.error(
                        seoDt(),
                        `requestPhoenixRestart failed`,
                        e instanceof Error ? e.message : String(e)
                    );
                };
            };

            // enforce settle window
            settleAfterRestart(restartAt);
            const ready = ok && waitForPhoenixd();

            // release restarting marker
            if (acquireLock()) {
                try {
                    const log = readRestartLog();
                    log.status = RestartStatus.Idle;
                    log.pid = 0;
                    appendEvent(
                        log,
                        ready
                            ? RestartEventType.Done
                            : RestartEventType.Failed
                    );
                    if (!writeRestartLog(log))
                        console.error(
                            seoDt(),
                            `requestPhoenixRestart failed`,
                            `could not persist restart marker`
                        );
                } finally {
                    releaseLock();
                };
            };

            return ready;
        } catch (e) {
            console.error(
                seoDt(),
                `requestPhoenixRestart failed`,
                e instanceof Error ? e.message : String(e)
            );
        };
    };

export {
    requestPhoenixRestart,
};
