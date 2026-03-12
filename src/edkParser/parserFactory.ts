import * as vscode from 'vscode';
import { gDebugLog } from "../extension";
import { DscParser } from "./dscParser";
import { FdfParser } from "./fdfParser";
import { InfParser } from "./infParser";
import { DecParser } from './decParser';
import { VfrParser } from './vfrParser';
import { AslParser } from './aslParser';
import { openTextDocument } from '../utils';
import { DiagnosticManager } from '../diagnostics';
import { Debouncer } from '../debouncer';
import { DocumentParser } from './languageParser';

interface ParserCacheEntry {
    parser: DocumentParser;
    mtime: number;
}

const parserCache = new Map<string, ParserCacheEntry>();

export function invalidateParserCache(uri: vscode.Uri): void {
    parserCache.delete(uri.toString());
}

export function clearParserCache(): void {
    parserCache.clear();
}

/**
 * Instantiates the appropriate parser for the given document based on its language ID.
 * Returns `undefined` for unsupported language types.
 */
function createParserInstance(document: vscode.TextDocument): DocumentParser | undefined {
    switch (document.languageId) {
        case "asl":       return new AslParser(document);
        case "edk2_dsc":  return new DscParser(document);
        case "edk2_dec":  return new DecParser(document);
        case "edk2_vfr":  return new VfrParser(document);
        case "edk2_fdf":  return new FdfParser(document);
        case "edk2_inf":  return new InfParser(document);
        case "edk2_uni":  return undefined;
        default:
            gDebugLog.error(`Document parser not supported: ${document.fileName}`);
            return undefined;
    }
}

/**
 * Returns a parsed `DocumentParser` for the given `TextDocument`.
 * Results are cached by URI + mtime; if the file has not changed since the last
 * parse the cached instance is returned immediately without re-parsing.
 */
export async function getParserForDocument(document: vscode.TextDocument): Promise<DocumentParser | undefined> {
    const uri = document.uri;
    const key = uri.toString();

    // Retrieve the file modification time
    let mtime: number | undefined;
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        mtime = stat.mtime;
    } catch {
        // File may not exist on disk (e.g. untitled); skip caching
    }

    // Return cached parser when the file has not been modified
    if (mtime !== undefined) {
        const cached = parserCache.get(key);
        if (cached && cached.mtime === mtime) {
            gDebugLog.trace(`Parser cache hit: ${uri.fsPath}`);
            return cached.parser;
        }
    }

    const parser = createParserInstance(document);
    if (parser) {
        await parser.parseFile();

        // Store in cache only when we have a valid mtime
        if (mtime !== undefined) {
            parserCache.set(key, { parser, mtime });
        }
    }
    return parser;
}

/**
 * Convenience wrapper: opens the file at `uri` and returns its cached/parsed
 * `DocumentParser`. Delegates to `getParserForDocument` after opening the document.
 */
export async function getParser(uri: vscode.Uri): Promise<DocumentParser | undefined> {
    const document = await openTextDocument(uri);
    return getParserForDocument(document);
}

