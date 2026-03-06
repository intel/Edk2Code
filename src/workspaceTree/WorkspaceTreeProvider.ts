import * as vscode from 'vscode';
import * as path from 'path';
import { EdkWorkspace, IncludeNode } from '../index/edkWorkspace';
import { getParser } from '../edkParser/parserFactory';
import { EdkSymbol } from '../symbols/edkSymbols';
import { Edk2SymbolType } from '../symbols/symbolsType';
import { gConfigAgent, gEdkWorkspaces } from '../extension';

// ─── DSC symbol types available for filtering ─────────────────────────────────

export const DSC_FILTER_TYPES: { type: Edk2SymbolType; label: string; description: string }[] = [
    { type: Edk2SymbolType.dscDefine,            label: 'Defines',            description: 'dscDefine' },
    { type: Edk2SymbolType.dscLibraryDefinition, label: 'Library classes',    description: 'dscLibraryDefinition' },
    { type: Edk2SymbolType.dscModuleDefinition,  label: 'Components',         description: 'dscModuleDefinition' },
    { type: Edk2SymbolType.dscSection,           label: 'Sections',           description: 'dscSection' },
    { type: Edk2SymbolType.dscPcdDefinition,     label: 'PCDs',               description: 'dscPcdDefinition' },
    { type: Edk2SymbolType.dscInclude,           label: 'Include directives', description: 'dscInclude' },
];

// ─── Symbol kind → codicon mapping ───────────────────────────────────────────

function symbolKindIcon(kind: vscode.SymbolKind): vscode.ThemeIcon {
    const map: Partial<Record<vscode.SymbolKind, string>> = {
        [vscode.SymbolKind.File]:        'symbol-file',
        [vscode.SymbolKind.Module]:      'symbol-module',
        [vscode.SymbolKind.Namespace]:   'symbol-namespace',
        [vscode.SymbolKind.Package]:     'symbol-package',
        [vscode.SymbolKind.Class]:       'symbol-class',
        [vscode.SymbolKind.Method]:      'symbol-method',
        [vscode.SymbolKind.Property]:    'symbol-property',
        [vscode.SymbolKind.Field]:       'symbol-field',
        [vscode.SymbolKind.Constructor]: 'symbol-constructor',
        [vscode.SymbolKind.Enum]:        'symbol-enum',
        [vscode.SymbolKind.Interface]:   'symbol-interface',
        [vscode.SymbolKind.Function]:    'symbol-function',
        [vscode.SymbolKind.Variable]:    'symbol-variable',
        [vscode.SymbolKind.Constant]:    'symbol-constant',
        [vscode.SymbolKind.String]:      'symbol-string',
        [vscode.SymbolKind.Number]:      'symbol-number',
        [vscode.SymbolKind.Boolean]:     'symbol-boolean',
        [vscode.SymbolKind.Array]:       'symbol-array',
        [vscode.SymbolKind.Object]:      'symbol-object',
        [vscode.SymbolKind.Key]:         'symbol-key',
        [vscode.SymbolKind.Null]:        'symbol-null',
        [vscode.SymbolKind.EnumMember]:  'symbol-enum-member',
        [vscode.SymbolKind.Struct]:      'symbol-struct',
        [vscode.SymbolKind.Event]:       'symbol-event',
        [vscode.SymbolKind.Operator]:    'symbol-operator',
        [vscode.SymbolKind.TypeParameter]: 'symbol-type-parameter',
    };
    return new vscode.ThemeIcon(map[kind] ?? 'circle-small');
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

// ─── Tree Item: Workspace root (the main DSC) ────────────────────────────────

export class WorkspaceRootItem extends vscode.TreeItem {
    public readonly treePath: string[];

    constructor(public readonly workspace: EdkWorkspace) {
        const label = path.basename(workspace.mainDsc.fsPath);
        super(label, vscode.TreeItemCollapsibleState.Expanded);
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

    constructor(public readonly node: IncludeNode, parentPath: string[]) {
        const label = path.basename(node.uri.fsPath);
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.treePath = [...parentPath, vscode.workspace.asRelativePath(node.uri, false)];
        this.description = vscode.workspace.asRelativePath(node.uri, false);
        this.tooltip = new vscode.MarkdownString(
            `**Included file**\n\n\`${node.uri.fsPath}\`\n\n` +
            `Directive at: \`${node.location.uri.fsPath}:${node.location.range.start.line + 1}\``
        );
        this.iconPath = new vscode.ThemeIcon('file');
        this.contextValue = 'includeNode';
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

    constructor(
        public readonly symbol: EdkSymbol,
        public readonly fileUri: vscode.Uri,
        activeFilters: Set<Edk2SymbolType>,
        parentPath: string[]
    ) {
        const visibleChildren = symbol.children.filter(
            c => activeFilters.has((c as EdkSymbol).type)
        );
        const isDscInclude = symbol.type === Edk2SymbolType.dscInclude;
        super(
            symbol.name,
            visibleChildren.length > 0 || isDscInclude
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
        this.treePath = [...parentPath, symbol.name];
        this.symbolType = symbol.type;
        this.description = symbol.detail || undefined;
        this.tooltip = symbol.name;
        this.iconPath = symbolKindIcon(symbol.kind);
        this.contextValue = 'symbolNode';
        // Clicking navigates to the symbol's location in its file
        this.command = {
            command: 'edk2code.gotoFile',
            title: 'Go to symbol',
            arguments: [fileUri, symbol.selectionRange]
        };
    }
}

type WorkspaceTreeNode = WorkspaceRootItem | IncludeTreeItem | DocumentSymbolItem;

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

async function serializeSymbol(symbol: EdkSymbol, fileUri: vscode.Uri, indent: string, filter: Set<Edk2SymbolType>): Promise<string> {
    const line = `${indent}${symbol.name}${symbol.detail ? '  - ' + symbol.detail : ''}\n`;
    let out = line;
    for (const child of symbol.children) {
        const edkChild = child as EdkSymbol;
        if (filter.has(edkChild.type)) {
            out += await serializeSymbol(edkChild, fileUri, indent + '  ', filter);
        }
    }
    return out;
}

async function serializeIncludeNode(node: IncludeNode, indent: string, filter: Set<Edk2SymbolType>): Promise<string> {
    const rel = vscode.workspace.asRelativePath(node.uri, false);
    let out = `${indent}!include ${rel}\n`;
    const symbols = await loadSymbols(node.uri);
    for (const sym of symbols) {
        if (filter.has(sym.type)) {
            out += await serializeSymbol(sym, node.uri, indent + '  ', filter);
        }
    }
    for (const child of node.children) {
        out += await serializeIncludeNode(child, indent + '  ', filter);
    }
    return out;
}

// ─── Tree data provider ───────────────────────────────────────────────────────

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeNode> {
    private _onDidChangeTreeData =
        new vscode.EventEmitter<WorkspaceTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

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

        const rootSymbols = await loadSymbols(ws.mainDsc);
        for (const sym of rootSymbols) {
            if (this._activeFilters.has(sym.type)) {
                out += await serializeSymbol(sym, ws.mainDsc, '  ', this._activeFilters);
            }
        }
        for (const node of ws.includeTree) {
            out += await serializeIncludeNode(node, '  ', this._activeFilters);
        }
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

        // Root level: the single WorkspaceRootItem for the active workspace
        if (!element) {
            const ws = workspaces[this._activeIndex];
            if (!ws) { return []; }
            return [new WorkspaceRootItem(ws)];
        }

        // Under the workspace root: symbols of the main DSC
        if (element instanceof WorkspaceRootItem) {
            const symbols = await loadSymbols(element.workspace.mainDsc);
            return symbols
                .filter(s => this._activeFilters.has(s.type))
                .map(s => new DocumentSymbolItem(s, element.workspace.mainDsc, this._activeFilters, element.treePath));
        }

        // Under an include node: symbols of that file only
        if (element instanceof IncludeTreeItem) {
            const symbols = await loadSymbols(element.node.uri);
            return symbols
                .filter(s => this._activeFilters.has(s.type))
                .map(s => new DocumentSymbolItem(s, element.node.uri, this._activeFilters, element.treePath));
        }

        // Under a symbol: for !include directives expand into the included file;
        // for all other symbols expand their parsed children.
        if (element instanceof DocumentSymbolItem) {
            if (element.symbolType === Edk2SymbolType.dscInclude) {
                const ws = gEdkWorkspaces.workspaces[this._activeIndex];
                if (ws) {
                    const node = findIncludeNode(ws.includeTree, element.symbol.location);
                    if (node) {
                        const symbols = await loadSymbols(node.uri);
                        return symbols
                            .filter(s => this._activeFilters.has(s.type))
                            .map(s => new DocumentSymbolItem(s, node.uri, this._activeFilters, element.treePath));
                    }
                }
            }
            return (element.symbol.children as EdkSymbol[])
                .filter(c => this._activeFilters.has(c.type))
                .map(child => new DocumentSymbolItem(child, element.fileUri, this._activeFilters, element.treePath));
        }

        return [];
    }
}
