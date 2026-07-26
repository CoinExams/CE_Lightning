import { seoDt } from "../code/utils";
import { VERSION_FILE } from "./constants";
import {
    readRootFile,
    rootFileExists,
} from "./utils";

const
    readInstalledVersion = (): string | undefined => {
        if (!rootFileExists(VERSION_FILE)) return;
        try {
            const content = readRootFile(VERSION_FILE);
            if (!content) return;
            const version = content.split(`\n`)[0]?.trim();
            return version || undefined;
        } catch (e) {
            console.error(
                seoDt(),
                `readInstalledVersion failed`,
                e instanceof Error ? e.message : String(e)
            );
        };
    };

export { readInstalledVersion };
