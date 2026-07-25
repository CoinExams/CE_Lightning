import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
    SimplePool,
    VerifiedEvent,
    finalizeEvent,
    verifyEvent,
} from "nostr-tools";
import {
    PaymentInvoiceDetails,
    PaymentNewRequest,
    PaymentCheck,
    IncomingPayment,
    OutgoingPaymentLN,
    PaymentMakeRequest,
    SentPayment,
    PaymentDoneResponse,
    NewInvoiceResponse,
    LNDataRequest,
    LightningClient,
    LnurlPayResponse,
    PaymentDirection,
    CacheData,
    ZapSignRequest,
    ZapSignResponse,
    ZapPublishRequest,
    PayRequest,
    PayRequestResponse,
} from "./types";
import {
    lightningAddressRegex,
    tN,
    seoDt,
    delayCode,
    msatToSat,
    parseNostrEvent,
    eventRelays,
} from "./utils";

export const startLightning = ({
    password: directPassword,
    credentialsPath = `/root/.phoenix/credentials.json`,
    port,
    cacheDurationMs,
    serverPrvKeyBytes,
    serverPubKeyHex,
    defaultRelays,
    domain,
}: {
    password?: string;
    credentialsPath?: string;
    port: number;
    cacheDurationMs: number;
    serverPrvKeyBytes: Uint8Array;
    serverPubKeyHex: string;
    defaultRelays: string[];
    domain: string;
}): LightningClient => {

    const
        API_URL = `http://localhost:${port}`,
        cache: { [query: string]: { time: number; data: CacheData } } = {},
        password = directPassword || JSON.parse(
            readFileSync(credentialsPath, `utf-8`)
        )?.password,
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
        newInvoice = ({
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
                console.error(seoDt(), `newInvoice failed`, e);
            };
        },
        payInvoice = ({
            amountSat,
            address,
        }: PaymentMakeRequest): SentPayment | undefined => {
            try {
                if (typeof amountSat != `number` || !address) return;
                const
                    isLightning = lightningAddressRegex.test(address),
                    command = isLightning ? `paylnaddress` : `sendtoaddress`,
                    result = nodeCLI<PaymentDoneResponse>(`/${command}`, `POST`, {
                        address,
                        amountSat: amountSat,
                        ...isLightning ? {} : {
                            feerateSatByte: 5
                        },
                    });
                if (result?.recipientAmountSat)
                    return result;
            } catch (e) {
                console.error(seoDt(), `payInvoice failed`, e);
            };
        },
        nodeQuery = <T extends CacheData>({
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
                console.error(seoDt(), `nodeQuery failed`, e);
            };
        },
        checkInvoice = ({
            invoiceId,
            type,
        }: PaymentCheck): IncomingPayment | OutgoingPaymentLN | undefined => {
            try {
                const txs = nodeQuery<(IncomingPayment | OutgoingPaymentLN)[]>({
                    type: `payments/${type}`,
                    params: { limit: 30 },
                });
                return txs?.find(tx => tx?.paymentHash == invoiceId);
            } catch (e) {
                console.error(seoDt(), `checkInvoice failed`, e);
            };
        },
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
                    const payment = checkInvoice({
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
        payRequest = ({
            user,
            amountMsat,
            nostr,
        }: PayRequest): PayRequestResponse | undefined => {

            const amountSat = msatToSat(amountMsat);
            if (typeof amountSat != `number` || amountSat < 1) return;

            const
                lnAddress = `${user}@${domain}`,
                {
                    invoiceString: bolt11 = ``,
                    invoiceId = ``,
                } = newInvoice({
                    amountSat,
                    description: `${nostr ? `Zap` : `Payment`} to ${lnAddress}`,
                }) || {};
            if (!bolt11) return;

            const invoice: LnurlPayResponse = {
                pr: bolt11,
                routes: []
            };

            if (nostr) {
                const { signedReceipt } = zapSign({ nostr, bolt11 }) || {};
                if (!signedReceipt) return;
            };

            return { invoice, invoiceId };
        };

    return {
        newInvoice,
        checkInvoice,
        payInvoice,
        nodeQuery,
        zapSign,
        zapPublish,
        payRequest
    };
};