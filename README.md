# CoinExams Lightning Payment SDK

A standalone Lightning Network client module that wraps a local Phoenixd node REST API. It provides invoice creation, payment sending, balance queries, LNURL-pay request handling, and Nostr Zap receipt signing/publishing.

## Change Log
[Change Log](changes.md)

## Architecture

```
lightning/
├── README.md
├── index.ts              # Public barrel exports
└── code/
    ├── client.ts         # startLightning() factory → LightningClient
    ├── payment.ts        # Convenience wrappers (optional DI)
    ├── types.ts          # All type definitions
    └── utils.ts          # Helpers (regex, timers, nostr parsing)
```

## Getting Started

### 1. Create a client

```ts
import { startLightning } from "./lightning";

const client = startLightning({
  serverPrvKeyBytes: new Uint8Array(Buffer.from("0123456789ab....", "hex")),
  serverPubKeyHex: "abc123...",
});
```

### 2. Use the client

#### Create an invoice

```ts
const invoice = client.newInvoice({ amountSat: 1000, description: "test" });
// → { invoiceString: "lnbc1...", invoiceId: "abc..." }
```

#### Check payment status

```ts
import { PaymentDirection } from "./lightning";

const payment = client.checkInvoice({
  invoiceId: "abc...",
  type: PaymentDirection.Incoming,
});
// → IncomingPayment | undefined
```

#### Send a payment

```ts
const sent = client.payInvoice({
  amountSat: 500,
  address: "user@example.com",
});
// → { recipientAmountSat: 500, paymentHash: "...", ... }

// On-chain (auto-detected by address format):
const onchain = client.payInvoice({
  amountSat: 10000,
  address: "bc1...",
});
```

#### Query balance or payment history

```ts
const balance = client.nodeQuery({ type: "getbalance" });
// → { balanceSat: 50000, feeCreditSat: 100 }

const incoming = client.nodeQuery({
  type: "payments/incoming",
  params: { limit: 10 },
});
// → IncomingPayment[]
```

#### Handle LNURL-pay (with optional zap)

```ts
const result = client.payRequest({
  lnAddress: "alice@example.com",
  amountMsat: 100000,       // 100 sats
  nostr: "<zap-request-json-or-base64>",  // optional
});
// → { invoice: { pr: "lnbc...", routes: [] }, invoiceId: "..." }
```

#### Zap receipt signing & publishing

```ts
await client.zapPublish({
  nostr: "<zap-request>",
  bolt11: "lnbc...",
  invoiceId: "abc...",
});
// Polls until paid, then signs & publishes a kind-9735 receipt
```

## Convenience Wrappers (optional)

The `payment.ts` file exports stateless function wrappers if you prefer functional style:

```ts
import {
  createInvoice,
  checkPayment,
  sendPayment,
  getBalance,
} from "./lightning";

const invoice = createInvoice({ client, amountSat: 1000 });
const paid = checkPayment({ client, invoiceId, type: PaymentDirection.Incoming });
const sent = sendPayment({ client, amountSat: 500, address: "u@ex.com" });
const bal = getBalance({ client });
```

## Environment Variables (example)

When wiring up from a server entry point:

```env
PHOENIX_SERVER_PORT=9740
ADDRESS_LIGHTNING=bob@example.com
ADDRESS_ONCHAIN=bc1...
SERVER_PRV_KEY=<hex-encoded-key>
SERVER_PUB_KEY=<hex-encoded-pubkey>
ADMIN_USERNAME=admin
SERVER_USERNAME=server
ADMIN_PASSWORD=<admin-pw>
```

## Error Handling

All client methods return `undefined` on failure and log the error via `console.error` with an ISO timestamp prefix. Check for `undefined` to detect failures:

```ts
const invoice = client.newInvoice({ amountSat: 100 });
if (!invoice) {
  // handle error
}
```

## Dependency Setup: Phoenixd

Run this on a root-access server to install and configure Phoenixd as a systemd service:

```bash
#!/bin/bash

# ssh root@IP 'bash -s' < ./server/phoenix/setup.sh

# Leave empty to generate a new wallet or paste your 12 words
SEED=""

# --- 1. CONFIGURATION ---
PHOENIX_VERSION="0.7.1"
PORT="9740"
BIND_IP="127.0.0.1"
DATADIR="/root/.phoenix"
OUTPUT_FILE="$DATADIR/credentials.json"
INSTALL_DIR="/opt/phoenix-setup"

mkdir -p "$INSTALL_DIR" "$DATADIR"
cd "$INSTALL_DIR"

# --- 2. INSTALL DEPENDENCIES ---
apt-get update && apt-get install -y wget unzip curl jq

# --- 3. DOWNLOAD ---
wget -q "https://github.com/ACINQ/phoenixd/releases/download/v$PHOENIX_VERSION/phoenixd-$PHOENIX_VERSION-linux-x64.zip"
unzip -o "phoenixd-$PHOENIX_VERSION-linux-x64.zip"
find . -name "phoenixd" -exec mv {} "$INSTALL_DIR/phoenixd" \;
chmod +x "$INSTALL_DIR/phoenixd"

# --- 4. INITIALIZE ---
echo "Initializing phoenixd..."
export PHOENIX_DATADIR="$DATADIR"

if [ -z "$SEED" ]; then
    "$INSTALL_DIR/phoenixd" > /dev/null 2>&1 &
else
    "$INSTALL_DIR/phoenixd" --seed "$SEED" > /dev/null 2>&1 &
fi

PHOENIX_PID=$!

for i in {1..20}; do
    [ -f "$DATADIR/phoenix.conf" ] && break
    sleep 1
done

kill $PHOENIX_PID 2>/dev/null || true
sleep 2

# --- 5. CREATE SYSTEMD SERVICE ---
cat > /etc/systemd/system/phoenixd.service <<EOF
[Unit]
Description=Phoenixd Lightning Service
After=network.target

[Service]
Environment=PHOENIX_DATADIR=$DATADIR
ExecStart=$INSTALL_DIR/phoenixd --http-bind-ip $BIND_IP --http-bind-port $PORT
User=root
Restart=always
WorkingDirectory=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF

# --- 6. START & SAVE ---
systemctl daemon-reload
systemctl enable --now phoenixd

API_PASSWORD=$(grep "^http-password=" "$DATADIR/phoenix.conf" | cut -d'=' -f2 | tr -d '[:space:]')
jq -n --arg pw "$API_PASSWORD" --arg port "$PORT" \
  '{password: $pw, port: $port}' > "$OUTPUT_FILE"
chmod 600 "$OUTPUT_FILE"
```

After setup, the password and port are saved in `/root/.phoenix/credentials.json` — pass them to `startLightning()`.

## Installation

```bash
npm install @coinexams/lightning
```

## Change Log

See [changes.md](changes.md).