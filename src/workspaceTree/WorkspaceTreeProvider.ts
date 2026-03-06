import * as vscode from 'vscode';
import * as path from 'path';
import { EdkWorkspace, IncludeNode } from '../index/edkWorkspace';
import { gEdkWorkspaces } from '../extension';

// ─── Tree Item: Workspace root (the main DSC) ────────────────────────────────

export class WorkspaceRootItem extends vscode.TreeItem {
    constructor(public readonly workspace: EdkWorkspace) {
        const label = path.basename(workspace.mainDsc.fsPath);
        super(label, vscode.TreeItemCollapsibleState.Expanded);
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
    constructor(public readonly node: IncludeNode) {
        const label = path.basename(node.uri.fsPath);
        super(
            label,
            node.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
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

type WorkspaceTreeNode = WorkspaceRootItem | IncludeTreeItem;

// ─── Tree data provider ───────────────────────────────────────────────────────

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeNode> {
    private _onDidChangeTreeData =
        new vscode.EventEmitter<WorkspaceTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _activeIndex: number = 0;

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

    getTreeItem(element: WorkspaceTreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: WorkspaceTreeNode): WorkspaceTreeNode[] {
        const workspaces = gEdkWorkspaces.workspaces;
        if (workspaces.length === 0) {
            return [];
        }

        // Root level: emit the single WorkspaceRootItem for the active workspace
        if (!element) {
            const ws = workspaces[this._activeIndex];
            if (!ws) { return []; }
            return [new WorkspaceRootItem(ws)];
        }

        // Under the workspace root: top-level include nodes
        if (element instanceof WorkspaceRootItem) {
            return element.workspace.includeTree.map(n => new IncludeTreeItem(n));
        }

        // Under an include node: its nested children
        if (element instanceof IncludeTreeItem) {
            return element.node.children.map(n => new IncludeTreeItem(n));
        }

        return [];
    }
}
