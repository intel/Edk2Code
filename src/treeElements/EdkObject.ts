import { EdkWorkspace } from "../index/edkWorkspace";
import { EdkSymbol } from "../symbols/edkSymbols";
import { TreeItem } from "./TreeItem";
import * as vscode from 'vscode';

export class EdkNode extends TreeItem {
    uri:vscode.Uri;
    loaded = false;
    workspace:EdkWorkspace;
    edkObject:EdkSymbol|undefined;
    contextModuleUri:vscode.Uri|undefined = undefined;
  
    constructor(uri:vscode.Uri, position:vscode.Position, wp:EdkWorkspace, edkObject:EdkSymbol|undefined){
      super(uri, vscode.TreeItemCollapsibleState.Collapsed);
      this.edkObject = edkObject;
      this.workspace = wp;
      this.uri = uri;
      
      this.command = {
        "command": "editor.action.peekLocations",
        "title":"Open file",
        "arguments": [this.uri, position, []]
      };

    }

    async expand(){

    }
  


  }
  