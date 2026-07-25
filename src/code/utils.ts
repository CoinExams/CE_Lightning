import { bech32 } from 'bech32';
import { NostrEvent, nip19, utils } from "nostr-tools";

const
    RELAYS_LIST = [
        "wss://thecitadel.nostr1.com",
        "wss://relay.primal.net",
        "wss://relay.noswhere.com",
        "wss://relay.momostr.pink",
        "wss://relay.fountain.fm",
        "wss://relay.damus.io",
        "wss://relay.bitcoinpark.com",
        "wss://purplepag.es",
        "wss://nostr.wine",
        "wss://nostr.stakey.net",
        "wss://nos.lol"
    ],
    lightningAddressRegex = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
    tN = () => Date.now(),
    seoDt = () => new Date().toISOString(),
    delayCode = (ms: number) => new Promise(r => setTimeout(r, ms));

const msatToSat = (msat: number | string | bigint): number => {
    try {
        return Math.round(Number(BigInt(msat) / 1000n));
    } catch {
        return 0;
    }
};

const parseNostrEvent = (nostr: string): NostrEvent | undefined => {
    try {
        const decoded = nostr?.includes(`{`) ? nostr
            : Buffer.from(nostr, `base64`).toString(`utf-8`);
        return JSON.parse(decoded);
    } catch (e) {
        console.error(seoDt(), `parseNostrEvent failed`, e);
    };
};

const eventRelays = (event: NostrEvent): string[] => {
    try {
        return event
            ?.tags
            ?.find(t => t?.[0] == `relays`)
            ?.slice(1, 10)
            ?.map(r =>
                r.lastIndexOf(`/`) == (r.length - 1) ?
                    r.slice(0, r.length - 1)
                    : r
            ) || [];
    } catch (e) {
        console.error(seoDt(), `eventRelays failed`, e);
    };
    return [];
};

const
    isValidHexPubkey = /^[0-9a-fA-F]{64}$/,
    isValidPubKey = /^(npub1|nprofile1)[0-9a-z]{57,1024}$/i,
    /** @returns HEX pubkey */
    npubToHex = (npub: string): string => {
        try {

            if (!npub) return ``

            // if hex
            if (isValidHexPubkey.test(npub))
                return npub

            // if not pub key 
            if (!isValidPubKey.test(npub))
                return ``

            // convert to hex
            const
                { prefix, words } = bech32.decode(npub, 90),
                data = bech32.fromWords(words);

            if (prefix == `npub`)
                return Buffer.from(data).toString(`hex`);

            if (prefix === 'nprofile') {
                let pointer = 0;
                while (pointer < data.length) {
                    const
                        type = data[pointer],
                        length = data[pointer + 1],
                        value = data.slice(pointer + 2, pointer + 2 + length);
                    if (type === 0)
                        return Buffer.from(value).toString('hex');
                    pointer += 2 + length;
                };
            };
        } catch (e) {
            console.log(`hexPubKey failed`, e);
        };
        return ``;
    },
    nsecToHex = (nsec: string): string => {
        try {
            const { type, data } = nip19.decode(nsec);
            if (type == `nsec`)
                return Buffer.from(data).toString('hex');
        } catch (e) {
            console.log(`nsecToHex failed`, e);
        };
        return ``
    },
    hexToBytes = (hex: string): Uint8Array | undefined => {
        try {
            return utils.hexToBytes(hex.padStart(64, '0'));
        } catch (e) {
            console.log(`hexToBytes failed`, e);
        };
    },
    nsecToBytes = (nsec: string): Uint8Array | undefined => {
        return hexToBytes(nsecToHex(nsec))
    };

export {
    RELAYS_LIST,
    lightningAddressRegex,
    tN,
    seoDt,
    delayCode,
    msatToSat,
    parseNostrEvent,
    eventRelays,
    npubToHex,
    nsecToHex,
    hexToBytes,
    nsecToBytes,
};
