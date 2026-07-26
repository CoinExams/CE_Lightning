import { realpathSync } from "node:fs";
import { ensurePhoenixd } from "./index";

declare const __VERSION__: string;

const
    USAGE = `Usage: npx @coinexams/lightning setup [--seed <phrase>] [--port <number>]`,

    BIP39_WORD_COUNTS = new Set([12, 15, 18, 21, 24]),

    BIP39_REGEX = /^[a-z]+( [a-z]+)+$/,

    celightningCli = (argv: string[]): void => {
        const
            subcmd = argv[2] || ``,
            rawArgs = argv.slice(3),
            sepIdx = rawArgs.indexOf(`--`),
            args = sepIdx !== -1
                ? rawArgs.slice(0, sepIdx)
                : rawArgs;

        if (subcmd === `--help` || subcmd === `-h` || subcmd === `help`) {
            console.log(USAGE);
            process.exit(0);
        };

        if (subcmd === `--version` || subcmd === `-v`) {
            console.log(__VERSION__);
            process.exit(0);
        };

        if (subcmd !== `setup`) {
            console.log(USAGE);
            process.exit(subcmd ? 1 : 0);
        };

        if (args.includes(`--help`) || args.includes(`-h`)) {
            console.log(USAGE);
            process.exit(0);
        };

        const
            seedIdx = args.indexOf(`--seed`) !== -1
                ? args.indexOf(`--seed`)
                : args.indexOf(`-s`),
            seedPhrase = seedIdx !== -1 && seedIdx + 1 < args.length
                ? args[seedIdx + 1]
                : undefined,
            portIdx = args.indexOf(`--port`) !== -1
                ? args.indexOf(`--port`)
                : args.indexOf(`-p`),
            portStr = portIdx !== -1 && portIdx + 1 < args.length
                ? args[portIdx + 1]
                : undefined,
            port = portStr !== undefined ? Number(portStr) : undefined;

        if (port !== undefined && (isNaN(port) || port < 1 || !Number.isInteger(port))) {
            console.error(`Invalid port: must be a positive integer`);
            process.exit(1);
        };

        if (seedPhrase !== undefined) {
            const trimmed = seedPhrase.trim();
            if (!trimmed) {
                console.error(`Invalid seed: must be a non-empty BIP39 seed phrase`);
                process.exit(1);
            };
            const words = trimmed.split(/\s+/);
            if (!BIP39_REGEX.test(trimmed) || !BIP39_WORD_COUNTS.has(words.length)) {
                console.error(
                    `Invalid seed: must be a BIP39 seed phrase `
                    + `with 12, 15, 18, 21, or 24 words`
                );
                process.exit(1);
            };
        };

        const config = ensurePhoenixd(
            (seedPhrase !== undefined || port !== undefined)
                ? { seedPhrase, port }
                : undefined
        );

        if (config) {
            console.log(`Phoenixd ready on port ${config.port}`);
            process.exit(0);
        } else {
            console.error(`Phoenixd setup failed — see logs above`);
            process.exit(1);
        };
    };

export { celightningCli };

const isMain = process.argv[1] !== undefined
    && (() => {
        try { return realpathSync(process.argv[1]) === __filename }
        catch { return false };
    })();
if (isMain)
    celightningCli(process.argv);
