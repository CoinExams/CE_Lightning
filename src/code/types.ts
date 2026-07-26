import { VerifiedEvent } from "nostr-tools";

interface PhoenixConfig {
    port: number;
    password: string;
}

interface PhoenixSetupOptions {
    seedPhrase?: string;
    port?: number;
}

interface PaymentMakeRequest {
    amountSat: number;
    address: string;
    feeRateSatByte?: number;
}

interface PaymentNewRequest {
    amountSat: number;
    description?: string;
}

interface PaymentInvoiceDetails {
    invoiceString: string;
    invoiceId: string;
}

enum PaymentDirection {
    Incoming = `incoming`,
    Outgoing = `outgoing`,
}

interface PaymentCheck {
    invoiceId: string;
    type: PaymentDirection;
}

enum LNDataType {
    GetBalance = `getbalance`,
    GetInfo = `getinfo`,
    PaymentsIncoming = `payments/incoming`,
    PaymentsOutgoing = `payments/outgoing`,
    // PayInvoice = `payinvoice`,
    // GetLnAddress = `getlnaddress`,
    // ListChannels = `listchannels`,
    // SendToAddress = `sendtoaddress`,
    // PayLnAddress = `paylnaddress`,
    // CreateInvoice = `createinvoice`,
    // PayOffer = `payoffer`,
    // GetOffer = `getoffer`,
}

interface LNDataParams {
    limit?: number;
    offset?: number;
}

interface LNDataRequest {
    type: string;
    params?: Record<string, string | number>;
}

interface LNBalance {
    balanceSat: number;
    feeCreditSat: number;
}

interface IncomingPayment {
    type: `incoming_payment`;
    subType: `lightning`;
    paymentHash: string;
    preimage: string;
    description: string;
    invoice: string;
    isPaid: boolean;
    isExpired: boolean;
    requestedSat: number;
    receivedSat: number;
    fees: number;
    expiresAt: number;
    completedAt: number;
    createdAt: number;
}

interface OutgoingPaymentBase {
    type: `outgoing_payment`;
    isPaid: boolean;
    sent: number;
    fees: number;
    completedAt: number;
    createdAt: number;
}

interface OutgoingPayment extends OutgoingPaymentBase {
    subType: `lightning`;
    invoice: string;
    paymentHash: string;
    preimage: string;
}

interface OutgoingPaymentLiquidity extends OutgoingPaymentBase {
    subType: `auto_liquidity`;
    txId: string;
}

interface NodeInfo {
    nodeId: string;
    channels: object[];
    chain: string;
    blockHeight: number;
    version: string;
}

interface SentPayment {
    recipientAmountSat: number;
    routingFeeSat: number;
    paymentId: string;
    paymentHash: string;
    paymentPreimage: string;
}

interface PaymentDoneResponse {
    recipientAmountSat: number;
    routingFeeSat: number;
    paymentId: string;
    paymentHash: string;
    paymentPreimage: string;
}

interface NewInvoiceResponse {
    amountSat: number;
    paymentHash: string;
    serialized: string;
}

interface LightningClient {
    /** Create a new Lightning invoice for receiving payments */
    invoiceNew({ amountSat, description }: PaymentNewRequest): PaymentInvoiceDetails | undefined;
    /** Check if a previously created invoice has been paid */
    invoiceStatus({ invoiceId, type }: PaymentCheck): IncomingPayment | OutgoingPayment | undefined;
    /** Send a Lightning or on-chain payment to an address */
    fundsWithdraw({ amountSat, address }: PaymentMakeRequest): SentPayment | undefined;
    /** Query Phoenixd node state (balance, payments, info) */
    fundsData<T extends CacheData>({ type, params }: LNDataRequest): T | undefined;
    /** Query the node balance. Wraps `fundsData`. */
    fundsBalance(): LNBalance | undefined;
    /** Fetch incoming payment history. Wraps `fundsData`. */
    fundsIncoming(count?: number): IncomingPayment[] | undefined;
    /** Fetch outgoing payment history. Wraps `fundsData`. */
    fundsOutgoing(count?: number): OutgoingPayment[] | undefined;
    /** Generate an invoice and poll until paid, then publish a Nostr zap receipt. Returns the zap request result. */
    zapProcess({ lnAddress, amountMsat, nostrEvent }: ZapRequest): ZapRequestResponse | undefined;
}

interface ZapSignRequest {
    nostr: string;
    bolt11: string;
}

interface ZapSignResponse {
    signedReceipt: VerifiedEvent;
    relays: string[];
}

interface ZapPublishRequest {
    nostr: string;
    bolt11: string;
    invoiceId: string;
}

interface ZapRequest {
    lnAddress: string;
    amountMsat: number;
    nostrEvent: string;
}

interface ZapRequestResponse {
    invoice: LnurlPayResponse;
    invoiceId: string;
}

interface LnurlPayRequest {
    callback: string;
    maxSendable: number;
    minSendable: number;
    metadata: string;
    tag: 'payRequest';
}

interface LnurlPayResponse {
    pr: string;
    routes: object[];
}

interface UserStoredPayment {
    text: string;
    sats: number;
    time: number;
}

interface UserSeverData {
    pass: string;
    username: string;
    payments: UserStoredPayment[];
}

type CacheData =
    | LNBalance
    | NewInvoiceResponse
    | PaymentDoneResponse
    | (IncomingPayment | OutgoingPayment)[]
    | NodeInfo
    | SentPayment
    | string;

export {
    PaymentDirection,
    LNDataType,
};

export type {
    PhoenixConfig,
    PhoenixSetupOptions,
    CacheData,
    PaymentMakeRequest,
    PaymentNewRequest,
    PaymentInvoiceDetails,
    PaymentCheck,
    LNDataParams,
    LNDataRequest,
    LNBalance,
    IncomingPayment,
    OutgoingPaymentBase,
    OutgoingPayment,
    OutgoingPaymentLiquidity,
    NodeInfo,
    SentPayment,
    PaymentDoneResponse,
    NewInvoiceResponse,
    LightningClient,
    LnurlPayRequest,
    LnurlPayResponse,
    UserStoredPayment,
    UserSeverData,
    ZapSignRequest,
    ZapSignResponse,
    ZapPublishRequest,
    ZapRequest,
    ZapRequestResponse,
};
