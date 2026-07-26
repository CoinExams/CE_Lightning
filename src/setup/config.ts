import {
    PhoenixConfig,
} from "../code/types";
import { seoDt } from "../code/utils";
import {
    CONF_PATH,
    OUTPUT_FILE,
    PORT,
} from "./constants";
import {
    readRootFile,
    writeRootFile,
    run,
} from "./utils";

const
    readConfigValue = (lines: string[], key: string): string | undefined => {
        const re = new RegExp(`^${key}\\s*=\\s*(.+)$`);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(`#`)) continue;
            const match = trimmed.match(re);
            if (!match) continue;
            const value = match[1].trim();
            const commentIdx = value.search(/\s+#/);
            return commentIdx >= 0
                ? value.slice(0, commentIdx).trim()
                : value;
        };
    },
    readPhoenixConfig = (): PhoenixConfig | undefined => {
        try {
            const confContent = readRootFile(CONF_PATH);
            if (!confContent) return;
            const
                lines = confContent.split(`\n`),
                password = readConfigValue(lines, `http-password`),
                portStr = readConfigValue(lines, `http-bind-port`);
            if (!password) return;
            const port = portStr
                ? parseInt(portStr, 10)
                : PORT;
            if (isNaN(port)) return;
            return { port, password };
        } catch (e) {
            console.error(
                seoDt(),
                `readPhoenixConfig failed`,
                e instanceof Error ? e.message : String(e)
            );
        };
    },
    saveCredentials = (): boolean => {
        try {
            const confContent = readRootFile(CONF_PATH);
            if (!confContent) return false;

            const
                lines = confContent.split(`\n`),
                password = readConfigValue(lines, `http-password`),
                portStr = readConfigValue(lines, `http-bind-port`);
            if (!password) return false;
            const port = portStr
                ? parseInt(portStr, 10)
                : PORT;

            writeRootFile(
                OUTPUT_FILE,
                JSON.stringify({ password, port: isNaN(port) ? PORT : port })
            );
            run(`chmod`, `600`, OUTPUT_FILE);
            return true;
        } catch (e) {
            console.error(
                seoDt(),
                `saveCredentials failed`,
                e instanceof Error ? e.message : String(e)
            );
            return false;
        };
    };

export {
    readPhoenixConfig,
    saveCredentials,
};
