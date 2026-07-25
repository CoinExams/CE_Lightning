import { NostrEvent } from "nostr-tools";
declare const RELAYS_LIST: string[], lightningAddressRegex: RegExp, tN: () => number, seoDt: () => string, delayCode: (ms: number) => Promise<unknown>;
declare const msatToSat: (msat: number | string | bigint) => number;
declare const parseNostrEvent: (nostr: string) => NostrEvent | undefined;
declare const eventRelays: (event: NostrEvent) => string[];
export { RELAYS_LIST, lightningAddressRegex, tN, seoDt, delayCode, msatToSat, parseNostrEvent, eventRelays, };
