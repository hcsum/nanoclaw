/**
 * Web.Cafe Integration IPC Handler
 *
 * Handles all web_cafe_* IPC messages from container agents.
 */
/**
 * Handle Web.Cafe integration IPC messages
 *
 * @returns true if message was handled, false if not a web_cafe message
 */
export declare function handleWebCafeIpc(data: Record<string, unknown>, sourceGroup: string, isMain: boolean, dataDir: string): Promise<boolean>;
//# sourceMappingURL=host.d.ts.map