import { NostrEvent } from "nostr-tools";
declare const 
/** Default list of Nostr relay URLs used for zap publishing. */
RELAYS_LIST: string[], isLightningAddress: RegExp, tN: () => number, seoDt: () => string, delayCode: (ms: number) => Promise<unknown>, 
/** Convert millisatoshis to satoshis. Returns 0 on invalid input. */
msatToSat: (msat: number | string | bigint) => number, 
/** Parse a Nostr event from JSON string or base64-encoded JSON. */
parseNostrEvent: (nostr: string) => NostrEvent | undefined, 
/** Extract relay URLs from a Nostr event's `relays` tag. */
eventRelays: (event: NostrEvent) => string[], 
/**
 * Convert a public key in hex, npub, or nprofile format to a hex string.
 * Accepts:
 * - 64-character hex string (0-9a-fA-F)
 * - bech32 npub1... key
 * - bech32 nprofile1... (extracts the embedded pubkey)
 * Returns empty string on failure.
 */
npubToHex: (npub: string) => string, 
/** Convert an nsec to a hex private key string. Returns empty string on failure. */
nsecToHex: (nsec: string) => string, 
/** Convert a hex string to Uint8Array. Returns undefined on failure. */
hexToBytes: (hex: string) => Uint8Array | undefined, 
/** Convert an nsec to Uint8Array. Returns undefined on failure. */
nsecToBytes: (nsec: string) => Uint8Array | undefined;
export { RELAYS_LIST, isLightningAddress, tN, seoDt, delayCode, msatToSat, parseNostrEvent, eventRelays, npubToHex, nsecToHex, hexToBytes, nsecToBytes, };
