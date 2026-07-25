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
    LNBalance,
    LightningClient,
    LnurlPayResponse,
    PaymentDirection,
    CacheData,
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

const startLightning = ({
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
    const password = directPassword || JSON.parse(
        readFileSync(credentialsPath, `utf-8`)
    )?.password;

    const cache: { [query: string]: { time: number; data: CacheData } } = {};
    const API_URL = `http://localhost:${port}`;

    const nodeCLI = <T>(
        path: string,
        method: `GET` | `POST`,
        data?: Record<string, string | number>
    ): T | undefined => {
        try {
            const args = [`-s`, `-u`, `:${password}`, `-X`, method];
            let url = `${API_URL}${path}`;
            if (data) {
                const body = new URLSearchParams(
                        Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
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
    };

    const newInvoice = (opts: PaymentNewRequest): PaymentInvoiceDetails | undefined => {
        try {
            const result = nodeCLI<NewInvoiceResponse>(`/createinvoice`, `POST`, {
                amountSat: opts.amountSat,
                description: opts.description || `@NostrPro Username`,
            });
            if (result?.serialized)
                return {
                    invoiceString: result.serialized,
                    invoiceId: result.paymentHash,
                };
        } catch (e) {
            console.error(seoDt(), `newInvoice failed`, e);
        };
    };

    const payInvoice = (
        opts: PaymentMakeRequest & { lightningAddress?: string; onChainAddress?: string }
    ): SentPayment | undefined => {
        try {
            const address = opts.onChain ? opts.onChainAddress : opts.lightningAddress;
            if (typeof opts.amountSat != `number` || !address) return;
            const isLightning = lightningAddressRegex.test(address);
            const command = isLightning ? `paylnaddress` : `sendtoaddress`;
            const result = nodeCLI<PaymentDoneResponse>(`/${command}`, `POST`, {
                address,
                amountSat: opts.amountSat,
                ...isLightning ? {} : { feerateSatByte: 5 },
            });
            if (result?.recipientAmountSat) return result;
        } catch (e) {
            console.error(seoDt(), `payInvoice failed`, e);
        };
    };

    const nodeQuery = <T extends CacheData>(opts: LNDataRequest): T | undefined => {
        try {
            const time = tN();
            const key = `${opts.type}${!opts.params ? `` : JSON.stringify(opts.params)}`;
            if (cache[key] && cache[key].time > (time - cacheDurationMs))
                return cache[key].data as T;

            const data = nodeCLI<T>(`/${opts.type}`, `GET`, opts.params as Record<string, string | number>);
            if (data) cache[key] = { time, data };
            return data;
        } catch (e) {
            console.error(seoDt(), `nodeQuery failed`, e);
        };
    };

    const checkInvoice = (opts: PaymentCheck): IncomingPayment | OutgoingPaymentLN | undefined => {
        try {
            const txs = nodeQuery<(IncomingPayment | OutgoingPaymentLN)[]>({
                type: `payments/${opts.type}`,
                params: { limit: 30 },
            });
            return txs?.find(tx => tx?.paymentHash == opts.invoiceId);
        } catch (e) {
            console.error(seoDt(), `checkInvoice failed`, e);
        };
    };

    const zapSign = ({
        nostr,
        bolt11,
    }: {
        nostr: string;
        bolt11: string;
    }): {
        signedReceipt: VerifiedEvent;
        relays: string[];
    } | undefined => {
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
                    [`P`, zapRequestEvent.pubkey],
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
    };

    const zapPublish = async ({
        nostr,
        bolt11,
        invoiceId,
    }: {
        nostr: string;
        bolt11: string;
        invoiceId: string;
    }) => {
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
    };

    const payRequest = ({
        user,
        amountMsat,
        nostr,
    }: {
        user: string;
        amountMsat: number;
        nostr?: string;
    }): { invoice: LnurlPayResponse; invoiceId: string } | undefined => {
        const amountSat = msatToSat(amountMsat);
        if (typeof amountSat != `number` || amountSat < 1) return;

        const lnAddress = `${user}@${domain}`;

        const {
            invoiceString: bolt11 = ``,
            invoiceId = ``,
        } = newInvoice({
            amountSat,
            description: `${nostr ? `Zap` : `Payment`} to ${lnAddress}`,
        }) || {};

        if (!bolt11) return;

        const invoice: LnurlPayResponse = { pr: bolt11, routes: [] };

        if (nostr) {
            const { signedReceipt } = zapSign({ nostr, bolt11 }) || {};
            if (!signedReceipt) return;
        };

        return { invoice, invoiceId };
    };

    return { newInvoice, checkInvoice, payInvoice, nodeQuery, zapSign, zapPublish, payRequest };
};

export { startLightning };
