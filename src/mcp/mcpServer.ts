import * as http from 'http';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import path = require('path');
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { gDebugLog, gEdkWorkspaces, gExtensionContext, gPathFind, gWorkspacePath } from '../extension';
import { openTextDocument } from '../utils';
import { getParserForDocument } from '../edkParser/parserFactory';
import { Edk2SymbolType } from '../symbols/symbolsType';
import { z } from 'zod';

let httpServer: http.Server | undefined;
let mcpServer: McpServer | undefined;
let serverToken: string | undefined;
const transports: Record<string, SSEServerTransport> = {};

/** The server is only ever reachable through the loopback interface. */
const BIND_ADDRESS = '127.0.0.1';

/** Host names that are accepted in the `Host` and `Origin` headers. */
const ALLOWED_HOST_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Extracts the host name (without port and without IPv6 brackets) from a
 * `Host` header value.
 */
function parseHostName(hostHeader: string | undefined): string | undefined {
    if (!hostHeader) {
        return undefined;
    }
    const value = hostHeader.trim();
    // IPv6 literal, e.g. "[::1]:3100"
    if (value.startsWith('[')) {
        const end = value.indexOf(']');
        return end === -1 ? undefined : value.slice(1, end).toLowerCase();
    }
    return value.split(':')[0].toLowerCase();
}

/**
 * Rejects requests that do not target the loopback interface by name.
 * This is what defeats DNS rebinding attacks: the browser keeps sending the
 * attacker controlled host name (e.g. "evil.com") in the `Host`/`Origin`
 * headers even after the DNS record points at 127.0.0.1.
 */
function isAllowedOriginAndHost(req: http.IncomingMessage): boolean {
    const hostName = parseHostName(req.headers.host);
    if (!hostName || !ALLOWED_HOST_NAMES.has(hostName)) {
        return false;
    }

    const origin = req.headers.origin;
    if (origin !== undefined && origin !== 'null') {
        try {
            const originHost = new URL(origin).hostname.replace(/^\[|\]$/g, '').toLowerCase();
            if (!ALLOWED_HOST_NAMES.has(originHost)) {
                return false;
            }
        } catch {
            return false;
        }
    }

    return true;
}

/** Constant time comparison of the presented bearer token. */
function isAuthorized(req: http.IncomingMessage): boolean {
    if (!serverToken) {
        return false;
    }
    const header = req.headers.authorization;
    if (!header) {
        return false;
    }
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) {
        return false;
    }
    const presented = Buffer.from(match[1], 'utf8');
    const expected = Buffer.from(serverToken, 'utf8');
    if (presented.length !== expected.length) {
        return false;
    }
    return crypto.timingSafeEqual(presented, expected);
}

/** Returns the bearer token required by MCP clients, if the server is running. */
export function getMcpServerToken(): string | undefined {
    return serverToken;
}

const TOKEN_SECRET_KEY = 'edk2code.mcpServerToken';

/**
 * Returns the persisted access token, creating one on first use.
 * The token is kept in VS Code SecretStorage so that MCP clients do not need
 * to be reconfigured every time the server restarts.
 */
export async function getOrCreateMcpToken(): Promise<string> {
    const secrets = gExtensionContext?.secrets;
    if (!secrets) {
        // No storage available: fall back to an ephemeral token.
        return serverToken ?? crypto.randomBytes(32).toString('hex');
    }
    let token = await secrets.get(TOKEN_SECRET_KEY);
    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await secrets.store(TOKEN_SECRET_KEY, token);
    }
    return token;
}

function createMcpServer(): McpServer {
    const server = new McpServer(
        { name: 'edk2code', version: '1.0.0' },
        { capabilities: { tools: {} } }
    );

    // ── Tool: list_files ────────────────────────────────────────────────
    server.registerTool(
        'list_edk2_workspace_files',
        {
            description:
                'List all files used in the EDK2 compilation across all loaded workspaces. ' +
                'Returns file names with their full paths. ' +
                'If a file you are looking for is not in this list, it is NOT used in the current compilation.',
            inputSchema: {
                fileName: z
                    .string()
                    .optional()
                    .describe(
                        'Optional regex pattern to filter files by name (e.g. "Pci" to find all PCI-related files, "Pci.*\\.inf" for PCI .inf files). ' +
                        'The pattern is matched case-insensitively against the file base name. ' +
                        'If no match is found the file is not part of the current compilation.'
                    ),
            },
        },
        async ({ fileName }) => {
            const wps = gEdkWorkspaces.workspaces;
            const allFiles: { name: string; fullPath: string }[] = [];

            for (const wp of wps) {
                for (const filePath of wp.getFilesList()) {
                    allFiles.push({
                        name: path.basename(filePath),
                        fullPath: filePath,
                    });
                }
            }

            let results = allFiles;
            if (fileName) {
                try {
                    const regex = new RegExp(fileName, 'i');
                    results = allFiles.filter((f) => regex.test(f.name));
                } catch {
                    // If invalid regex, fall back to substring match
                    const needle = fileName.toLowerCase();
                    results = allFiles.filter(
                        (f) => f.name.toLowerCase().includes(needle)
                    );
                }
            }

            if (results.length === 0) {
                const msg = fileName
                    ? `File "${fileName}" was not found in any EDK2 workspace. It is not used in the current compilation.`
                    : 'No files found. The EDK2 workspace may not be indexed yet. Run "EDK2: Rebuild index database" first.';
                return { content: [{ type: 'text', text: msg }] };
            }

            const text = results
                .map((f) => `${f.name}\t${f.fullPath}`)
                .join('\n');
            return { content: [{ type: 'text', text }] };
        }
    );

    // ── Tool: resolve_edk2_file_path ────────────────────────────────────
    server.registerTool(
        'resolve_edk2_file_path',
        {
            description:
                'Resolve an EDK2 relative path or file name to its full filesystem path using the EDK2 path resolution logic. ' +
                'If the file cannot be resolved, it is not used in the current compilation.',
            inputSchema: {
                filePath: z
                    .string()
                    .describe(
                        'The EDK2 relative path or file name to resolve (e.g. "MdeModulePkg/Core/Pei/PeiMain.inf").'
                    ),
            },
        },
        async ({ filePath }) => {
            const locations = await gPathFind.findPath(filePath);
            if (locations.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Could not resolve "${filePath}". The file is not used in the current compilation or the workspace is not indexed.`,
                        },
                    ],
                };
            }
            const text = locations.map((l) => l.uri.fsPath).join('\n');
            return { content: [{ type: 'text', text }] };
        }
    );

    // ── Tool: find_library_implementation ───────────────────────────────
    server.registerTool(
        'find_edk2_library_implementation',
        {
            description:
                'Find the implementation (INF file) of an EDK2 library by base name. ' +
                'Searches all loaded workspaces for library declarations in DSC files. ' +
                'Returns the library name, the INF path implementing it, the DSC location where it is declared, and the section properties (arch, module type). ' +
                'If no match is found, the library is not used in the current compilation.',
            inputSchema: {
                libraryName: z
                    .string()
                    .describe(
                        'Library class name or regex pattern to search for (e.g. "BaseMemoryLib", "Pci.*Lib", "UefiBootServicesTableLib"). ' +
                        'Matched case-insensitively against library class names declared in DSC files.'
                    ),
            },
        },
        async ({ libraryName }) => {
            const wps = gEdkWorkspaces.workspaces;
            const results: string[] = [];

            let regex: RegExp | null = null;
            try {
                regex = new RegExp(libraryName, 'i');
            } catch {
                // invalid regex, fall back to substring
            }

            for (const wp of wps) {
                for (const lib of wp.filesLibraries) {
                    const libNameDsc = lib.text.split('|')[0].trim();
                    const matches = regex
                        ? regex.test(libNameDsc)
                        : libNameDsc.toLowerCase().includes(libraryName.toLowerCase());

                    if (matches) {
                        const resolvedPaths = await gPathFind.findPath(lib.path);
                        const fullPath = resolvedPaths.length
                            ? resolvedPaths[0].uri.fsPath
                            : lib.path;
                        const dscFile = lib.location.uri.fsPath;
                        const dscLine = lib.location.range.start.line + 1;
                        const section = lib.sectionProperties.toString() || 'unknown';
                        results.push(
                            `${libNameDsc}\t${fullPath}\t${dscFile}:${dscLine}\t[${section}]`
                        );
                    }
                }
            }

            if (results.length === 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `No library matching "${libraryName}" was found in any EDK2 workspace. It is not used in the current compilation.`,
                        },
                    ],
                };
            }

            const header = 'LibraryClass\tImplementation\tDSC Location\tSection';
            return {
                content: [{ type: 'text', text: header + '\n' + results.join('\n') }],
            };
        }
    );

    // ── Tool: find_inf_for_source ───────────────────────────────────────
    server.registerTool(
        'find_edk2_inf_for_source',
        {
            description:
                'Given a C/H source file, find the EDK2 INF file (library or component) that includes it in its [Sources] section. ' +
                'This is useful for determining which EDK2 module or library a source file belongs to. ' +
                'If no INF is found, the file may not be part of a compiled EDK2 component.',
            inputSchema: {
                sourceFile: z
                    .string()
                    .describe(
                        'Full path or file name of a C/H source file (e.g. "PeiMain.c", "D:/edk2/MdeModulePkg/Core/Pei/PeiMain.c"). ' +
                        'If only a file name is given, the tool will attempt to resolve it.'
                    ),
            },
        },
        async ({ sourceFile }) => {
            // Resolve to a URI
            let fileUri: vscode.Uri;
            if (path.isAbsolute(sourceFile)) {
                fileUri = vscode.Uri.file(sourceFile);
            } else {
                const resolved = await gPathFind.findPath(sourceFile);
                if (resolved.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `Could not resolve "${sourceFile}". The file was not found in the workspace.`,
                        }],
                    };
                }
                fileUri = resolved[0].uri;
            }

            const results: string[] = [];

            // Try indexed workspaces first (like gotoInf)
            const wps = await gEdkWorkspaces.getWorkspace(fileUri);
            if (wps.length) {
                for (const wp of wps) {
                    const locations = await wp.getInfReference(fileUri);
                    for (const loc of locations) {
                        const infPath = loc.uri.fsPath;
                        const line = loc.range.start.line + 1;
                        if (!results.includes(infPath)) {
                            results.push(infPath);
                        }
                    }
                }
            }

            // Fallback: walk up from the source file looking for INF files
            // that list it in their [Sources] section
            if (results.length === 0) {
                const fileName = path.basename(fileUri.fsPath);
                const folderPath = path.dirname(fileUri.fsPath);
                const workspaceRoot = gWorkspacePath;

                let currentDir = folderPath;
                while (currentDir.length >= workspaceRoot.length) {
                    // Check all modules and libraries whose INF is relative to this dir
                    for (const wp of gEdkWorkspaces.workspaces) {
                        const allInfs = [...wp.filesModules, ...wp.filesLibraries];
                        for (const inf of allInfs) {
                            const resolvedInf = await gPathFind.findPath(inf.path);
                            if (resolvedInf.length === 0) { continue; }
                            const infDir = path.dirname(resolvedInf[0].uri.fsPath);
                            if (!folderPath.startsWith(infDir)) { continue; }
                            try {
                                const doc = await openTextDocument(resolvedInf[0].uri);
                                const parser = await getParserForDocument(doc);
                                if (parser) {
                                    const sources = parser.getSymbolsType(Edk2SymbolType.infSource);
                                    for (const source of sources) {
                                        const srcPath = await gPathFind.findPath(
                                            await source.getValue(),
                                            path.dirname(resolvedInf[0].uri.fsPath)
                                        );
                                        if (srcPath.length && srcPath[0].uri.fsPath === fileUri.fsPath) {
                                            const infFullPath = resolvedInf[0].uri.fsPath;
                                            if (!results.includes(infFullPath)) {
                                                results.push(infFullPath);
                                            }
                                        }
                                    }
                                }
                            } catch { /* skip parse errors */ }
                        }
                    }
                    if (results.length > 0) { break; }
                    const parentDir = path.dirname(currentDir);
                    if (parentDir === currentDir) { break; }
                    currentDir = parentDir;
                }
            }

            if (results.length === 0) {
                return {
                    content: [{
                        type: 'text',
                        text: `No INF file found for "${sourceFile}". The file may not be part of a compiled EDK2 component or library.`,
                    }],
                };
            }

            const text = results.map((infPath) => {
                const name = path.basename(infPath, '.inf');
                return `${name}\t${infPath}`;
            }).join('\n');
            return {
                content: [{ type: 'text', text: `INF files for ${path.basename(sourceFile)}:\n${text}` }],
            };
        }
    );

    return server;
}

export async function startMcpServer(port: number): Promise<void> {
    if (httpServer) {
        vscode.window.showInformationMessage(`MCP SSE server is already running on port ${port}`);
        return;
    }

    mcpServer = createMcpServer();
    serverToken = await getOrCreateMcpToken();

    httpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? '', `http://${BIND_ADDRESS}:${port}`);

        // Reject cross-origin / rebound-DNS requests before doing any work.
        if (!isAllowedOriginAndHost(req)) {
            gDebugLog.warning(
                `MCP SSE: rejected request with host "${req.headers.host}" origin "${req.headers.origin}"`
            );
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // Health check (no token required, loopback only).
        if (req.method === 'GET' && url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
            return;
        }

        if (!isAuthorized(req)) {
            gDebugLog.warning('MCP SSE: rejected unauthenticated request');
            res.writeHead(401, { 'WWW-Authenticate': 'Bearer' });
            res.end('Unauthorized');
            return;
        }

        // SSE stream endpoint
        if (req.method === 'GET' && url.pathname === '/sse') {
            gDebugLog.info('MCP SSE: new client connection');
            try {
                const transport = new SSEServerTransport('/messages', res);
                transports[transport.sessionId] = transport;
                transport.onclose = () => {
                    gDebugLog.info(`MCP SSE: session ${transport.sessionId} closed`);
                    delete transports[transport.sessionId];
                };
                const server = createMcpServer();
                await server.connect(transport);
            } catch (err) {
                gDebugLog.error(`MCP SSE error: ${err}`);
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end('Internal Server Error');
                }
            }
            return;
        }

        // Message endpoint for client→server JSON-RPC
        if (req.method === 'POST' && url.pathname === '/messages') {
            const sessionId = url.searchParams.get('sessionId');
            if (!sessionId || !transports[sessionId]) {
                res.writeHead(400);
                res.end('Invalid or missing sessionId');
                return;
            }
            await transports[sessionId].handlePostMessage(req, res);
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    });

    return new Promise<void>((resolve, reject) => {
        httpServer!.listen(port, BIND_ADDRESS, () => {
            gDebugLog.info(`MCP SSE server listening on http://${BIND_ADDRESS}:${port}/sse (loopback only)`);
            vscode.window.showInformationMessage(
                `EDK2 MCP SSE server started on http://${BIND_ADDRESS}:${port}/sse. ` +
                'Clients must send an "Authorization: Bearer <token>" header.',
                'Copy Access Token'
            ).then(async (selection) => {
                if (selection === 'Copy Access Token' && serverToken) {
                    await vscode.env.clipboard.writeText(serverToken);
                    vscode.window.showInformationMessage('EDK2 MCP access token copied to clipboard');
                }
            });
            resolve();
        });
        httpServer!.on('error', (err) => {
            gDebugLog.error(`MCP SSE server error: ${err}`);
            vscode.window.showErrorMessage(`Failed to start MCP server: ${err.message}`);
            httpServer = undefined;
            serverToken = undefined;
            reject(err);
        });
    });
}

export function stopMcpServer(): void {
    if (!httpServer) {
        vscode.window.showInformationMessage('MCP SSE server is not running');
        return;
    }
    for (const id of Object.keys(transports)) {
        transports[id].close();
        delete transports[id];
    }
    httpServer.close();
    httpServer = undefined;
    mcpServer = undefined;
    serverToken = undefined;
    gDebugLog.info('MCP SSE server stopped');
    vscode.window.showInformationMessage('EDK2 MCP SSE server stopped');
}

export function isMcpServerRunning(): boolean {
    return httpServer !== undefined;
}
