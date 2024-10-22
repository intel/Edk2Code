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


function getIconForSymbolKind(kind: vscode.SymbolKind): string {
    switch(kind) {
      case vscode.SymbolKind.File:
        return "symbol-file";
      case vscode.SymbolKind.Module:
        return "symbol-module";
      case vscode.SymbolKind.Namespace:
        return "symbol-namespace";
      case vscode.SymbolKind.Package:
        return "symbol-package";
      case vscode.SymbolKind.Class:
        return "symbol-class";
      case vscode.SymbolKind.Method:
        return "symbol-method";
      case vscode.SymbolKind.Property:
        return "symbol-property";
      case vscode.SymbolKind.Field:
        return "symbol-field";
      case vscode.SymbolKind.Constructor:
        return "symbol-constructor";
      case vscode.SymbolKind.Enum:
        return "symbol-enum";
      case vscode.SymbolKind.Interface:
        return "symbol-interface";
      case vscode.SymbolKind.Function:
        return "symbol-function";
      case vscode.SymbolKind.Variable:
        return "symbol-variable";
      case vscode.SymbolKind.Constant:
        return "symbol-constant";
      case vscode.SymbolKind.String:
        return "symbol-string";
      case vscode.SymbolKind.Number:
        return "symbol-number";
      case vscode.SymbolKind.Boolean:
        return "symbol-boolean";
      case vscode.SymbolKind.Array:
        return "symbol-array";
      case vscode.SymbolKind.Object:
        return "symbol-object";
      case vscode.SymbolKind.Key:
        return "symbol-key";
      case vscode.SymbolKind.Null:
        return "symbol-null";
      case vscode.SymbolKind.EnumMember:
        return "symbol-enum-member";
      case vscode.SymbolKind.Struct:
        return "symbol-struct";
      case vscode.SymbolKind.Event:
        return "symbol-event";
      case vscode.SymbolKind.Operator:
        return "symbol-operator";
      case vscode.SymbolKind.TypeParameter:
        return "symbol-type-parameter";
      default:
        return "symbol-misc";
    }
  }

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
      this.iconPath = new vscode.ThemeIcon(getIconForSymbolKind(symbol.kind));
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