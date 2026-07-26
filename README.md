# @coinexams/lightning

Lightning Network client wrapping a [Phoenixd](https://phoenix.acinq.co/) node REST API. Create invoices, send payments, query balances, handle LNURL-pay requests, and publish Nostr Zap receipts.

## Change Log

See [changes.md](changes.md).

## Quick Start

1. Install package

```bash
yarn add @coinexams/lightning
```

2. Setup phoenixd (requires Linux with systemd)

```bash
npx @coinexams/lightning setup
# Optional: --seed "<12-or-24-word phrase>" --port 9740
```

3. Integrate zap code

```ts
import { startLightning, nsecToBytes, npubToHex } from "@coinexams/lightning";

const client = startLightning({
  serverPrvKeyBytes: nsecToBytes("nsec1..."),
  serverPubKeyHex: npubToHex("npub1..."),
});

// Full zap workflow: request invoice → poll until paid → publish kind-9735 receipt
const zap = client.zapProcess({
  lnAddress: `alice@example.com`,
  amountMsat: 100_000,
  nostrEvent: `<zap-request-json>`,
});
// → { invoice: { pr: "lnbc...", routes: [] }, invoiceId: "..." }
```

## Error Handling

All methods return `undefined` on failure and log via `console.error` with an ISO timestamp prefix.

## Invoices

```ts
// Create an invoice to receive funds
const invoice = client.invoiceNew({ amountSat: 1000, description: "test" });
// → { invoiceString: "lnbc1...", invoiceId: "abc..." }

// Check if it's been paid
import { PaymentDirection } from "@coinexams/lightning";

const payment = client.invoiceStatus({
  invoiceId: "abc...",
  type: PaymentDirection.Incoming,
});
// → IncomingPayment | OutgoingPayment | undefined
```

## Payments

```ts
// Lightning address (auto-detected by address format)
const sent = client.fundsWithdraw({
  amountSat: 500,
  address: "user@example.com",
});
// → { recipientAmountSat: 500, paymentHash: "...", ... }

// On-chain address (auto-detected by address format)
const onchain = client.fundsWithdraw({
  amountSat: 10000,
  address: "bc1...",
});

// Full balance details
const balance = client.fundsBalance();
// → { balanceSat: 50000, feeCreditSat: 100 }

// Incoming payments
const recentIncoming = client.fundsIncoming(10);
// → IncomingPayment[]

// Outgoing payments
const recentOutgoing = client.fundsOutgoing(10);
// → OutgoingPayment[]

// Custom data query (example)
const incoming = client.fundsData({
  type: "payments/incoming",
  params: { limit: 10 },
});
// → IncomingPayment[]
```

## Architecture

```
dist/
├── node/lightning.node.min.js  # Bundled library
└── code/                       # Compiled CLI entry point
src/
├── index.ts           # Public barrel exports
├── code/
│   ├── client.ts      # startLightning() factory → LightningClient
│   ├── types.ts       # All type definitions
│   ├── utils.ts       # Helpers (regex, timers, Nostr key conversion)
│   └── cli.ts         # CLI handler (arg parsing, setup orchestration)
└── setup/
    ├── index.ts       # Phoenixd setup — auto-install, configure, start as systemd service
    ├── config.ts      # Read/write phoenix config + credentials
    ├── constants.ts   # Paths, ports, systemd unit template
    ├── utils.ts       # Sudo wrappers, service check, concurrent lock
    └── version.ts     # Installed version tracking
```