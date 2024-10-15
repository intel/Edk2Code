import { InfParser } from "../edkParser/infParser";
import { getParser } from "../edkParser/parserFactory";
import { gDebugLog, gPathFind } from "../extension";
import { EdkWorkspace } from "../index/edkWorkspace";
import { EdkSymbol } from "../symbols/edkSymbols";
import { EdkSymbolInfLibrary } from "../symbols/infSymbols";
import { Edk2SymbolType } from "../symbols/symbolsType";
import { EdkNode } from "./EdkObject";
import * as vscode from 'vscode';



export class EdkInfNode extends EdkNode{
    contextUri:vscode.Uri;
    librarySet:Set<string>|undefined;
    constructor(uri:vscode.Uri, contextUri:vscode.Uri, position:vscode.Position, wp:EdkWorkspace, edkObject:EdkSymbol, librarySet?:Set<string>|undefined){
        super(uri, position, wp, edkObject);
        this.contextUri = contextUri;
        this.iconPath = new vscode.ThemeIcon("file");
        this.command = {
            "command": "vscode.open",
            "title":"Open file",
            "arguments": [this.uri]
          };
        this.librarySet = librarySet;
        if(librarySet){
            if(librarySet.has(uri.fsPath)){
                this.setDuplicatedLibrary();
            }else{
                librarySet.add(uri.fsPath);
                console.log(`* ${uri.fsPath}`);
            }
        }

        
    }


    async expand(){
        if(this.collapsibleState === vscode.TreeItemCollapsibleState.None){return;}// Do not expand

        let parser = await getParser(this.uri);
        
        if(parser === undefined){
            gDebugLog.error("Parser not found for file: " + this.uri.fsPath);
            return;
        }

        let libraries = parser.getSymbolsType(Edk2SymbolType.infLibrary) as EdkSymbolInfLibrary[];
        for (const library of libraries) {
            let libDefinitions = await this.workspace.getLibDeclarationModule(this.contextUri, library.name);
            for (const libDefinition of libDefinitions) {
                let filePaths = await gPathFind.findPath(libDefinition.path);
                for (const path of filePaths) {
                    let childLibNode = new EdkInfNode(path.uri, this.contextUri, new vscode.Position(0,0), this.workspace, library, this.librarySet);
                    this.addChildren(childLibNode); 

                    // Check circular dependencies
                    for (const parent of childLibNode.iterateParents()) {
                        if(parent instanceof EdkInfNode){
                            if(parent.uri.fsPath === childLibNode.uri.fsPath){
                                childLibNode.setCircularDependency();
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    setDuplicatedLibrary(){
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        this.description = `(Duplicated library)`;
        this.iconPath = new vscode.ThemeIcon("extensions-remote");
        this.tooltip = "Duplicated library";
    }

    setCircularDependency(){
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        this.description = `(Circular dependency)`;
        this.iconPath = new vscode.ThemeIcon("extensions-refresh");
        this.tooltip = "Circular library dependency";
    }

}