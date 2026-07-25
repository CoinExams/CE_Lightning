## CoinExams Lightning Payment SDK - Change Log

## v1.0.5

- **New exports `npubToHex`, `nsecToHex`, `hexToBytes`, `nsecToBytes`** — Nostr key format conversion utilities added to `utils.ts`.
  - `npubToHex(npub)` — converts npub/nprofile bech32 to hex pubkey.
  - `nsecToHex(nsec)` — converts nsec bech32 to hex private key.
  - `nsecToBytes(nsec)` — converts nsec bech32 directly to `Uint8Array` (for `serverPrvKeyBytes`).
  - `hexToBytes(hex)` — converts hex string to `Uint8Array`.

## v1.0.4

- **`payRequest` now takes a full LNURL address** — renamed `user` to `lnAddress` (e.g. `"alice@example.com"`); the `domain` parameter is no longer needed.
- **`startLightning` params simplified** — `domain` removed; `port`, `defaultRelays`, and `cacheDurationMs` now have defaults (`port: 9740`, `defaultRelays: RELAYS_LIST`, `cacheDurationMs: 500`).
- **New export `RELAYS_LIST`** — a preset list of 11 Nostr relay URLs, also used as the default for `startLightning`.

## v1.0.2

- **Simplified `payInvoice` API** — removed `onChain`/`lightningAddress`/`onChainAddress` in favor of a single required `address` field. Address format (lightning or on-chain) is auto-detected.
- **Updated `payment.ts`** — `sendPayment` takes `address: string` instead of an options object.