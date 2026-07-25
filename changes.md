## CoinExams Lightning Payment SDK - Change Log

## v1.0.2

- **Simplified `payInvoice` API** — removed `onChain`/`lightningAddress`/`onChainAddress` in favor of a single required `address` field. Address format (lightning or on-chain) is auto-detected.
- **Refactored `client.ts` internals** — functions consolidated into a single `const` block; parameters destructured directly; `startLightning` now exported directly.
- **Updated `payment.ts`** — `sendPayment` takes `address: string` instead of an options object.
- **Removed unused `LNBalance` type import**.