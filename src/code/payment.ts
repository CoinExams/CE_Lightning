import {
    PaymentInvoiceDetails,
    IncomingPayment,
    OutgoingPaymentLN,
    SentPayment,
    LNBalance,
    LightningClient,
    PaymentDirection,
} from "./types";

const createInvoice = ({
    client,
    amountSat,
    description,
}: {
    client: LightningClient;
    amountSat: number;
    description?: string;
}): PaymentInvoiceDetails | undefined =>
    client.newInvoice({ amountSat, description });

const checkPayment = ({
    client,
    invoiceId,
    type,
}: {
    client: LightningClient;
    invoiceId: string;
    type: PaymentDirection;
}): IncomingPayment | OutgoingPaymentLN | undefined =>
    client.checkInvoice({ invoiceId, type });

const sendPayment = ({
    client,
    amountSat,
    opts,
}: {
    client: LightningClient;
    amountSat: number;
    opts?: { onChain?: boolean; lightningAddress?: string; onChainAddress?: string };
}): SentPayment | undefined =>
    client.payInvoice({ amountSat, ...opts });

const getBalance = ({
    client,
}: {
    client: LightningClient;
}): LNBalance | undefined =>
    client.nodeQuery<LNBalance>({ type: `getbalance` });

const getIncomingPayments = ({
    client,
    limit = 30,
}: {
    client: LightningClient;
    limit?: number;
}): IncomingPayment[] | undefined =>
    client.nodeQuery<(IncomingPayment | OutgoingPaymentLN)[]>({
        type: `payments/incoming`,
        params: { limit },
    }) as IncomingPayment[] | undefined;

const getOutgoingPayments = ({
    client,
    limit = 30,
}: {
    client: LightningClient;
    limit?: number;
}): OutgoingPaymentLN[] | undefined =>
    client.nodeQuery<(IncomingPayment | OutgoingPaymentLN)[]>({
        type: `payments/outgoing`,
        params: { limit },
    }) as OutgoingPaymentLN[] | undefined;

export {
    createInvoice,
    checkPayment,
    sendPayment,
    getBalance,
    getIncomingPayments,
    getOutgoingPayments,
};
