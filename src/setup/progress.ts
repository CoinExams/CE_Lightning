const
    /** Log a completed step to a new line */
    logStep = (msg: string): void => {
        process.stdout.write(`${msg}\n`);
    },

    /** Update current line in-place (no newline) */
    updateInline = (msg: string): void => {
        process.stdout.write(`\r\x1b[K${msg}`);
    };

export {
    logStep,
    updateInline,
};
