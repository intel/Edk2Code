import path = require('path');
import * as vscode from 'vscode';
import { edkLensTreeDetailProvider, gEdkWorkspaces, gPathFind, gWorkspacePath } from './extension';
import { InfParser } from './edkParser/infParser';
import { getParser } from './edkParser/parserFactory';
import { Edk2SymbolType } from './symbols/symbolsType';
import { EdkSymbolInfLibrary } from './symbols/infSymbols';






export class TreeDetailsDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<undefined | void> = new vscode.EventEmitter<undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<undefined | void> = this._onDidChangeTreeData.event;

  data: TreeItem[];
  private lastChildren:TreeItem|undefined = undefined;

  constructor() {
    this.data = [];
  }

  getHierarchy(item: TreeItem, level: number = 0): string {
    let description = item.description ? `*${item.description}*` : '';
    let result = '  '.repeat(level) +`- ${item.label} ${description}\n`;// Indentation based on level
    for (const child of item.children) {
      result += this.getHierarchy(child, level + 1); // Recurse for each child, increasing the level
    }
    return result;
  }

  toString(){
    let result = '';
    for (const item of this.data) {
      result += this.getHierarchy(item);
    }
    return result;
  }

  getLastChildren(){
    return this.lastChildren;
  }

  addChildren(item:TreeItem){
    if(!item.visible){return;}
    this.lastChildren = item;
    this.data.push(item);
    this.refresh();
  }

  clear(){
    this.lastChildren = undefined;
    this.data = [];
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  
  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }
  
  getParent?(element: TreeItem): vscode.ProviderResult<TreeItem> {
    return element.getParent();
  }
  resolveTreeItem?(item: vscode.TreeItem, element: TreeItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
    throw new Error('Method not implemented.');
  }

}



export class TreeItem extends vscode.TreeItem {
  children: TreeItem[] = [];
  private parent: TreeItem | undefined;
  visible:boolean = true;
  getParent() {
    return this.parent;
  }

  addChildren(node: TreeItem) {
    node.parent = this;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    this.children.push(node);
  }

  async onExpanded(){

  }

}

export class FileTreeItem extends TreeItem{
  uri:vscode.Uri;
  constructor(uri:vscode.Uri, position:vscode.Position){
    super(uri, vscode.TreeItemCollapsibleState.Expanded);
    this.uri = uri;
    let name = uri.fsPath.slice(gWorkspacePath.length + 1);
    this.description = name;
    this.label = path.basename(uri.fsPath);
    this.iconPath = new vscode.ThemeIcon("file");
    this.command = {
      "command": "editor.action.peekLocations",
      "title":"Open file",
      "arguments": [this.uri, position, []]
    };
    // this.resourceUri = this.uri;
    // this.iconPath = 
  }
}

export class FileTreeItemLibraryTree extends TreeItem{
  uri:vscode.Uri;
  loaded = false;
  constructor(uri:vscode.Uri, position:vscode.Position){
    super(uri, vscode.TreeItemCollapsibleState.Expanded);

    this.uri = uri;
    let name = vscode.workspace.asRelativePath(uri);
    this.description = name;
    this.label = path.basename(uri.fsPath);
    this.iconPath = new vscode.ThemeIcon("file");
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    this.command = {
      "command": "editor.action.peekLocations",
      "title":"Open file",
      "arguments": [this.uri, position, []]
    };
    // this.resourceUri = this.uri;
    // this.iconPath = 
  }

  async onExpanded(){
    if(this.loaded === false){
      await openLibraryNode(this.uri,this);
      this.loaded = true;
    }
    
    console.log("expanded");
  }
}


/**
 * Populates a node with all the libraries found in fileUri.
 *
 * @param fileUri - The URI of the file to be parsed.
 * @param node - The library tree item node to which child nodes will be added.
 *
 * @returns A promise that resolves when the operation is complete.
 *
 * @throws Will throw an error if the parser cannot be obtained.
 * @throws Will throw an error if workspace information cannot be retrieved.
 * @throws Will throw an error if library declarations cannot be fetched.
 * @throws Will throw an error if path information cannot be found.
 */
export async function openLibraryNode(fileUri:vscode.Uri, node:FileTreeItemLibraryTree){
  
  let parser = await getParser(fileUri);
  if(parser ){//&& (parser instanceof InfParser) ){
      let wps = await gEdkWorkspaces.getWorkspace(fileUri);
      let libraries = parser.getSymbolsType(Edk2SymbolType.infLibrary) as EdkSymbolInfLibrary[];
      if(libraries.length === 0){return;} // This INF has no libraries
      for (const wp of wps) {
          for (const library of libraries) {
              let libDefinitions = await wp.getLibDeclarationModule(fileUri, library.name);
              for (const libDefinition of libDefinitions) {
                  let filePaths = await gPathFind.findPath(libDefinition.path);
                  for (const path of filePaths) {
                      let pos = new vscode.Position(0,0);
                      let libNode = new FileTreeItemLibraryTree(path.uri, pos);
                      node.addChildren(libNode);
                  }
              }
          }
          
      }
  }
  edkLensTreeDetailProvider.refresh();
}
