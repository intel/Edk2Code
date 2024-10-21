import path = require("path");
import { CompileCommandsEntry } from "../compileCommands";
import { InfParser } from "../edkParser/infParser";
import { getParser } from "../edkParser/parserFactory";
import { edkLensTreeDetailProvider, gCompileCommands, gDebugLog, gMapFileManager, gPathFind } from "../extension";
import { EdkWorkspace } from "../index/edkWorkspace";
import { EdkSymbol } from "../symbols/edkSymbols";
import { EdkSymbolInfLibrary, EdkSymbolInfSource } from "../symbols/infSymbols";
import { Edk2SymbolType } from "../symbols/symbolsType";
import { findHeaderIncludes, HeaderFileTreeItemLibraryTree } from "../TreeDataProvider";
import { getAllSymbols, openTextDocument } from "../utils";
import { EdkNode } from "./EdkObject";
import * as vscode from 'vscode';
import { DiagnosticManager, EdkDiagnosticCodes } from "../diagnostics";
import { EdkSymbolNode } from "./Symbol";



export class EdkSourceNode extends EdkNode{
    contextUri:vscode.Uri;
    librarySet:Set<string>|undefined;
    constructor(uri:vscode.Uri, contextUri:vscode.Uri, position:vscode.Position, wp:EdkWorkspace, edkObject:EdkSymbol|undefined, librarySet?:Set<string>|undefined){
        super(uri, position, wp, edkObject);
        this.contextUri = contextUri;
        this.iconPath = new vscode.ThemeIcon("file");
        this.command = {
            "command": "vscode.open",
            "title":"Open file",
            "arguments": [this.uri] 
          };
    }


    async expand(){
        await this.expandWithLoading(async ()=>{
            // Find includes
            const compileCommand = gCompileCommands.getCompileCommandForFile(this.uri.fsPath);
            if(compileCommand){
                const includeHeaders = await this.findIncludes();
                for await (const includeHeader of includeHeaders) {
                    this.addChildren(includeHeader);
                    updateCompileCommandsForHeaderFile(includeHeader.uri, compileCommand);
                }
            }

            // Symbols
            const sourceSymbols:vscode.DocumentSymbol[] = await getAllSymbols(this.uri);
            for (const symbol of sourceSymbols) {
                const symbolNode = new EdkSymbolNode(this.uri, symbol, this.workspace);
                if(symbol.kind === vscode.SymbolKind.Function){
                  if(!gMapFileManager.isSymbolUsed(symbol.name)){
                    DiagnosticManager.warning(this.uri,symbol.range,EdkDiagnosticCodes.unusedSymbol, `Unused function: ${symbol.name}`, [vscode.DiagnosticTag.Unnecessary]);
                    symbolNode.tooltip = "Unused function";
                    symbolNode.description = `Unused ${symbolNode.description}`;
                    symbolNode.iconPath = new vscode.ThemeIcon("warning");
                  }
                }
                this.addChildren(symbolNode);
              }

        });
    }

    async findIncludes(){
        let sourceDocument = await openTextDocument(this.uri);
        let sourceText = sourceDocument.getText();
        let lineNo = 0;
        let includeNodes:EdkSourceNode[] = [];
        let compiledIncludePaths: string[] = [];
        const compileCommand = gCompileCommands.getCompileCommandForFile(this.uri.fsPath);
        if(compileCommand){
            compiledIncludePaths = compileCommand.getIncludePaths();
        }

        for (const line of sourceText.split('\n')) {
            let match = /#include\s+(["<])([^">]+)[">]/.exec(line);
            if(match){
                let isRelative = false;
        
                if(match[1] === '"'){
                isRelative = true;
                }
                let includePath = match[2];
        
                let includeUri:vscode.Uri = this.uri;
                
                if(isRelative){
                    // Relative includes
                    const locations = await gPathFind.findRelativePath(includePath, path.dirname(this.uri.fsPath));
                    if(locations){
                        includeUri = locations.uri;  
                    }
                }else{
                    // System includes
                    for (const compiledIncludePath of compiledIncludePaths) {
                        const location = await gPathFind.findRelativePath(includePath, compiledIncludePath);
                        if(location){
                        includeUri = location.uri;
                        break;
                        }
                    }
                }
        
                let includeNode = new EdkSourceNode(includeUri, this.contextUri, new vscode.Position(lineNo, 0), this.workspace, undefined, this.librarySet);
                includeNodes.push(includeNode);
                lineNo++;
        
            }
        }  
        return includeNodes;

    }


}

function updateCompileCommandsForHeaderFile(headerItem:vscode.Uri, compileCommand:CompileCommandsEntry){
    let tempCompileCommand = new CompileCommandsEntry(compileCommand.command, "", headerItem.fsPath);
    gCompileCommands.addCompileCommandForFile(tempCompileCommand);
}

