import {
    execFileSync,
    spawn,
} from "node:child_process";
import { seoDt } from "../code/utils";
import {
    BINARY_PATH,
    BIND_IP,
    CONF_PATH,
    DATADIR,
    LOCK_FILE,
    PORT,
    SERVICE_CHECK_RETRIES,
    SERVICE_CHECK_SLEEP,
} from "./constants";

const
    needsSudo = process.getuid !== undefined
        && process.getuid() !== 0,

    run = (cmd: string, ...args: string[]) =>
        execFileSync(
            needsSudo ? `sudo` : cmd,
            needsSudo ? [cmd, ...args] : args,
            { stdio: `inherit` }
        ),

    execRoot = (cmd: string, args: string[], opts?: any): Buffer =>
        execFileSync(
            needsSudo ? `sudo` : cmd,
            needsSudo ? [cmd, ...args] : args,
            opts
        ) as unknown as Buffer,

    sleepSync = (seconds: number) =>
        execFileSync(`sleep`, [String(seconds)], { stdio: `ignore` }),

    rootFileExists = (path: string): boolean => {
        try {
            execRoot(`test`, [`-f`, path], { stdio: `ignore` });
            return true;
        } catch { return false; };
    },

    readRootFile = (path: string): string | undefined => {
        try {
            const buf = execRoot(`cat`, [path]);
            return buf.toString(`utf-8`);
        } catch { return undefined; };
    },

    writeRootFile = (path: string, content: string): void => {
        execRoot(`tee`, [path], { input: content, stdio: [`pipe`, `ignore`, `inherit`] });
    },

    appendRootFile = (path: string, content: string): void => {
        execRoot(`tee`, [`-a`, path], { input: content, stdio: [`pipe`, `ignore`, `inherit`] });
    },

    acquireLock = (): boolean => {
        try {
            if (rootFileExists(LOCK_FILE)) {
                const content = readRootFile(LOCK_FILE);
                if (content) {
                    const pidStr = content.trim(),
                        pid = parseInt(pidStr, 10);
                    if (!isNaN(pid)) {
                        try {
                            process.kill(pid, 0);
                            return false;
                        } catch {};
                    };
                };
            };
        } catch {};
        run(`rm`, `-f`, LOCK_FILE);
        try {
            writeRootFile(LOCK_FILE, `${process.pid}\n`);
            return true;
        } catch (e) {
            console.error(
                seoDt(),
                `acquireLock failed`,
                e instanceof Error ? e.message : String(e)
            );
            return false;
        };
    },
    releaseLock = (): void => {
        try { run(`rm`, `-f`, LOCK_FILE) } catch {};
    },
    serviceCheck = (
        seedPhrase?: string,
        port: number = PORT,
    ): boolean => {
        const
            resolvedSeed = seedPhrase !== undefined && seedPhrase.trim() === ``
                ? undefined
                : seedPhrase,

            args = [
                `--http-bind-ip`, BIND_IP,
                `--http-bind-port`, String(port),
            ],
            env: Record<string, string | undefined> = {
                ...process.env,
                PHOENIX_DATADIR: DATADIR,
            };

        if (resolvedSeed) {
            env.PHOENIX_SEED = resolvedSeed;
        };

        const
            proc = spawn(
                needsSudo ? `sudo` : BINARY_PATH,
                needsSudo ? [BINARY_PATH, ...args] : args,
                { env, stdio: `ignore` },
            );

        proc.on(`error`, (e) => {
            console.error(seoDt(), `serviceCheck spawn error`, e.message);
        });

        const found = (() => {
            for (let i = 0; i < SERVICE_CHECK_RETRIES; i++) {
                if (rootFileExists(CONF_PATH)) {
                    const content = readRootFile(CONF_PATH);
                    if (content && content.trim()) return true;
                };
                sleepSync(SERVICE_CHECK_SLEEP);
            };
            return false;
        })();

        if (!found) {
            console.error(
                seoDt(),
                `serviceCheck timed out waiting for ${CONF_PATH}`
            );
        };

        try { proc.kill() } catch {};
        sleepSync(2);
        return found;
    };

export {
    run,
    execRoot,
    rootFileExists,
    readRootFile,
    writeRootFile,
    appendRootFile,
    acquireLock,
    releaseLock,
    serviceCheck,
};
