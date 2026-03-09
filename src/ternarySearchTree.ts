import * as vscode from 'vscode';
import { gDebugLog, gWorkspacePath } from './extension';

/**
 * A node in the Ternary Search Tree.
 * Each node stores a single character and branches into three children:
 *   left  – characters less than this node's character
 *   mid   – next character in the same key
 *   right – characters greater than this node's character
 * 
 * When `isEnd` is true the path from the root through mid-pointers
 * spells out a complete key, and `values` holds the associated URIs.
 */
interface TSTNode {
    char: string;
    left: TSTNode | null;
    mid: TSTNode | null;
    right: TSTNode | null;
    isEnd: boolean;
    values: vscode.Uri[];
}

/**
 * Ternary Search Tree used as a temporary in-memory file index.
 *
 * Built when the workspace is cleared and being rebuilt so that
 * `PathFind.findPath` can resolve file names without waiting for
 * `vscode.workspace.findFiles` (which may be slow / stale during
 * a rebuild).
 *
 * Keys are **lower-cased file basenames** so look-ups are
 * case-insensitive.  Each key maps to one or more `vscode.Uri`s.
 */
export class TernarySearchTree {
    private root: TSTNode | null = null;
    private _size: number = 0;

    /** Number of unique keys stored in the tree. */
    get size(): number {
        return this._size;
    }

    // ── Insertion ────────────────────────────────────────────────

    /**
     * Insert a key → value pair into the tree.
     * If the key already exists the value is appended to its list.
     */
    insert(key: string, value: vscode.Uri): void {
        if (key.length === 0) { return; }
        this.root = this._insert(this.root, key, value, 0);
    }

    private _insert(node: TSTNode | null, key: string, value: vscode.Uri, idx: number): TSTNode {
        const ch = key[idx];

        if (node === null) {
            node = { char: ch, left: null, mid: null, right: null, isEnd: false, values: [] };
        }

        if (ch < node.char) {
            node.left = this._insert(node.left, key, value, idx);
        } else if (ch > node.char) {
            node.right = this._insert(node.right, key, value, idx);
        } else if (idx < key.length - 1) {
            node.mid = this._insert(node.mid, key, value, idx + 1);
        } else {
            if (!node.isEnd) {
                node.isEnd = true;
                this._size++;
            }
            node.values.push(value);
        }

        return node;
    }

    // ── Exact-match search ───────────────────────────────────────

    /**
     * Return all URIs associated with `key`, or an empty array if not found.
     */
    search(key: string): vscode.Uri[] {
        if (key.length === 0) { return []; }
        const node = this._search(this.root, key, 0);
        if (node && node.isEnd) {
            return node.values;
        }
        return [];
    }

    private _search(node: TSTNode | null, key: string, idx: number): TSTNode | null {
        if (node === null) { return null; }

        const ch = key[idx];

        if (ch < node.char) {
            return this._search(node.left, key, idx);
        } else if (ch > node.char) {
            return this._search(node.right, key, idx);
        } else if (idx < key.length - 1) {
            return this._search(node.mid, key, idx + 1);
        } else {
            return node;
        }
    }

    // ── Bulk build ───────────────────────────────────────────────

    /**
     * Scan *all* files in the workspace and index them by their
     * lower-cased basename.  Returns the number of files indexed.
     */
    async buildFromWorkspace(): Promise<number> {
        const startTime = Date.now();
        gDebugLog.info('TernarySearchTree: building file index from workspace…');

        // findFiles with ** grabs every file in the workspace
        const allFiles = await vscode.workspace.findFiles('**/*', null);

        for (const uri of allFiles) {
            const baseName = this.baseName(uri);
            this.insert(baseName, uri);
        }

        const elapsed = Date.now() - startTime;
        gDebugLog.info(`TernarySearchTree: indexed ${allFiles.length} files (${this._size} unique names) in ${elapsed} ms`);
        return allFiles.length;
    }

    // ── Helpers ──────────────────────────────────────────────────

    /**
     * Return the lower-cased basename of a URI (case-insensitive keys).
     */
    private baseName(uri: vscode.Uri): string {
        const segments = uri.fsPath.split(/[\\/]/);
        return (segments[segments.length - 1] || '').toLowerCase();
    }

    /**
     * Look up a file by its basename string (case-insensitive).
     */
    findFilesByName(fileName: string): vscode.Uri[] {
        return this.search(fileName.toLowerCase());
    }

    /**
     * Clear the tree and release memory.
     */
    dispose(): void {
        this.root = null;
        this._size = 0;
    }
}
