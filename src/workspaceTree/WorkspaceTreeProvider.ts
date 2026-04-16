import * as vscode from 'vscode';
import * as path from 'path';
import { EdkWorkspace, IncludeNode } from '../index/edkWorkspace';
import { getParser } from '../edkParser/parserFactory';
import { EdkSymbol } from '../symbols/edkSymbols';
import { Edk2SymbolType } from '../symbols/symbolsType';
import { edkWorkspaceTreeView, gConfigAgent, gEdkWorkspaces } from '../extension';
import { DiagnosticManager, EdkDiagnosticCodes } from '../diagnostics';

// ─── DSC symbol types available for filtering ─────────────────────────────────

export const DSC_FILTER_TYPES: { type: Edk2SymbolType; label: string; description: string }[] = [
    { type: Edk2SymbolType.dscDefine,              label: 'Defines',              description: 'dscDefine' },
    { type: Edk2SymbolType.dscLibraryDefinition,   label: 'Library classes',      description: 'dscLibraryDefinition' },
    { type: Edk2SymbolType.dscModuleDefinition,    label: 'Components',           description: 'dscModuleDefinition' },
    { type: Edk2SymbolType.dscSection,             label: 'Sections',             description: 'dscSection' },
    { type: Edk2SymbolType.dscBuildOptionsSection, label: 'Build options',        description: 'dscBuildOptionsSection' },
    { type: Edk2SymbolType.dscBuildOption,         label: 'Build option entries', description: 'dscBuildOption' },
    { type: Edk2SymbolType.dscPcdDefinition,       label: 'PCDs',                 description: 'dscPcdDefinition' },
    { type: Edk2SymbolType.dscInclude,             label: 'Include directives',   description: 'dscInclude' },
    { type: Edk2SymbolType.showInactiveNodes,      label: 'Inactive elements',    description: 'Show elements inside inactive !if/!else blocks' },
];

// Structural / container types that are always visible in the tree regardless of
// the user's filter selection.  These types exist only to group children and
// filtering them out would hide all their descendants.
const STRUCTURAL_TYPES = new Set<Edk2SymbolType>([
    Edk2SymbolType.dscComponentSubSection,
]);

/** Returns true when a symbol type should be shown in the tree. */
function isTypeVisible(type: Edk2SymbolType, activeFilters: Set<Edk2SymbolType>): boolean {
    return activeFilters.has(type) || STRUCTURAL_TYPES.has(type);
}

/**
 * Returns true when the symbol's selection range falls inside any of the
 * grayout (inactive conditional) ranges for its file.
 */
function isSymbolInactive(symbol: EdkSymbol, fileUri: vscode.Uri, workspace: EdkWorkspace | undefined): boolean {
    if (!workspace) { return false; }
    const grayoutRanges = workspace.getGrayoutRangeByUri(fileUri);
    const symLine = symbol.selectionRange.start.line;
    return grayoutRanges.some(r => symLine >= r.start.line && symLine <= r.end.line);
}

/**
 * If the symbol has a duplicateDefine or duplicateStatement diagnostic,
 * returns the location of the definition that overwrites it (from relatedInformation).
 */
function getOverwriteLocation(symbol: EdkSymbol, fileUri: vscode.Uri): vscode.Location | undefined {
    const diag = DiagnosticManager.findDiagnosticAt(
        fileUri,
        symbol.selectionRange.start.line,
        [EdkDiagnosticCodes.duplicateDefine, EdkDiagnosticCodes.duplicateStatement]
    );
    if (!diag?.relatedInformation?.length) { return undefined; }
    return diag.relatedInformation[0].location;
}

// ─── Helper: load symbols for a URI via the parser ───────────────────────────

async function loadSymbols(uri: vscode.Uri): Promise<EdkSymbol[]> {
    try {
        const parser = await getParser(uri);
        return (parser?.symbolsTree ?? []) as EdkSymbol[];
    } catch {
        return [];
    }
}

// ─── Helper: collect all file URIs reachable in an include tree ───────────────

function collectIncludeUris(nodes: IncludeNode[], out: Set<string>): void {
    for (const node of nodes) {
        out.add(node.uri.fsPath);
        collectIncludeUris(node.children, out);
    }
}

/**
 * Returns true when the given URI is the main DSC or any file included
 * (directly or transitively) in at least one workspace of the provided list.
 */
export function isFileInWorkspaceTree(uri: vscode.Uri, workspaces: EdkWorkspace[]): boolean {
    for (const ws of workspaces) {
        if (ws.mainDsc.fsPath === uri.fsPath) { return true; }
        const uris = new Set<string>();
        collectIncludeUris(ws.includeTree, uris);
        if (uris.has(uri.fsPath)) { return true; }
    }
    return false;
}

/**
 * Returns true when the given INF URI is referenced as a module or library
 * in at least one loaded workspace.
 * Uses the same path-suffix check that EdkWorkspace.isFileInUse() performs.
 */
export function isInfInWorkspaces(uri: vscode.Uri, workspaces: EdkWorkspace[]): boolean {
    for (const ws of workspaces) {
        for (const mod of ws.filesModules) {
            if (uri.fsPath.includes(mod.path)) { return true; }
        }
        for (const lib of ws.filesLibraries) {
            if (uri.fsPath.includes(lib.path)) { return true; }
        }
    }
    return false;
}

// ─── Tree Item: Workspace root (the main DSC) ────────────────────────────────

export class WorkspaceRootItem extends vscode.TreeItem {
    public readonly treePath: string[];

    constructor(public readonly workspace: EdkWorkspace, public readonly wsIndex: number) {
        const label = path.basename(workspace.mainDsc.fsPath);
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.id = `wsr:${wsIndex}`;
        this.treePath = [label];
        this.description = workspace.platformName ?? '';
        this.tooltip = new vscode.MarkdownString(
            `**Workspace root**\n\n\`${workspace.mainDsc.fsPath}\``
        );
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.contextValue = 'workspaceRoot';
        this.command = {
            command: 'vscode.open',
            title: 'Open DSC',
            arguments: [workspace.mainDsc]
        };
    }
}

// ─── Tree Item: An !include node inside the tree ──────────────────────────────

export class IncludeTreeItem extends vscode.TreeItem {
    public readonly treePath: string[];
    public readonly inactive: boolean;

    constructor(public readonly node: IncludeNode, parentPath: string[], inactive: boolean = false) {
        const label = path.basename(node.uri.fsPath);
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.inactive = inactive;
        this.treePath = [...parentPath, vscode.workspace.asRelativePath(node.uri, false)];
        this.description = inactive
            ? `${vscode.workspace.asRelativePath(node.uri, false)}  (inactive)`
            : vscode.workspace.asRelativePath(node.uri, false);
        this.tooltip = new vscode.MarkdownString(
            `**Included file**${inactive ? ' *(inactive)*' : ''}\n\n\`${node.uri.fsPath}\`\n\n` +
            `Directive at: \`${node.location.uri.fsPath}:${node.location.range.start.line + 1}\``
        );
        this.iconPath = inactive
            ? new vscode.ThemeIcon('file', new vscode.ThemeColor('disabledForeground'))
            : new vscode.ThemeIcon('file');
        this.contextValue = inactive ? 'includeNodeInactive' : 'includeNode';
        // Clicking jumps to the !include directive in the parent file
        this.command = {
            command: 'edk2code.gotoFile',
            title: 'Go to !include directive',
            arguments: [node.location.uri, node.location.range]
        };
    }
}

// ─── Tree Item: A document symbol (outline entry) inside a file ──────────────

export class DocumentSymbolItem extends vscode.TreeItem {
    public readonly symbolType: Edk2SymbolType;
    public readonly treePath: string[];
    public readonly inactive: boolean;
    public readonly overwrittenBy: vscode.Location | undefined;

    constructor(
        public readonly symbol: EdkSymbol,
        public readonly fileUri: vscode.Uri,
        activeFilters: Set<Edk2SymbolType>,
        parentPath: string[],
        public readonly parent: WorkspaceRootItem | DocumentSymbolItem | undefined,
        inactive: boolean = false,
        overwrittenBy?: vscode.Location
    ) {
        const visibleChildren = symbol.children.filter(
            c => isTypeVisible((c as EdkSymbol).type, activeFilters)
        );
        const isDscInclude = symbol.type === Edk2SymbolType.dscInclude;
        super(
            symbol.name,
            visibleChildren.length > 0 || isDscInclude
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
        this.inactive = inactive;
        this.overwrittenBy = overwrittenBy;
        this.treePath = [...parentPath, symbol.name];
        // Include the parent path in the id so the same file/symbol included from
        // multiple places in the tree gets a unique id for each occurrence.
        const parentKey = parentPath.join('/');
        this.id = `dsi:${parentKey}:${fileUri.fsPath}:${symbol.selectionRange.start.line}:${symbol.selectionRange.start.character}`;
        this.symbolType = symbol.type;

        // Build description and context based on state
        const isOverwritten = !!overwrittenBy;
        let desc = symbol.detail || '';
        let ctx = 'symbolNode';
        if (inactive && isOverwritten) {
            desc = `${desc}  (inactive, overwritten)`.trim();
            ctx = 'symbolNodeInactiveOverwritten';
        } else if (inactive) {
            desc = `${desc}  (inactive)`.trim();
            ctx = 'symbolNodeInactive';
        } else if (isOverwritten) {
            desc = `${desc}  (overwritten)`.trim();
            ctx = 'symbolNodeOverwritten';
        }
        this.description = desc || undefined;

        if (isOverwritten) {
            const relPath = vscode.workspace.asRelativePath(overwrittenBy.uri, false);
            const line = overwrittenBy.range.start.line + 1;
            this.tooltip = new vscode.MarkdownString(
                `~~${symbol.name}~~ *(overwritten)*\n\nOverwritten by: \`${relPath}:${line}\``
            );
        } else {
            this.tooltip = inactive ? `${symbol.name} (inactive)` : symbol.name;
        }

        if (inactive || isOverwritten) {
            this.iconPath = new vscode.ThemeIcon(
                EdkSymbol.iconForKind(symbol.kind).id,
                new vscode.ThemeColor('disabledForeground')
            );
        } else {
            this.iconPath = EdkSymbol.iconForKind(symbol.kind);
        }

        this.contextValue = ctx;
        // Clicking navigates to the symbol's location in its file
        this.command = {
            command: 'edk2code.gotoFile',
            title: 'Go to symbol',
            arguments: [fileUri, symbol.selectionRange]
        };
    }
}

export type WorkspaceTreeNode = WorkspaceRootItem | IncludeTreeItem | DocumentSymbolItem;

// ─── Helper: find an IncludeNode by the location of its !include directive ───

function findIncludeNode(nodes: IncludeNode[], location: vscode.Location): IncludeNode | undefined {
    for (const node of nodes) {
        if (node.location.uri.fsPath === location.uri.fsPath &&
            node.location.range.start.line === location.range.start.line) {
            return node;
        }
        const found = findIncludeNode(node.children, location);
        if (found) { return found; }
    }
    return undefined;
}

// ─── Recursive text serializer ───────────────────────────────────────────────

async function resolveIncludedUri(symbol: EdkSymbol): Promise<vscode.Uri | undefined> {
    if (symbol.type !== Edk2SymbolType.dscInclude || !symbol.onDefinition) {
        return undefined;
    }
    const locations = await Promise.resolve(symbol.onDefinition(symbol.parser)) as vscode.Location[] | undefined;
    return locations?.[0]?.uri;
}

async function serializeFileSymbols(
    fileUri: vscode.Uri,
    indent: string,
    filter: Set<Edk2SymbolType>,
    expandedFiles: Set<string>
): Promise<string> {
    const symbols = await loadSymbols(fileUri);
    let out = '';
    for (const sym of symbols) {
        if (isTypeVisible(sym.type, filter)) {
            out += await serializeSymbol(sym, indent, filter, expandedFiles);
        }
    }
    return out;
}

async function serializeSymbol(
    symbol: EdkSymbol,
    indent: string,
    filter: Set<Edk2SymbolType>,
    expandedFiles: Set<string>
): Promise<string> {
    const line = `${indent}${symbol.name}${symbol.detail ? '  - ' + symbol.detail : ''}\n`;
    let out = line;
    if (symbol.type === Edk2SymbolType.dscInclude) {
        const includeUri = await resolveIncludedUri(symbol);
        if (!includeUri || expandedFiles.has(includeUri.fsPath)) {
            return out;
        }
        const nextExpandedFiles = new Set(expandedFiles);
        nextExpandedFiles.add(includeUri.fsPath);
        out += await serializeFileSymbols(includeUri, indent + '  ', filter, nextExpandedFiles);
        return out;
    }
    for (const child of symbol.children) {
        const edkChild = child as EdkSymbol;
        if (isTypeVisible(edkChild.type, filter)) {
            out += await serializeSymbol(edkChild, indent + '  ', filter, expandedFiles);
        }
    }
    return out;
}

// ─── Helper: find the deepest filtered symbol that contains a position ────────

function findDeepestSymbolAt(
    symbols: EdkSymbol[],
    position: vscode.Position,
    filter: Set<Edk2SymbolType>
): EdkSymbol | undefined {
    let best: EdkSymbol | undefined;
    for (const sym of symbols) {
        if (!isTypeVisible(sym.type, filter)) { continue; }
        const inRange = sym.range.contains(position) || sym.selectionRange.contains(position);
        if (inRange) {
            best = sym;
            const deeper = findDeepestSymbolAt(sym.children as EdkSymbol[], position, filter);
            if (deeper) { best = deeper; }
        }
    }
    // Fallback: if no symbol contains the position, return the one closest by line
    if (!best) {
        let closestDist = Infinity;
        for (const sym of symbols) {
            if (!isTypeVisible(sym.type, filter)) { continue; }
            const dist = Math.abs(sym.selectionRange.start.line - position.line);
            if (dist < closestDist) {
                closestDist = dist;
                best = sym;
            }
        }
    }
    return best;
}

// ─── Tree data provider ───────────────────────────────────────────────────────

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeNode>, vscode.TreeDragAndDropController<WorkspaceTreeNode> {
    private _onDidChangeTreeData =
        new vscode.EventEmitter<WorkspaceTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // ─── Drag & Drop ──────────────────────────────────────────────────────────
    readonly dropMimeTypes: string[] = ['application/vnd.code.tree.workspaceview'];
    readonly dragMimeTypes: string[] = ['application/vnd.code.tree.workspaceview'];

    /** Stashed source info from the last drag operation. */
    private _draggedSource: { fileUri: vscode.Uri; range: vscode.Range } | undefined;

    handleDrag(
        source: readonly WorkspaceTreeNode[],
        _dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): void {
        const item = source.find(
            (s): s is DocumentSymbolItem => s instanceof DocumentSymbolItem
        );
        if (!item) {
            this._draggedSource = undefined;
            return;
        }
        this._draggedSource = { fileUri: item.fileUri, range: item.symbol.range };
    }

    async handleDrop(
        target: WorkspaceTreeNode | undefined,
        _dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const source = this._draggedSource;
        this._draggedSource = undefined;
        if (!source || !target) { return; }
        if (!(target instanceof DocumentSymbolItem)) { return; }

        const targetRange = target.symbol.range;

        // Skip dropping onto itself
        if (
            source.fileUri.fsPath === target.fileUri.fsPath &&
            source.range.isEqual(targetRange)
        ) {
            return;
        }

        const sourceDoc = await vscode.workspace.openTextDocument(source.fileUri);

        // Read full lines of the source symbol
        const srcStart = source.range.start.line;
        const srcEnd = source.range.end.line;
        let textToMove = '';
        for (let i = srcStart; i <= srcEnd; i++) {
            textToMove += sourceDoc.lineAt(i).text + '\n';
        }

        // Delete range: whole lines
        const deleteRange = srcEnd + 1 < sourceDoc.lineCount
            ? new vscode.Range(srcStart, 0, srcEnd + 1, 0)
            : new vscode.Range(
                  srcStart === 0 ? 0 : srcStart - 1,
                  srcStart === 0 ? 0 : sourceDoc.lineAt(srcStart - 1).text.length,
                  srcEnd,
                  sourceDoc.lineAt(srcEnd).text.length
              );

        // Insert right after the target symbol's last line
        const targetDoc = await vscode.workspace.openTextDocument(target.fileUri);
        const tgtEnd = targetRange.end.line;
        let insertPos: vscode.Position;
        let insertText: string;

        if (tgtEnd + 1 < targetDoc.lineCount) {
            insertPos = new vscode.Position(tgtEnd + 1, 0);
            insertText = textToMove;
        } else {
            insertPos = new vscode.Position(tgtEnd, targetDoc.lineAt(tgtEnd).text.length);
            insertText = '\n' + textToMove.replace(/\n$/, '');
        }

        const edit = new vscode.WorkspaceEdit();
        edit.delete(source.fileUri, deleteRange);
        edit.insert(target.fileUri, insertPos, insertText);
        await vscode.workspace.applyEdit(edit);

        // Refresh tree and reveal the target symbol
        this.refresh();
        const tgtPosition = target.symbol.selectionRange.start;
        await this.revealLocation(target.fileUri, tgtPosition, edkWorkspaceTreeView);
    }

    private _activeIndex: number = 0;

    /** Which DSC symbol types are currently visible. Loaded from config; defaults to all. */
    private _activeFilters: Set<Edk2SymbolType> = (() => {
        const saved = gConfigAgent.getWorkspaceTreeFilters();
        if (saved && saved.length > 0) {
            return new Set<Edk2SymbolType>(saved as Edk2SymbolType[]);
        }
        return new Set<Edk2SymbolType>(DSC_FILTER_TYPES.map(f => f.type));
    })();

    get activeIndex(): number {
        return this._activeIndex;
    }

    refresh(): void {
        // Clamp index in case workspaces were removed
        const max = Math.max(0, gEdkWorkspaces.workspaces.length - 1);
        this._activeIndex = Math.min(this._activeIndex, max);
        this._onDidChangeTreeData.fire();
    }

    /**
     * Switch the displayed workspace and refresh the view.
     */
    selectWorkspace(index: number): void {
        this._activeIndex = index;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Show a multi-select Quick Pick to toggle which DSC symbol types are shown.
     */
    async showFilterPicker(): Promise<void> {
        type FilterPickItem = vscode.QuickPickItem & { type: Edk2SymbolType };
        const items: FilterPickItem[] = DSC_FILTER_TYPES.map(f => ({
            label: f.label,
            description: f.description,
            picked: this._activeFilters.has(f.type),
            type: f.type
        }));

        const picked = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select symbol types to show',
            title: 'EDK2: Filter workspace symbols'
        });

        // Cancelled → leave filter unchanged
        if (picked === undefined) { return; }

        this._activeFilters = new Set(picked.map(p => p.type));
        gConfigAgent.setWorkspaceTreeFilters([...this._activeFilters]);
        this._onDidChangeTreeData.fire();
    }

    /**
     * Serialize the whole displayed workspace tree to an indented string.
     */
    async serializeTree(): Promise<string> {
        const ws = gEdkWorkspaces.workspaces[this._activeIndex];
        if (!ws) { return ''; }

        const rootLabel = path.basename(ws.mainDsc.fsPath);
        const rel = vscode.workspace.asRelativePath(ws.mainDsc, false);
        let out = `${rootLabel}  (${rel})\n`;
        out += await serializeFileSymbols(ws.mainDsc, '  ', this._activeFilters, new Set([ws.mainDsc.fsPath]));
        return out;
    }

    getTreeItem(element: WorkspaceTreeNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkspaceTreeNode): Promise<WorkspaceTreeNode[]> {
        const workspaces = gEdkWorkspaces.workspaces;
        if (workspaces.length === 0) {
            return [];
        }

        const ws = workspaces[this._activeIndex];

        // Root level: the single WorkspaceRootItem for the active workspace
        if (!element) {
            if (!ws) { return []; }
            return [new WorkspaceRootItem(ws, this._activeIndex)];
        }

        const showInactive = this._activeFilters.has(Edk2SymbolType.showInactiveNodes);

        // Under the workspace root: symbols of the main DSC
        if (element instanceof WorkspaceRootItem) {
            const symbols = await loadSymbols(element.workspace.mainDsc);
            return symbols
                .filter(s => isTypeVisible(s.type, this._activeFilters))
                .map(s => new DocumentSymbolItem(s, element.workspace.mainDsc, this._activeFilters, element.treePath, element,
                    isSymbolInactive(s, element.workspace.mainDsc, ws),
                    getOverwriteLocation(s, element.workspace.mainDsc)))
                .filter(s => showInactive || !s.inactive);
        }

        // Under an include node: symbols of that file only
        if (element instanceof IncludeTreeItem) {
            const inactive = element.inactive;
            const symbols = await loadSymbols(element.node.uri);
            return symbols
                .filter(s => isTypeVisible(s.type, this._activeFilters))
                .map(s => new DocumentSymbolItem(s, element.node.uri, this._activeFilters, element.treePath, undefined,
                    inactive || isSymbolInactive(s, element.node.uri, ws),
                    getOverwriteLocation(s, element.node.uri)))
                .filter(s => showInactive || !s.inactive);
        }

        // Under a symbol: for !include directives expand into the included file;
        // for all other symbols expand their parsed children.
        if (element instanceof DocumentSymbolItem) {
            if (element.symbolType === Edk2SymbolType.dscInclude) {
                if (ws) {
                    const node = findIncludeNode(ws.includeTree, element.symbol.location);
                    if (node) {
                        const symbols = await loadSymbols(node.uri);
                        return symbols
                            .filter(s => isTypeVisible(s.type, this._activeFilters))
                            .map(s => new DocumentSymbolItem(s, node.uri, this._activeFilters, element.treePath, element,
                                element.inactive || isSymbolInactive(s, node.uri, ws),
                                getOverwriteLocation(s, node.uri)))
                            .filter(s => showInactive || !s.inactive);
                    }
                }
            }
            return (element.symbol.children as EdkSymbol[])
                .filter(c => isTypeVisible(c.type, this._activeFilters))
                .map(child => new DocumentSymbolItem(child, element.fileUri, this._activeFilters, element.treePath, element,
                    element.inactive || isSymbolInactive(child, element.fileUri, ws),
                    getOverwriteLocation(child, element.fileUri)))
                .filter(s => showInactive || !s.inactive);
        }

        return [];
    }

    getParent(element: WorkspaceTreeNode): vscode.ProviderResult<WorkspaceTreeNode> {
        if (element instanceof WorkspaceRootItem) { return undefined; }
        if (element instanceof DocumentSymbolItem) { return element.parent; }
        return undefined;
    }

    /**
     * Reveal the tree node that best matches the symbol at the cursor in the active editor.
     */
    async revealActiveEditor(treeView: vscode.TreeView<WorkspaceTreeNode>): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            void vscode.window.showInformationMessage('No active editor.');
            return;
        }
        await this.revealLocation(editor.document.uri, editor.selection.active, treeView);
    }

    /**
     * Reveal the tree node that best matches the symbol at a specific location.
     */
    async revealLocation(
        uri: vscode.Uri,
        position: vscode.Position,
        treeView: vscode.TreeView<WorkspaceTreeNode>
    ): Promise<void> {
        // Load symbols for the file and find the deepest one at the position
        const symbols = await loadSymbols(uri);
        if (symbols.length === 0) {
            void vscode.window.showInformationMessage('No EDK2 symbols found in the active file.');
            return;
        }

        const target = findDeepestSymbolAt(symbols, position, this._activeFilters);
        if (!target) {
            void vscode.window.showInformationMessage('No EDK2 symbol found at the cursor position.');
            return;
        }

        // Traverse the tree to find the matching DocumentSymbolItem
        const rootItems = await this.getChildren(undefined);
        for (const root of rootItems) {
            const found = await this._findItemForSymbol(root, uri, target);
            if (found) {
                await treeView.reveal(found, { select: true, focus: false, expand: true });
                return;
            }
        }

        void vscode.window.showInformationMessage('Symbol not found in the workspace tree.');
    }

    /** Recursively walk the tree to find a DocumentSymbolItem matching (fileUri, targetSymbol). */
    private async _findItemForSymbol(
        parent: WorkspaceTreeNode,
        fileUri: vscode.Uri,
        targetSymbol: EdkSymbol
    ): Promise<DocumentSymbolItem | undefined> {
        const children = await this.getChildren(parent);
        for (const child of children) {
            if (
                child instanceof DocumentSymbolItem &&
                child.fileUri.fsPath === fileUri.fsPath &&
                child.symbol.selectionRange.start.line === targetSymbol.selectionRange.start.line &&
                child.symbol.selectionRange.start.character === targetSymbol.selectionRange.start.character
            ) {
                return child;
            }
            const found = await this._findItemForSymbol(child, fileUri, targetSymbol);
            if (found) { return found; }
        }
        return undefined;
    }
}
