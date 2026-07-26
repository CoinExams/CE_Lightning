import { LightningClient } from "./types";
/** Create a LightningClient that talks to a local Phoenixd node.
 * Assumes phoenixd is already installed and running (use
 * `ensurePhoenixd` to set it up). Returns `undefined` if credentials
 * cannot be loaded. */
export declare const startLightning: ({ serverPrvKeyBytes, serverPubKeyHex, defaultRelays, cacheDurationMs, }: {
    serverPrvKeyBytes: Uint8Array;
    serverPubKeyHex: string;
    defaultRelays?: string[];
    cacheDurationMs?: number;
}) => LightningClient | undefined;
