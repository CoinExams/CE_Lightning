import { PaymentInvoiceDetails, IncomingPayment, OutgoingPaymentLN, SentPayment, LNBalance, LightningClient, PaymentDirection } from "./types";
declare const createInvoice: ({ client, amountSat, description, }: {
    client: LightningClient;
    amountSat: number;
    description?: string;
}) => PaymentInvoiceDetails | undefined;
declare const checkPayment: ({ client, invoiceId, type, }: {
    client: LightningClient;
    invoiceId: string;
    type: PaymentDirection;
}) => IncomingPayment | OutgoingPaymentLN | undefined;
declare const sendPayment: ({ client, amountSat, address, }: {
    client: LightningClient;
    amountSat: number;
    address: string;
}) => SentPayment | undefined;
declare const getBalance: ({ client, }: {
    client: LightningClient;
}) => LNBalance | undefined;
declare const getIncomingPayments: ({ client, limit, }: {
    client: LightningClient;
    limit?: number;
}) => IncomingPayment[] | undefined;
declare const getOutgoingPayments: ({ client, limit, }: {
    client: LightningClient;
    limit?: number;
}) => OutgoingPaymentLN[] | undefined;
export { createInvoice, checkPayment, sendPayment, getBalance, getIncomingPayments, getOutgoingPayments, };
