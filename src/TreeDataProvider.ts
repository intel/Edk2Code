import path = require('path');
import * as vscode from 'vscode';
import { TreeItemLabel } from 'vscode';
import { edkLensTreeDetailProvider, gCompileCommands, gEdkWorkspaces, gMapFileManager, gPathFind, gWorkspacePath } from './extension';
import { InfParser } from './edkParser/infParser';
import { getParser } from './edkParser/parserFactory';
import { Edk2SymbolType } from './symbols/symbolsType';
import { EdkSymbolInfLibrary, EdkSymbolInfSource } from './symbols/infSymbols';
import { documentGetText, documentGetTextSync, getAllSymbols, openTextDocument } from './utils';
import { EdkWorkspace } from './index/edkWorkspace';
import { EdkSymbol } from './symbols/edkSymbols';
import { DiagnosticManager, EdkDiagnosticCodes } from './diagnostics';
import { CompileCommandsEntry } from './compileCommands';



let recursion = 0;

export class TreeDetailsDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<undefined | void> = new vscode.EventEmitter<undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<undefined | void> = this._onDidChangeTreeData.event;

  data: TreeItem[];
  private lastChildren:TreeItem|undefined = undefined;

  constructor() {
    this.data = [];
  }

  async expandAll(view:vscode.TreeView<vscode.TreeItem>){

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Expanding Tree nodes...",
      cancellable: true
    }, async (progress, reject) => {
      recursion = 0;
      for (const item of this.data) {
        await this.expandAllNode(item, view, reject);
      }
    });

    
  }

  async expandAllNode(node:TreeItem, view:vscode.TreeView<vscode.TreeItem>, reject:vscode.CancellationToken){
    console.log(`Expanding node: ${node.toString()}, ${recursion}`, );
    if(reject.isCancellationRequested){
      return;
    }
    
    if(node instanceof Edk2TreeItem){
      if((node as Edk2TreeItem).circularDependency === true){
        return;
      }
    }
    
    recursion+=1;
    await node.onExpanded();
    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    
    
    for (const child of node.children) {
      await this.expandAllNode(child, view, reject);
    }
    await view.reveal(node);
    recursion-=1;
  }

  getHierarchy(item: TreeItem, level: number = 0): string {
    let result = '  '.repeat(level) +`- ${item.toString()}\n`;// Indentation based on level
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
  parent: TreeItem | undefined;
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


  toString(){
    let result = "";
    if(typeof this.label === 'string'){
      result = this.label;
    }
    if(typeof this.label === 'object' && 'label' in this.label){
      result = this.label.label;
    }

    result += this.description ? ` *${this.description}*` : '';
    return result;
  }

}


class Edk2TreeItem extends TreeItem{
  uri:vscode.Uri;
  loaded = false;
  wp:EdkWorkspace;
  edkObject:EdkSymbol;
  circularDependency = false;
  constructor(uri:vscode.Uri, position:vscode.Position, wp:EdkWorkspace, edkObject:EdkSymbol){
    super(uri, vscode.TreeItemCollapsibleState.Collapsed);
    this.edkObject = edkObject;
    this.wp = wp;
    this.uri = uri;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    
    this.command = {
      "command": "editor.action.peekLocations",
      "title":"Open file",
      "arguments": [this.uri, position, []]
    };
  }

  addChildren(node: Edk2TreeItem|TreeItem) {
    node.parent = this;
    this.loaded = true;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.children.push(node);

  }

  async onExpanded(){
    
    
    edkLensTreeDetailProvider.refresh();
    if(this.loaded === false){
      await openLibraryNode(this.uri,this,this.wp);
      this.loaded = true;
    }

    // If no children, set collapsible state to none to hide the expand arrow
    if(this.children.length === 0){
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    
  }
}

export class FileTreeItem extends TreeItem{
  uri:vscode.Uri;
  constructor(uri:vscode.Uri, position:vscode.Position,wp:EdkWorkspace){
    super(uri);
    let name = uri.fsPath.slice(gWorkspacePath.length + 1);
    this.description = name;
    this.label = path.basename(uri.fsPath);
    this.iconPath = new vscode.ThemeIcon("file");
    this.uri = uri;
    this.command = {
      "command": "editor.action.peekLocations",
      "title":"Open file",
      "arguments": [this.uri, position, []]
    };
  }
}


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

export class SourceSymbolTreeItem extends TreeItem{
  uri:vscode.Uri;
  constructor(uri:vscode.Uri, symbol:vscode.DocumentSymbol){
    super(uri, vscode.TreeItemCollapsibleState.Collapsed);
    this.label = symbol.name;
    this.description = symbol.detail.length?symbol.detail:vscode.SymbolKind[symbol.kind];
    this.iconPath = new vscode.ThemeIcon(getIconForSymbolKind(symbol.kind));
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;

    this.uri = uri;
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    
    if(symbol.kind === vscode.SymbolKind.Interface){
      let text = documentGetTextSync(this.uri, symbol.range);
      let clearText = text.replace(symbol.detail,"").replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replaceAll("\n"," ").replaceAll("\r","").trim();
      if(!clearText.match(/(struct|enum|union)/)){
        this.label = clearText;
      }
    }

    
    this.command = {
      "command": "editor.action.peekLocations",
      "title":"Open file",
      "arguments": [this.uri, symbol.range.start, []]
    };

  }

}

export class SectionTreeItem extends TreeItem{

  constructor(uri:vscode.Uri, position:vscode.Position, sectionName:string, wp:EdkWorkspace){
    super(sectionName);
    this.label = sectionName;
    this.iconPath = new vscode.ThemeIcon("array");
  }


}

export class FileTreeItemLibraryTree extends Edk2TreeItem{

  constructor(uri:vscode.Uri, position:vscode.Position, wp:EdkWorkspace, edkObject:EdkSymbol){
    super(uri, position, wp, edkObject);


    let name = vscode.workspace.asRelativePath(uri);
    this.description = name;
    this.label = path.basename(uri.fsPath);
    this.iconPath = new vscode.ThemeIcon("file");

    this.command = {
      "command": "vscode.open",
      "title":"Open file",
      "arguments": [this.uri]
    };

  }

}

export class HeaderFileTreeItemLibraryTree extends TreeItem{
  systemIncludes:string[]= [];
  uri:vscode.Uri;
  constructor(uri:vscode.Uri, systemIncludes:string[] = []){
    super(uri, vscode.TreeItemCollapsibleState.Collapsed);
    this.uri = uri;
    this.systemIncludes = systemIncludes;

    let name = vscode.workspace.asRelativePath(uri);
    this.description = name;
    this.label = path.basename(uri.fsPath);
    this.iconPath = new vscode.ThemeIcon("file");

    this.command = {
      "command": "vscode.open",
      "title":"Open file",
      "arguments": [this.uri]
    };
  }

  async loadIncludes(){

  }

  async onExpanded(){
    const includeHeaders = await findHeaderIncludes(this.uri, this.systemIncludes);

    for (const includeHeader of includeHeaders) {
      this.addChildren(includeHeader);
    }

    // add symbols
    
    const sourceSymbols:vscode.DocumentSymbol[] = await getAllSymbols(this.uri);
    for (const symbol of sourceSymbols) {
      
      if(symbol.name.startsWith("__unnamed")){continue;}
      const symbolNode = new SourceSymbolTreeItem(this.uri, symbol);



      for (const children of symbol.children) {
        let childSymbol = new SourceSymbolTreeItem(this.uri, children);
        symbolNode.addChildren(childSymbol);
      }
      
      
      this.addChildren(symbolNode);
    }

    if(this.children.length === 0){
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

  }

}




export async function findHeaderIncludes(fileUri:vscode.Uri, systemIncludes:string[]){
  let sourceDocument = await openTextDocument(fileUri);
  let sourceText = sourceDocument.getText();
  let lineNo = 0;
  let includeNodes:HeaderFileTreeItemLibraryTree[] = [];
  for (const line of sourceText.split('\n')) {
    let match = /#include\s+(["<])([^">]+)[">]/.exec(line);
    if(match){
      let isRelative = false;

      if(match[1] === '"'){
        isRelative = true;
      }
      let includePath = match[2];

      let includeUri:vscode.Uri = fileUri;
      
      if(isRelative){
        // Relative includes
        const locations = await gPathFind.findRelativePath(includePath, path.dirname(fileUri.fsPath));
        if(locations){
          includeUri = locations.uri;  
        }
      }else{
        // System includes
        for (const compiledIncludePath of systemIncludes) {
          const location = await gPathFind.findRelativePath(includePath, compiledIncludePath);
          if(location){
            includeUri = location.uri;
            break;
          }
        }
      }

      let includeNode = new HeaderFileTreeItemLibraryTree(includeUri, systemIncludes);
      includeNodes.push(includeNode);
      lineNo++;

    }
  }  
  return includeNodes;
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
export async function openLibraryNode(fileUri:vscode.Uri, node:FileTreeItemLibraryTree, wp:EdkWorkspace){

  if(node.circularDependency){return;} // Dont process duplicated elements

  const tempIcon = node.iconPath;
  node.iconPath = new vscode.ThemeIcon("loading~spin");
  edkLensTreeDetailProvider.refresh();


  DiagnosticManager.clearProblems(fileUri);
  let parser = await getParser(fileUri) as InfParser;
  if(parser){
    // Add librarires
    let libraries = parser.getSymbolsType(Edk2SymbolType.infLibrary) as EdkSymbolInfLibrary[];
    if(libraries.length > 0){
      let sectionLib = new SectionTreeItem(fileUri,libraries[0].parent!.range.start, "Libraries", wp);
      node.addChildren(sectionLib);
      for (const library of libraries) {
        let libDefinitions = await wp.getLibDeclarationModule(fileUri, library.name);
        for (const libDefinition of libDefinitions) {
          let filePaths = await gPathFind.findPath(libDefinition.path);
          for (const path of filePaths) {
            let pos = new vscode.Position(0,0);
            
            let libNode = new FileTreeItemLibraryTree(path.uri, pos, wp, library);

            sectionLib.addChildren(libNode);
            // Check for circular dependencies
            if(isCircularDependencies(libNode)){
              libNode.circularDependency = true;
            }
          }
        }
      }
    }


    // Add sources
    let sources = parser.getSymbolsType(Edk2SymbolType.infSource) as EdkSymbolInfSource[];
    if(sources.length > 0){
      let sectionSource = new SectionTreeItem(fileUri,sources[0].parent!.range.start, "Sources", wp, );
      
      node.addChildren(sectionSource);
      for (const source of sources) {
        let filePath = await source.getValue();

        if(!filePath.toLowerCase().endsWith(".c")){continue;} // Only C files
        
        let pos = new vscode.Position(0,0);
        let fileUri = vscode.Uri.file(filePath);

        let sourceNode = new FileTreeItemLibraryTree(fileUri, pos, wp, source);
        sectionSource.addChildren(sourceNode);
          
        // Find includes
        const compileCommand = gCompileCommands.getCompileCommandForFile(fileUri.fsPath);
        if(compileCommand){
          const compiledIncludePaths = compileCommand.getIncludePaths();
          const includeHeaders = await findHeaderIncludes(fileUri, compiledIncludePaths);
          for (const includeHeader of includeHeaders) {
            sourceNode.addChildren(includeHeader);
          }
        }
        

        // Check if the symbol is used
        const sourceSymbols:vscode.DocumentSymbol[] = await getAllSymbols(fileUri);
        for (const symbol of sourceSymbols) {
          const symbolNode = new SourceSymbolTreeItem(fileUri, symbol);
          if(symbol.kind === vscode.SymbolKind.Function){
            if(!gMapFileManager.isSymbolUsed(symbol.name)){
              DiagnosticManager.warning(fileUri,symbol.range,EdkDiagnosticCodes.unusedSymbol, `Unused function: ${symbol.name}`, [vscode.DiagnosticTag.Unnecessary]);
              let label:string = symbolNode.label as string;
              symbolNode.label = {label:label, highlights:[[0,label.length]]};
              symbolNode.tooltip = "Unused function";                    
            }
          }
          sourceNode.addChildren(symbolNode);
        }
      }
    }
  }

  node.iconPath = tempIcon;
  edkLensTreeDetailProvider.refresh();
}


function isCircularDependencies(libNode: FileTreeItemLibraryTree) {
  let tempNode = libNode.parent;
  while (tempNode) {
      if (tempNode.label === libNode.label) {
          DiagnosticManager.warning(
              libNode.uri, 0, EdkDiagnosticCodes.circularDependency,
              `Library circular dependency detected`, [vscode.DiagnosticTag.Unnecessary]
          );
          libNode.collapsibleState = vscode.TreeItemCollapsibleState.None;
          const labelString = libNode.label as string;
          libNode.label = { label: labelString as string, highlights: [[0, labelString.length]] };
          return true;
      }
      tempNode = tempNode.parent;
  }
  return false;
}
