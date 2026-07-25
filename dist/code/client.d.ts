import { LightningClient } from "./types";
export declare const startLightning: ({ serverPrvKeyBytes, serverPubKeyHex, port, defaultRelays, cacheDurationMs, password: directPassword, credentialsPath, }: {
    serverPrvKeyBytes: Uint8Array;
    serverPubKeyHex: string;
    port?: number;
    defaultRelays?: string[];
    cacheDurationMs?: number;
    password?: string;
    credentialsPath?: string;
}) => LightningClient;
