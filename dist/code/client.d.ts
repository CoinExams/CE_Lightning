import { LightningClient } from "./types";
/** Create a LightningClient that talks to a local Phoenixd node.
 * Returns `undefined` if credentials cannot be loaded. */
export declare const startLightning: ({ serverPrvKeyBytes, serverPubKeyHex, port, defaultRelays, cacheDurationMs, password: directPassword, credentialsPath, }: {
    serverPrvKeyBytes: Uint8Array;
    serverPubKeyHex: string;
    port?: number;
    defaultRelays?: string[];
    cacheDurationMs?: number;
    password?: string;
    credentialsPath?: string;
}) => LightningClient;
