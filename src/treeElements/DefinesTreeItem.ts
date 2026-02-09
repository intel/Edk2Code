import * as vscode from 'vscode';
import { gEdkWorkspaces } from '../extension'; 
import { TreeItem } from './TreeItem';

export class DefinesRootItem extends TreeItem {
    constructor( label: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
    }

    // Override to populate children dynamically
    async expand() {
        this.children = []; // Clear current children
        
        if (this.label === "DEFINES") {
             this.populateDefines();
        } else if (this.label === "PCDs") {
             this.populatePcds();
        }
    }

    private populateDefines() {
        if (!gEdkWorkspaces || !gEdkWorkspaces.workspaces) { return; }

        for (const wp of gEdkWorkspaces.workspaces) {
            let defs = wp.getDefinitions();
            for (const [key, value] of defs.entries()) {
                const label = `${key}`;
                const item = new TreeItem(label, vscode.TreeItemCollapsibleState.None);
                item.description = value.value;
                if (value.location) {
                    item.command = {
                        command: 'vscode.open',
                        title: 'Open',
                        arguments: [value.location.uri, { selection: value.location.range }]
                    };
                    item.tooltip = label;
                }
                this.addChildren(item);
            }
        }
    }

    private populatePcds() {
        if (!gEdkWorkspaces || !gEdkWorkspaces.workspaces) { return; }

        for (const wp of gEdkWorkspaces.workspaces) {
            let pcds = wp.getAllPcds();
            for (const [namespace, pcdMap] of pcds) {
                for (const [name, pcd] of pcdMap) {
                    const label = `${namespace}.${name} = ${pcd.value}`;
                    const item = new TreeItem(label, vscode.TreeItemCollapsibleState.None);
                    item.command = {
                        command: 'vscode.open',
                        title: 'Open',
                        arguments: [pcd.position.uri, { selection: pcd.position.range }]
                    };
                    item.tooltip = label;
                    this.addChildren(item);
                }
            }
        }
    }

    // Needed because TreeItem implementation uses it
    addChildren(node: TreeItem) {
        node.parent = this;
        // this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded; // Don't auto expand when adding children internally
        this.children.push(node);
    }
}
