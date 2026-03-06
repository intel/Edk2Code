import { InfParser } from "../edkParser/infParser";
import { getParser } from "../edkParser/parserFactory";
import { gDebugLog, gPathFind } from "../extension";
import { EdkWorkspace } from "../index/edkWorkspace";
import { EdkSymbol } from "../symbols/edkSymbols";
import { EdkSymbolInfLibrary, EdkSymbolInfSource } from "../symbols/infSymbols";
import { Edk2SymbolType } from "../symbols/symbolsType";
import { EdkNode } from "./EdkObject";
import * as vscode from 'vscode';
import { EdkSourceNode } from "./Source";
import { TreeItem } from "./TreeItem";
import { documentGetText, documentGetTextSync, getSymbolAtLocation, openTextDocumentInRange } from "../utils";


var baseTypeSet = new Set<string>([
"UINTN",
"INTN",
"UINT64",
"INT64",
"UINT32",
"INT32",
"UINT16",
"CHAR16",
"INT16",
"BOOLEAN",
"UINT8",
"CHAR8",
"INT8"
]);


export class EdkSymbolNode extends EdkNode{
    uri:vscode.Uri;
    range:vscode.Range;
    name:string;
    baseType:boolean = false;
    constructor(uri:vscode.Uri, symbol:vscode.DocumentSymbol,  wp:EdkWorkspace){
      super(uri, symbol.range.start, wp, undefined);

      this.label = symbol.name;
      this.name = symbol.name;
      this.description = symbol.detail.length?symbol.detail:vscode.SymbolKind[symbol.kind];
      this.iconPath = EdkSymbol.iconForKind(symbol.kind);
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
      this.range = symbol.range;
      this.uri = uri;
      
      // Fix typedef label rendering
      if(symbol.kind === vscode.SymbolKind.Interface){
        let text = documentGetTextSync(this.uri, symbol.range);
        let clearText = text.replace(symbol.detail,"").replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replaceAll("\n"," ").replaceAll("\r","").trim();
        if(!clearText.match(/^(struct|enum|union)/)){
          this.label = clearText;
        }
      }


      // Avoid expand basetypes
      let baseTypeDef = false;
      if(this.description === "typedef"){
        baseTypeDef = baseTypeSet.has(this.label.split(" ")[0].trim());
      }

      this.baseType = baseTypeDef || baseTypeSet.has(this.description);

      if(!this.baseType){ // Skip base types children
        for (const child of symbol.children) {
            let newChild = new EdkSymbolNode(uri,child, this.workspace);
            this.addChildren(newChild);
            this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            // Get the type parsing the definition
            void documentGetText(this.uri, child.range).then((text) => {
              const childType = text.trim().split(" ")[0];
              newChild.description = childType;
              if(baseTypeSet.has(childType)){
                newChild.collapsibleState = vscode.TreeItemCollapsibleState.None;
              }
            });
          }
      }

  
      if(symbol.kind === vscode.SymbolKind.Field){
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      }
  
  
      this.command = {
        "command": "editor.action.peekLocations",
        "title":"Open file",
        "arguments": [this.uri, symbol.range.start, []]
      };
  
    }
  
    async expand() {
      await this.expandWithLoading(async ()=>{
        await openTextDocumentInRange(this.uri, this.range);
        if(this.children.length > 0){return;}
        
        // Find definition for field
        const locations = await  vscode.commands.executeCommand<vscode.Location[]>('vscode.executeTypeDefinitionProvider', this.uri, this.range.start);
        if(locations.length > 0){
          let symbol = await getSymbolAtLocation(locations[0].uri, locations[0]);
          if(symbol){
    
            if(symbol.kind === vscode.SymbolKind.Interface){
              const locationsType = await  vscode.commands.executeCommand<vscode.Location[]>('vscode.executeTypeDefinitionProvider',locations[0].uri , locations[0].range.start);
              if(locationsType.length > 0){
                symbol = await getSymbolAtLocation(locationsType[0].uri, locationsType[0]);
                if(!symbol){return;}
              }
            }
    
            let symbolNode = new EdkSymbolNode(locations[0].uri, symbol, this.workspace);
            

            if(symbolNode.name.includes("unnamed") && symbolNode.children.length> 0 && !symbolNode.baseType){
              for (const child of symbolNode.children) {
                this.addChildren(child);
              }
            }else{
              this.addChildren(symbolNode);
            }
            symbolNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
   
          }else{
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
          }
        }
      });
    }
  }