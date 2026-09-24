import { execFileSync } from "node:child_process";
import { readPhoenixConfig } from "./config";
import {
    HEALTH_RETRIES,
    HEALTH_SLEEP,
} from "./constants";
import { sleepSync } from "./utils";
import { updateInline } from "./progress";

const
    /** Wait for phoenixd. */
    waitForPhoenixd = (verbose = false): boolean => {
        for (let i = 0; i < HEALTH_RETRIES; i++) {
            if (verbose)
                updateInline(
                    `Waiting for phoenixd to be ready`
                    + ` (${i + 1}/${HEALTH_RETRIES})...`
                );

            const phoenixConfig = readPhoenixConfig();

            // config required
            if (phoenixConfig) {
                try {
                    execFileSync(`pgrep`, [`-x`, `phoenixd`], { stdio: `ignore` });
                    execFileSync(`curl`, [
                        `-s`,
                        `-f`,
                        `-u`, `:${phoenixConfig.password}`,
                        `http://localhost:${phoenixConfig.port}/getinfo`,
                    ], { stdio: `ignore` });
                    return true;
                } catch { };
            };

            sleepSync(HEALTH_SLEEP);
        };
        return false;
    };

export { waitForPhoenixd };
