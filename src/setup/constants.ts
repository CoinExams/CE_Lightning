const
    PHOENIX_VERSION = `0.9.0`,
    PORT = 9740,
    BIND_IP = `127.0.0.1`,
    DATADIR = `/root/.phoenix`,
    INSTALL_DIR = `/opt/phoenix-setup`,
    BINARY_PATH = `${INSTALL_DIR}/phoenixd`,
    VERSION_FILE = `${INSTALL_DIR}/.version`,
    BACKUP_DIR = `${INSTALL_DIR}/backups`,
    CONF_PATH = `${DATADIR}/phoenix.conf`,
    OUTPUT_FILE = `${DATADIR}/credentials.json`,
    LOCK_FILE = `${INSTALL_DIR}/.lock`,
    HEALTH_RETRIES = 10,
    HEALTH_SLEEP = 1,
    SERVICE_CHECK_RETRIES = 20,
    SERVICE_CHECK_SLEEP = 1,
    buildServiceConfig = (port: number): string => `[Unit]
Description=Phoenixd Lightning Service
After=network.target

[Service]
Environment=PHOENIX_DATADIR=${DATADIR}
ExecStart=${BINARY_PATH} --http-bind-ip ${BIND_IP} --http-bind-port ${port}
User=root
Restart=always
WorkingDirectory=${INSTALL_DIR}

[Install]
WantedBy=multi-user.target
`;

export {
    PHOENIX_VERSION,
    PORT,
    BIND_IP,
    DATADIR,
    INSTALL_DIR,
    BINARY_PATH,
    VERSION_FILE,
    BACKUP_DIR,
    CONF_PATH,
    OUTPUT_FILE,
    LOCK_FILE,
    HEALTH_RETRIES,
    HEALTH_SLEEP,
    SERVICE_CHECK_RETRIES,
    SERVICE_CHECK_SLEEP,
    buildServiceConfig,
};
