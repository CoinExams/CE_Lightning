import { execFileSync } from "node:child_process";
import {
    SimplePool,
    finalizeEvent,
    verifyEvent,
} from "nostr-tools";
import {
    PaymentInvoiceDetails,
    PaymentNewRequest,
    PaymentCheck,
    IncomingPayment,
    OutgoingPayment,
    PaymentMakeRequest,
    SentPayment,
    PaymentDoneResponse,
    NewInvoiceResponse,
    LNDataRequest,
    LightningClient,
    LNBalance,
    LnurlPayResponse,
    PaymentDirection,
    CacheData,
    ZapSignRequest,
    ZapSignResponse,
    ZapPublishRequest,
    ZapRequest,
    ZapRequestResponse,
} from "./types";
import {
    isLightningAddress,
    tN,
    seoDt,
    delayCode,
    msatToSat,
    parseNostrEvent,
    eventRelays,
    RELAYS_LIST,
} from "./utils";
import { readPhoenixConfig } from "../setup/config";

/** Create a LightningClient that talks to a local Phoenixd node.
 * Assumes phoenixd is already installed and running (use
 * `ensurePhoenixd` to set it up). Returns `undefined` if credentials
 * cannot be loaded. */
export const startLightning = ({
    serverPrvKeyBytes,
    serverPubKeyHex,
    defaultRelays = RELAYS_LIST,
    cacheDurationMs = 500,
}: {
    serverPrvKeyBytes: Uint8Array;
    serverPubKeyHex: string;
    defaultRelays?: string[];
    cacheDurationMs?: number;
}): LightningClient | undefined => {

    const
        phoenixConfig = readPhoenixConfig();
    if (phoenixConfig?.port == undefined) return;

    const
        { port, password } = phoenixConfig,
        API_URL = `http://localhost:${port}`,
        cache: { [query: string]: { time: number; data: CacheData } } = {},
        nodeCLI = <T>(
            path: string,
            method: `GET` | `POST`,
            data?: Record<string, string | number>
        ): T | undefined => {
            try {
                const args = [`-s`, `-u`, `:${password}`, `-X`, method];
                let url = `${API_URL}${path}`;
                if (data) {
                    const body = new URLSearchParams(
                        Object.fromEntries(Object.entries(data)?.map(([k, v]) => [k, String(v)]))
                    ).toString();
                    if (method == `GET`) url += `?${body}`;
                    else args.push(`-d`, body);
                };
                args.push(url);
                const response = execFileSync(`curl`, args).toString();
                return (
                    response?.startsWith(`{`)
                        || response?.startsWith(`[`)
                        ? JSON.parse(response)
                        : response
                ) as T | undefined;
            } catch (error) {
                console.error(seoDt(), `Lightning node ${path} failed:`, error instanceof Error ? error.message : String(error));
            };
        },
        invoiceNew = ({
            amountSat,
            description = ``,
        }: PaymentNewRequest): PaymentInvoiceDetails | undefined => {
            try {
                const result = nodeCLI<NewInvoiceResponse>(`/createinvoice`, `POST`, {
                    amountSat,
                    description,
                });
                if (result?.serialized)
                    return {
                        invoiceString: result.serialized,    // The "lnbc..." invoice string
                        invoiceId: result.paymentHash,   // Use this to check status later
                    };
            } catch (e) {
                console.error(seoDt(), `invoiceNew failed`, e);
            };
        },
        fundsWithdraw = ({
            amountSat,
            address,
            feeRateSatByte = 5,
        }: PaymentMakeRequest): SentPayment | undefined => {
            try {
                if (typeof amountSat != `number` || !address) return;
                const
                    isLightning = isLightningAddress.test(address),
                    command = isLightning ? `paylnaddress` : `sendtoaddress`,
                    result = nodeCLI<PaymentDoneResponse>(`/${command}`, `POST`, {
                        address,
                        amountSat,
                        ...isLightning ? {} : {
                            feerateSatByte: feeRateSatByte,
                        },
                    });
                if (result?.recipientAmountSat)
                    return result;
            } catch (e) {
                console.error(seoDt(), `fundsWithdraw failed`, e);
            };
        },
        fundsData = <T extends CacheData>({
            type,
            params,
        }: LNDataRequest): T | undefined => {
            try {

                // Example:
                // curl -u :password -X GET http://localhost:PORT/getbalance

                const
                    time = tN(),
                    key = `${type}${!params ? `` : JSON.stringify(params)}`;
                if (cache[key] && cache[key].time > (time - cacheDurationMs))
                    return cache[key].data as T;

                const data = nodeCLI<T>(`/${type}`, `GET`, params as Record<string, string | number>);
                if (data) cache[key] = { time, data };
                return data;
            } catch (e) {
                console.error(seoDt(), `fundsData failed`, e);
            };
        },
        invoiceStatus = ({
            invoiceId,
            type,
        }: PaymentCheck): IncomingPayment | OutgoingPayment | undefined => {
            try {
                const txs = fundsData<(IncomingPayment | OutgoingPayment)[]>({
                    type: `payments/${type}`,
                    params: { limit: 30 },
                });
                return txs?.find(tx => tx?.paymentHash == invoiceId);
            } catch (e) {
                console.error(seoDt(), `invoiceStatus failed`, e);
            };
        },
        fundsBalance = (): LNBalance | undefined =>
            fundsData<LNBalance>({ type: `getbalance` }),

        fundsIncoming = (count = 30): IncomingPayment[] | undefined =>
            fundsData<(IncomingPayment | OutgoingPayment)[]>({
                type: `payments/incoming`,
                params: { limit: count },
            }) as IncomingPayment[] | undefined,

        fundsOutgoing = (count = 30): OutgoingPayment[] | undefined =>
            fundsData<(IncomingPayment | OutgoingPayment)[]>({
                type: `payments/outgoing`,
                params: { limit: count },
            }) as OutgoingPayment[] | undefined,

        zapSign = ({
            nostr,
            bolt11,
        }: ZapSignRequest): ZapSignResponse | undefined => {
            try {
                const zapRequestEvent = parseNostrEvent(nostr);
                if (!zapRequestEvent) return;

                const receipt = {
                    kind: 9735,
                    content: zapRequestEvent.content || ``,
                    created_at: Math.round(tN() / 1e3),
                    pubkey: serverPubKeyHex,
                    tags: [
                        ...(zapRequestEvent.tags.filter((t: string[]) => [`e`, `a`, `p`, `k`].includes(t[0]))),
                        [`bolt11`, bolt11],
                        [`description`, JSON.stringify(zapRequestEvent)],
                        [`P`, zapRequestEvent.pubkey], // sender
                    ],
                };

                const signedReceipt = finalizeEvent(receipt, serverPrvKeyBytes);
                if (!verifyEvent(signedReceipt)) {
                    console.error(seoDt(), `zapSign verification failed`, JSON.stringify(receipt));
                    return;
                };

                return {
                    signedReceipt,
                    relays: eventRelays(zapRequestEvent),
                };
            } catch (e) {
                console.error(seoDt(), `zapSign failed`, e);
            };
        },
        zapPublish = async ({
            nostr,
            bolt11,
            invoiceId,
        }: ZapPublishRequest) => {
            try {

                const
                    msInterval = 200,
                    publish = async () => {
                        const { signedReceipt, relays } = zapSign({ nostr, bolt11 }) || {};
                        if (!signedReceipt) return
                        const
                            pool = new SimplePool(),
                            relayList = (relays || []).concat(defaultRelays)
                                .filter((v, i, a) => a.indexOf(v) === i);
                        await Promise.allSettled(pool.publish(relayList, signedReceipt));
                        pool.close(defaultRelays);
                    };

                let delayInterval = msInterval;

                for (let i = 0; i < 30; i++) {

                    // wait
                    await delayCode(delayInterval);

                    // check payment
                    const payment = invoiceStatus({
                        invoiceId,
                        type: PaymentDirection.Incoming,
                    }) as IncomingPayment;

                    // publish receipt
                    if (payment?.isPaid) {
                        publish();
                        return
                    };

                    // increase wait
                    delayInterval += msInterval;
                };

            } catch (e) {
                console.error(seoDt(), `zapPublish failed`, e);
            };
        },
        zapRequest = ({
            lnAddress,
            amountMsat,
            nostrEvent,
        }: ZapRequest): ZapRequestResponse | undefined => {

            const amountSat = msatToSat(amountMsat);
            if (typeof amountSat != `number` || amountSat < 1) return;

            const
                {
                    invoiceString: bolt11 = ``,
                    invoiceId = ``,
                } = invoiceNew({
                    amountSat,
                    description: `${nostrEvent ? `Zap` : `Payment`} to ${lnAddress}`,
                }) || {};
            if (!bolt11) return;

            const invoice: LnurlPayResponse = {
                pr: bolt11,
                routes: []
            };

            if (nostrEvent) {
                const { signedReceipt } = zapSign({ nostr: nostrEvent, bolt11 }) || {};
                if (!signedReceipt) return;
            };

            return { invoice, invoiceId };
        },
        zapProcess = ({
            lnAddress,
            amountMsat,
            nostrEvent,
        }: ZapRequest): ZapRequestResponse | undefined => {

            const result = zapRequest({
                lnAddress,
                amountMsat,
                nostrEvent,
            });

            if (result && nostrEvent) zapPublish({
                nostr: nostrEvent,
                bolt11: result.invoice.pr,
                invoiceId: result.invoiceId,
            }).catch(e => console.error(seoDt(), `zapProcess publish failed`, e));

            return result;
        };

    return {
        invoiceNew,
        invoiceStatus,
        fundsWithdraw,
        fundsData,
        fundsBalance,
        fundsIncoming,
        fundsOutgoing,
        zapProcess,
    };
};