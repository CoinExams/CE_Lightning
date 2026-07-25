import { LightningClient } from "./types";
export declare const startLightning: ({ password: directPassword, credentialsPath, port, cacheDurationMs, serverPrvKeyBytes, serverPubKeyHex, defaultRelays, domain, }: {
    password?: string;
    credentialsPath?: string;
    port: number;
    cacheDurationMs: number;
    serverPrvKeyBytes: Uint8Array;
    serverPubKeyHex: string;
    defaultRelays: string[];
    domain: string;
}) => LightningClient;
