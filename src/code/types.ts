import { VerifiedEvent } from "nostr-tools";

interface PaymentMakeRequest {
    amountSat: number;
    onChain?: boolean;
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

interface OutgoingPaymentLN extends OutgoingPaymentBase {
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
    newInvoice(opts: PaymentNewRequest): PaymentInvoiceDetails | undefined;
    checkInvoice(opts: PaymentCheck): IncomingPayment | OutgoingPaymentLN | undefined;
    payInvoice(opts: PaymentMakeRequest & { lightningAddress?: string; onChainAddress?: string }): SentPayment | undefined;
    nodeQuery<T extends CacheData>(opts: LNDataRequest): T | undefined;
    zapSign(opts: { nostr: string; bolt11: string }): { signedReceipt: VerifiedEvent; relays: string[] } | undefined;
    zapPublish(opts: { nostr: string; bolt11: string; invoiceId: string }): Promise<void>;
    payRequest(opts: { user: string; amountMsat: number; nostr?: string }): { invoice: LnurlPayResponse; invoiceId: string } | undefined;
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
    | (IncomingPayment | OutgoingPaymentLN)[]
    | NodeInfo
    | SentPayment
    | string;

export {
    PaymentDirection,
    LNDataType,
};

export type {
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
    OutgoingPaymentLN,
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
};
