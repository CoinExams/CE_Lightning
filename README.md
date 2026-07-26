# @coinexams/lightning

Lightning Network client wrapping a [Phoenixd](https://phoenix.acinq.co/) node REST API. Create invoices, send payments, query balances, handle LNURL-pay requests, and publish Nostr Zap receipts.

## Change Log

See [changes.md](changes.md).

## Quick Start

1. Install Phoenixd using [installation script](#phoenixd-setup) below

2. Install package

```bash
yarn add @coinexams/lightning
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

## Phoenixd Setup

Run this on a root-access server to install and configure Phoenixd as a systemd service:

```bash
#!/bin/bash
# ssh root@IP 'bash -s' < ./server/phoenix/setup.sh

SEED=""    # Leave empty to generate a new wallet, or paste your 12 words

# --- CONFIGURATION ---
PHOENIX_VERSION="0.7.1"
PORT="9740"
BIND_IP="127.0.0.1"
DATADIR="/root/.phoenix"
OUTPUT_FILE="$DATADIR/credentials.json"
INSTALL_DIR="/opt/phoenix-setup"

mkdir -p "$INSTALL_DIR" "$DATADIR"
cd "$INSTALL_DIR"

saveCredentials() {
    if [ -f "$OUTPUT_FILE" ]; then return; fi
    API_PASSWORD=$(grep "^http-password=" "$DATADIR/phoenix.conf" | cut -d'=' -f2 | tr -d '[:space:]')
    jq -n --arg pw "$API_PASSWORD" --arg port "$PORT" \
      '{password: $pw, port: $port}' > "$OUTPUT_FILE"
    chmod 600 "$OUTPUT_FILE"
}

# --- CHECK EXISTING ---
if [ -f "$INSTALL_DIR/phoenixd" ]; then
    systemctl enable --now phoenixd
    saveCredentials
    exit 0
fi

# --- DEPENDENCIES ---
apt-get update && apt-get install -y wget unzip curl jq

# --- DOWNLOAD ---
wget -q "https://github.com/ACINQ/phoenixd/releases/download/v$PHOENIX_VERSION/phoenixd-$PHOENIX_VERSION-linux-x64.zip"
unzip -o "phoenixd-$PHOENIX_VERSION-linux-x64.zip"
find . -name "phoenixd" -exec mv {} "$INSTALL_DIR/phoenixd" \;
chmod +x "$INSTALL_DIR/phoenixd"

# --- INITIALIZE ---
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

# --- SYSTEMD SERVICE ---
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

# --- START & SAVE CREDENTIALS ---
systemctl daemon-reload
systemctl enable --now phoenixd
saveCredentials
```

## Architecture

```
src/
├── index.ts       # Public barrel exports
└── code/
    ├── client.ts  # startLightning() factory → LightningClient
    ├── types.ts   # All type definitions
    └── utils.ts   # Helpers (regex, timers, Nostr key conversion)
```