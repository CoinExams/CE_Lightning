import { NostrEvent } from "nostr-tools";

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

export {
    RELAYS_LIST,
    lightningAddressRegex,
    tN,
    seoDt,
    delayCode,
    msatToSat,
    parseNostrEvent,
    eventRelays,
};
