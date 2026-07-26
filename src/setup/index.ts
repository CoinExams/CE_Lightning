import {
    existsSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import {
    PhoenixConfig,
    PhoenixSetupOptions,
} from "../code/types";
import { seoDt } from "../code/utils";
import {
    PHOENIX_VERSION,
    BINARY_PATH,
    VERSION_FILE,
    BACKUP_DIR,
    INSTALL_DIR,
    DATADIR,
    CONF_PATH,
    OUTPUT_FILE,
    buildServiceConfig,
    PORT,
    HEALTH_RETRIES,
    HEALTH_SLEEP,
} from "./constants";
import {
    run,
    execRoot,
    rootFileExists,
    writeRootFile,
    serviceCheck,
    acquireLock,
    releaseLock,
} from "./utils";
import {
    readPhoenixConfig,
    saveCredentials,
} from "./config";
import { readInstalledVersion } from "./version";
import {
    logStep,
    updateInline,
} from "./progress";

const
    semverLt = (a: string, b: string): boolean => {
        const
            pa = a.replace(/^v/i, ``).split(`.`).map(Number),
            pb = b.replace(/^v/i, ``).split(`.`).map(Number);
        for (let i = 0; i < 3; i++) {
            const va = pa[i] ?? 0, vb = pb[i] ?? 0;
            if (isNaN(va) || isNaN(vb)) return false;
            if (va > vb) return false;
            if (va < vb) return true;
        };
        return false;
    },
    ARCH_MAP: Record<string, string> = {
        x64: `x64`,
        arm64: `aarch64`,
    },
    /** Install, configure, and start phoenixd as a systemd service.
     * Downloads the binary from GitHub releases, generates a config
     * via one-shot run, writes a systemd unit, and verifies the API
     * is responding. Side effects include apt-get dependency
     * installation and systemd unit file creation. Returns the
     * PhoenixConfig (port + password) on success, undefined on failure. */
    ensurePhoenixd = ({
        seedPhrase,
        port = PORT,
    }: PhoenixSetupOptions = {}): PhoenixConfig | undefined => {
        try {

            // must run on Linux
            if (process.platform !== `linux`) {
                console.error(
                    seoDt(),
                    `ensurePhoenixd failed`,
                    `only Linux is supported (got ${process.platform})`
                );
                return;
            };

            const
                resolvedSeed = seedPhrase !== undefined && seedPhrase.trim() === ``
                    ? undefined
                    : seedPhrase,

            // check if running + version
                running = (() => {
                    try {
                        execFileSync(`pgrep`, [`-x`, `phoenixd`], { stdio: `ignore` });
                        return true
                    } catch { };
                    return false;
                })(),
                installedVer = readInstalledVersion(),
                needsUpdate = installedVer === undefined
                    || semverLt(installedVer, PHOENIX_VERSION);

            // skip download if installed and up-to-date
            if (!needsUpdate && (running || rootFileExists(BINARY_PATH))) {
                const config = readPhoenixConfig();
                if (config) return config;
            };

            // ensure lock directory exists
            run(`mkdir`, `-p`, INSTALL_DIR);

            // concurrent setup lock
            if (!acquireLock()) {
                console.error(
                    seoDt(),
                    `ensurePhoenixd failed`,
                    `another setup is in progress`
                );
                return;
            };

            try {

                // systemd required
                if (!existsSync(`/run/systemd/system`)) {
                    console.error(
                        seoDt(),
                        `ensurePhoenixd failed`,
                        `systemd not found`
                    );
                    return;
                };

                // backup data before stopping
                if (needsUpdate && rootFileExists(CONF_PATH)) {
                    logStep(`Backing up existing data...`);
                    const backupDir = `${BACKUP_DIR}/phoenix-${Date.now()}`;
                    run(`mkdir`, `-p`, backupDir);
                    run(`cp`, `-r`, `${DATADIR}/.`, backupDir);
                };

                // detect architecture for download URL
                const arch = ARCH_MAP[process.arch];
                if (!arch) {
                    console.error(
                        seoDt(),
                        `ensurePhoenixd failed`,
                        `unsupported architecture: ${process.arch}`
                    );
                    return;
                };

                // download (fresh install or upgrade)
                if (!rootFileExists(BINARY_PATH) || needsUpdate) {
                    logStep(
                        `Downloading phoenixd v${PHOENIX_VERSION}...`
                    );

                    // clean old artifacts to prevent stale binaries
                    execRoot(
                        `bash`,
                        [`-c`, `rm -rf "${INSTALL_DIR}"/phoenixd-* "${INSTALL_DIR}"/*.zip`],
                        { stdio: `inherit` }
                    );

                    // install deps only if missing
                    const deps = [`wget`, `unzip`, `curl`, `jq`],
                        missing = deps.filter(cmd => {
                            try { execFileSync(`which`, [cmd], { stdio: `ignore` }); return false }
                            catch { return true };
                        });
                    if (missing.length) {
                        run(`apt-get`, `update`);
                        run(`apt-get`, `install`, `-y`, ...missing);
                    };

                    // prepare directories
                    run(`mkdir`, `-p`, INSTALL_DIR, DATADIR);

                    const
                        zipFile = `phoenixd-${PHOENIX_VERSION}-linux-${arch}.zip`,
                        extractedDir = `phoenixd-${PHOENIX_VERSION}-linux-${arch}`,
                        zipUrl = `https://github.com/`
                            + `ACINQ/phoenixd/releases/download/`
                            + `v${PHOENIX_VERSION}/${zipFile}`;

                    // download with timeout to prevent hanging
                    execRoot(
                        `wget`,
                        [`-q`, `--timeout=120`, zipUrl],
                        { cwd: INSTALL_DIR, stdio: `inherit` }
                    );
                    execRoot(
                        `unzip`, [`-o`, zipFile],
                        { cwd: INSTALL_DIR, stdio: `inherit` }
                    );
                    execRoot(
                        `mv`,
                        [`${INSTALL_DIR}/${extractedDir}/phoenixd`, BINARY_PATH],
                        { stdio: `inherit` }
                    );

                    // verify binary was extracted
                    if (!rootFileExists(BINARY_PATH)) {
                        console.error(
                            seoDt(),
                            `ensurePhoenixd failed`,
                            `phoenixd binary not found after extraction`
                        );
                        return;
                    };

                    run(`chmod`, `+x`, BINARY_PATH);

                    // verify binary is executable
                    try {
                        execRoot(`test`, [`-x`, BINARY_PATH], { stdio: `ignore` });
                    } catch {
                        console.error(
                            seoDt(),
                            `ensurePhoenixd failed`,
                            `binary is not executable after chmod`
                        );
                        return;
                    };

                };

                // stop old version before upgrading
                if (running) {
                    logStep(`Stopping old phoenixd...`);
                    try {
                        run(`systemctl`, `stop`, `phoenixd`);
                        run(`pkill`, `-x`, `phoenixd`);
                    } catch { };
                };

                // generate config via one-shot run
                logStep(`Generating configuration...`);
                if (!serviceCheck(resolvedSeed, port)) {
                    console.error(
                        seoDt(),
                        `ensurePhoenixd failed`,
                        `phoenixd config not generated`
                    );
                    return;
                };

                // ensure http-bind-port in conf for correct readPhoenixConfig
                execRoot(`bash`, [`-c`,
                    `grep -q '^http-bind-port' ${CONF_PATH}`
                        + `&& sed -i 's/^http-bind-port=.*/http-bind-port=${port}/' ${CONF_PATH}`
                        + `|| echo 'http-bind-port=${port}' >> ${CONF_PATH}`
                ]);

                // write systemd unit file
                writeRootFile(
                    `/etc/systemd/system/phoenixd.service`,
                    buildServiceConfig(port),
                );

                // reload systemd
                run(`systemctl`, `daemon-reload`);

                // start service
                logStep(`Starting phoenixd...`);
                run(`systemctl`, `enable`, `--now`, `phoenixd`);

                // health check - verify phoenixd started and API is ready
                const started = (() => {
                    for (let i = 0; i < HEALTH_RETRIES; i++) {
                        updateInline(
                            `Waiting for phoenixd to be ready`
                            + ` (${i + 1}/${HEALTH_RETRIES})...`
                        );
                        const phxConfig = readPhoenixConfig();
                        try {
                            execFileSync(`pgrep`, [`-x`, `phoenixd`], { stdio: `ignore` });
                            if (phxConfig) execFileSync(`curl`, [`-s`, `-u`, `:${phxConfig.password}`,
                                `http://localhost:${phxConfig.port}/getinfo`
                            ], { stdio: `ignore` });
                            return true;
                        } catch {};
                        execFileSync(`sleep`, [String(HEALTH_SLEEP)], { stdio: `ignore` });
                    };
                    return false;
                })();

                if (!started) {
                    console.error(
                        seoDt(),
                        `ensurePhoenixd failed`,
                        `phoenixd did not start or API not ready`
                    );
                    return;
                };

                // persist version, checksum, credentials and return config
                const instChecksum = execRoot(`sha256sum`, [BINARY_PATH])
                    .toString().split(` `)[0];
                writeRootFile(VERSION_FILE, `${PHOENIX_VERSION}\n${instChecksum}\n`);
                if (!saveCredentials()) {
                    console.warn(
                        seoDt(),
                        `ensurePhoenixd: failed to persist credentials to ${OUTPUT_FILE}`
                    );
                };
                return readPhoenixConfig();
            } finally {
                releaseLock();
            };
        } catch (e) {
            console.error(
                seoDt(),
                `ensurePhoenixd failed`,
                e instanceof Error ? e.message : String(e)
            );
        };
    };

export { ensurePhoenixd };
