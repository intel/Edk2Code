import * as vscode from 'vscode';
import * as path from 'path';
import { gEdkWorkspaces, gPathFind, gCompileCommands } from '../extension';
import { getParser } from '../edkParser/parserFactory';
import { EdkSymbol } from '../symbols/edkSymbols';
import { Edk2SymbolType } from '../symbols/symbolsType';
import { DocumentParser } from '../edkParser/languageParser';
import { rgSearch } from '../rg';

// ─── Tree item types ──────────────────────────────────────────────────────────

export class DriverInfoCategoryItem extends vscode.TreeItem {
    children: DriverInfoLeafItem[] = [];
    constructor(label: string, icon: string) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.contextValue = 'driverInfoCategory';
    }
}

export class DriverInfoLeafItem extends vscode.TreeItem {
    constructor(
        label: string,
        description: string,
        icon: vscode.ThemeIcon,
        command?: vscode.Command,
        fileUri?: vscode.Uri
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.iconPath = icon;
        if (fileUri) {
            this.resourceUri = fileUri;
            this.iconPath = vscode.ThemeIcon.File;
        }
        if (command) {
            this.command = command;
        }
    }
}

type DriverInfoNode = DriverInfoCategoryItem | DriverInfoLeafItem;

// ─── Provider ─────────────────────────────────────────────────────────────────

export class DriverInfoTreeProvider implements vscode.TreeDataProvider<DriverInfoNode> {

    private _onDidChangeTreeData = new vscode.EventEmitter<DriverInfoNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private categories: DriverInfoCategoryItem[] = [];
    private _infUri: vscode.Uri | undefined;
    private get infUri() { return this._infUri; }
    private set infUri(v: vscode.Uri | undefined) { this._infUri = v; }
    get currentInfUri(): vscode.Uri | undefined { return this._infUri; }
    private parser: DocumentParser | undefined;
    private _treeView: vscode.TreeView<DriverInfoNode> | undefined;

    /** Set the tree view reference so the provider can update its title. */
    setTreeView(treeView: vscode.TreeView<DriverInfoNode>) {
        this._treeView = treeView;
    }
    private disposables: vscode.Disposable[] = [];
    private _suppressNextUpdate = false;
    private _lastEditorFsPath: string | undefined;
    private _lastSuppressTime = 0;

    /** Call before programmatically opening a file to prevent the driver info from refreshing.
     *  Returns true if suppression was set (single click), false if double-click was detected. */
    suppressNextUpdate(): boolean {
        const now = Date.now();
        if (now - this._lastSuppressTime < 500) {
            // Double-click detected: cancel suppression so driver info updates
            this._suppressNextUpdate = false;
            this._lastSuppressTime = 0;
            return false;
        } else {
            this._suppressNextUpdate = true;
            this._lastSuppressTime = now;
            return true;
        }
    }

    constructor() {
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(async (editor) => {
                if (editor) {
                    if (!this._suppressNextUpdate) {
                        this._lastEditorFsPath = editor.document.uri.fsPath;
                    }
                    await this.onEditorChanged(editor);
                }
            }),
            vscode.window.onDidChangeTextEditorSelection(async (e) => {
                // Fires when the user clicks into an already-active editor (focus-back).
                // Only process if the document differs from what is currently displayed.
                if (e.textEditor.document.uri.fsPath !== this._lastEditorFsPath) {
                    this._lastEditorFsPath = e.textEditor.document.uri.fsPath;
                    await this.onEditorChanged(e.textEditor);
                }
            })
        );
    }

    dispose() {
        for (const d of this.disposables) { d.dispose(); }
    }

    getTreeItem(element: DriverInfoNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DriverInfoNode): DriverInfoNode[] {
        if (!element) {
            return this.categories;
        }
        if (element instanceof DriverInfoCategoryItem) {
            return element.children;
        }
        return [];
    }

    // ─── Editor change handler ────────────────────────────────────────────────

    async onEditorChanged(editor: vscode.TextEditor) {
        if (this._suppressNextUpdate) {
            this._suppressNextUpdate = false;
            return;
        }

        const document = editor.document;
        const langId = document.languageId;

        // Only process EDK-relevant files
        if (!['c', 'cpp', 'edk2_dsc', 'edk2_inf', 'edk2_dec', 'asl', 'edk2_vfr', 'edk2_fdf', 'edk2_uni'].includes(langId)) {
            this.clear();
            return;
        }

        // Check if file is in use
        if (gEdkWorkspaces.isConfigured()) {
            const isUsed = await gEdkWorkspaces.isFileInUse(document.uri);
            if (isUsed !== true) {
                this.clear();
                return;
            }
        }

        // Find the INF file
        const infUri = await this.findInfForFile(document.uri);
        if (!infUri) {
            this.clear();
            return;
        }

        // If same INF, no need to rebuild
        if (this.infUri && this.infUri.fsPath === infUri.fsPath) {
            return;
        }

        this.infUri = infUri;
        await this.buildTree();
    }

    // ─── Locate INF file ──────────────────────────────────────────────────────

    private async findInfForFile(fileUri: vscode.Uri): Promise<vscode.Uri | undefined> {
        // If the file itself is an INF
        if (fileUri.fsPath.match(/\.inf$/i)) {
            return fileUri;
        }

        const wps = await gEdkWorkspaces.getWorkspace(fileUri);
        if (wps.length) {
            for (const wp of wps) {
                const locations = await wp.getInfReference(fileUri);
                if (locations.length) {
                    return locations[0].uri;
                }
            }
        } else {
            // Fallback: search for INF file referencing this source
            const fileName = path.basename(fileUri.fsPath);
            const folderPath = path.dirname(fileUri.fsPath);
            const tempLocations = await rgSearch(`\\b${fileName}\\b`, ['*.inf'], [], true);
            for (const l of tempLocations) {
                if (!path.relative(path.dirname(l.uri.fsPath), folderPath).includes('..')) {
                    return l.uri;
                }
            }
        }
        return undefined;
    }

    // ─── Build tree from INF parser ───────────────────────────────────────────

    private async buildTree() {
        this.categories = [];

        if (!this.infUri) {
            this.refresh();
            return;
        }

        const parser = await getParser(this.infUri);
        if (!parser) {
            this.refresh();
            return;
        }
        this.parser = parser;

        await vscode.commands.executeCommand('setContext', 'edk2code.driverInfoAvailable', true);

        // Set view title to BASE_NAME
        const defines = parser.getSymbolsType(Edk2SymbolType.infDefine);
        let baseName = '';
        for (const def of defines) {
            const key = await def.getKey();
            if (key.toLowerCase() === 'base_name') {
                baseName = await def.getValue();
                break;
            }
        }
        if (this._treeView) {
            this._treeView.title = baseName || path.basename(this.infUri.fsPath);
        }

        // Defines
        if (defines.length) {
            const cat = new DriverInfoCategoryItem('Defines', 'symbol-constant');
            for (const def of defines) {
                const key = await def.getKey();
                const value = await def.getValue();
                const item = new DriverInfoLeafItem(
                    key,
                    value,
                    new vscode.ThemeIcon('symbol-property'),
                    {
                        command: 'edk2code.driverInfoOpenFile',
                        title: 'Open',
                        arguments: [def.location.uri, { selection: def.location.range }]
                    }
                );
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        // Sources
        const sources = parser.getSymbolsType(Edk2SymbolType.infSource);
        if (sources.length) {
            const cat = new DriverInfoCategoryItem('Sources', 'files');
            gCompileCommands.load();
            for (const src of sources) {
                const filePath = src.textLine.replace(/\s*\|.*/, '');
                const relPath = path.dirname(this.infUri.fsPath);
                const locations = await gPathFind.findPath(filePath, relPath);
                const resolvedUri = locations.length ? locations[0].uri : vscode.Uri.file(path.join(relPath, filePath));
                const hasCompileCommand = gCompileCommands.getCompileCommandForFile(resolvedUri.fsPath) !== undefined;
                const item = new DriverInfoLeafItem(
                    filePath,
                    '',
                    vscode.ThemeIcon.File,
                    locations.length ? {
                        command: 'edk2code.driverInfoOpenFile',
                        title: 'Open file',
                        arguments: [locations[0].uri]
                    } : undefined,
                    resolvedUri
                );
                if (hasCompileCommand) {
                    item.contextValue = 'driverInfoCompilableSource';
                }
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        // Libraries
        const libraries = parser.getSymbolsType(Edk2SymbolType.infLibrary);
        if (libraries.length) {
            const cat = new DriverInfoCategoryItem('Libraries', 'library');
            for (const lib of libraries) {
                const libName = lib.textLine.replace(/\s*\|.*/, '');
                const item = new DriverInfoLeafItem(
                    libName,
                    '',
                    new vscode.ThemeIcon('symbol-module'),
                    {
                        command: 'edk2code.driverInfoGoToDefinition',
                        title: 'Go to definition',
                        arguments: [lib]
                    }
                );
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        // Packages
        const packages = parser.getSymbolsType(Edk2SymbolType.infPackage);
        if (packages.length) {
            const cat = new DriverInfoCategoryItem('Packages', 'package');
            for (const pkg of packages) {
                const pkgPath = pkg.textLine.replace(/\s*\|.*/, '');
                const item = new DriverInfoLeafItem(
                    pkgPath,
                    '',
                    new vscode.ThemeIcon('symbol-package'),
                    {
                        command: 'edk2code.driverInfoGoToDefinition',
                        title: 'Go to definition',
                        arguments: [pkg]
                    }
                );
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        // Protocols
        const protocols = parser.getSymbolsType(Edk2SymbolType.infProtocol);
        if (protocols.length) {
            const cat = new DriverInfoCategoryItem('Protocols', 'plug');
            for (const proto of protocols) {
                const protoName = proto.textLine.replace(/\s*\|.*/, '');
                const item = new DriverInfoLeafItem(
                    protoName,
                    '',
                    new vscode.ThemeIcon('symbol-interface'),
                    {
                        command: 'edk2code.driverInfoGoToDefinition',
                        title: 'Go to definition',
                        arguments: [proto]
                    }
                );
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        // PPIs
        const ppis = parser.getSymbolsType(Edk2SymbolType.infPpi);
        if (ppis.length) {
            const cat = new DriverInfoCategoryItem('PPIs', 'plug');
            for (const ppi of ppis) {
                const ppiName = ppi.textLine.replace(/\s*\|.*/, '');
                const item = new DriverInfoLeafItem(
                    ppiName,
                    '',
                    new vscode.ThemeIcon('symbol-event'),
                    {
                        command: 'edk2code.driverInfoGoToDefinition',
                        title: 'Go to definition',
                        arguments: [ppi]
                    }
                );
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        // GUIDs
        const guids = parser.getSymbolsType(Edk2SymbolType.infGuid);
        if (guids.length) {
            const cat = new DriverInfoCategoryItem('GUIDs', 'key');
            for (const guid of guids) {
                const guidName = guid.textLine.replace(/\s*\|.*/, '');
                const item = new DriverInfoLeafItem(
                    guidName,
                    '',
                    new vscode.ThemeIcon('symbol-number'),
                    {
                        command: 'edk2code.driverInfoGoToDefinition',
                        title: 'Go to definition',
                        arguments: [guid]
                    }
                );
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        // PCDs
        const pcds = parser.getSymbolsType(Edk2SymbolType.infPcd);
        if (pcds.length) {
            const cat = new DriverInfoCategoryItem('PCDs', 'settings');
            for (const pcd of pcds) {
                const pcdName = pcd.textLine.replace(/\s*\|.*/, '');
                const item = new DriverInfoLeafItem(
                    pcdName,
                    '',
                    new vscode.ThemeIcon('symbol-string'),
                    {
                        command: 'edk2code.driverInfoGoToDefinition',
                        title: 'Go to definition',
                        arguments: [pcd]
                    }
                );
                cat.children.push(item);
            }
            this.categories.push(cat);
        }

        this.refresh();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private clear() {
        this.categories = [];
        this.infUri = undefined;
        this.parser = undefined;
        if (this._treeView) {
            this._treeView.title = 'Module Info';
        }
        void vscode.commands.executeCommand('setContext', 'edk2code.driverInfoAvailable', false);
        this.refresh();
    }

    private refresh() {
        this._onDidChangeTreeData.fire();
    }
}
