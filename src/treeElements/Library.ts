import { InfParser } from "../edkParser/infParser";
import { getParser } from "../edkParser/parserFactory";
import { gConfigAgent, gDebugLog, gPathFind } from "../extension";
import { EdkWorkspace } from "../index/edkWorkspace";
import { EdkSymbol } from "../symbols/edkSymbols";
import { EdkSymbolInfLibrary, EdkSymbolInfSource } from "../symbols/infSymbols";
import { Edk2SymbolType } from "../symbols/symbolsType";
import { EdkNode } from "./EdkObject";
import * as vscode from 'vscode';
import { EdkSourceNode } from "./Source";
import { ConfigAgent } from "../configuration";



export class EdkInfNode extends EdkNode{
    contextUri:vscode.Uri;
    librarySet:Set<string>|undefined;
    constructor(uri:vscode.Uri, contextUri:vscode.Uri, position:vscode.Position, wp:EdkWorkspace, edkObject:EdkSymbol, librarySet?:Set<string>|undefined){
        super(uri, position, wp, edkObject);
        this.contextUri = contextUri;
        this.description = `${uri.fsPath}`;
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
                console.log(`${uri.fsPath}`);
            }
        }

        void getParser(this.uri).then(async (parser)=>{
            if(parser){
                let defines = parser.getSymbolsType(Edk2SymbolType.infDefine);
                let libraryClass = "";
                for (const define of defines) {
                    if((await define.getKey()).toLowerCase() === "library_class"){
                        libraryClass = (await define.getValue() || "").split("|")[0];
                        this.label = libraryClass;
                        break;
                    }
                }
            }
        });


        
    }


    async expand(){
        await this.expandWithLoading(async ()=>{
            let parser = await getParser(this.uri);
        
            if(parser === undefined){
                gDebugLog.error("Parser not found for file: " + this.uri.fsPath);
                return;
            }
            let contextProperties = await this.workspace.getDscProperties(this.contextUri);
    
            let libraries = parser.getSymbolsType(Edk2SymbolType.infLibrary, contextProperties) as EdkSymbolInfLibrary[];
    
            // Load libraries
            for await (const library of libraries) {
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
    
            let sources = parser.getSymbolsType(Edk2SymbolType.infSource, contextProperties) as EdkSymbolInfSource[];
            for (const source of sources) {
                let filePath = await source.getValue();
    
                if(!filePath.toLowerCase().endsWith(".c")){continue;} // Only C files
                
                let pos = new vscode.Position(0,0);
                let fileUri = vscode.Uri.file(filePath);
                let childSourceNode = new EdkSourceNode(fileUri, this.contextUri, pos, this.workspace, source, this.librarySet);
                this.addChildren(childSourceNode);
        
            }
        });

        




        
    }

    setDuplicatedLibrary(){
        if(!gConfigAgent.getExpandCircularOrDuplicateLibraries()){
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        this.description = `(Duplicated library)`;
        this.iconPath = new vscode.ThemeIcon("extensions-remote");
        this.tooltip = "Duplicated library";
    }

    setCircularDependency(){
        if(!gConfigAgent.getExpandCircularOrDuplicateLibraries()){
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        this.description = `(Circular dependency)`;
        this.iconPath = new vscode.ThemeIcon("extensions-refresh");
        this.tooltip = "Circular library dependency";
    }

}