declare const 
/** Log a completed step to a new line */
logStep: (msg: string) => void, 
/** Update current line in-place (no newline) */
updateInline: (msg: string) => void;
export { logStep, updateInline, };
