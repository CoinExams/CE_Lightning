import { PhoenixConfig, PhoenixSetupOptions } from "../code/types";
declare const 
/** Install, configure, and start phoenixd as a systemd service.
 * Downloads the binary from GitHub releases, generates a config
 * via one-shot run, writes a systemd unit, and verifies the API
 * is responding. Side effects include apt-get dependency
 * installation and systemd unit file creation. Returns the
 * PhoenixConfig (port + password) on success, undefined on failure. */
ensurePhoenixd: ({ seedPhrase, port, }?: PhoenixSetupOptions) => PhoenixConfig | undefined;
export { ensurePhoenixd };
