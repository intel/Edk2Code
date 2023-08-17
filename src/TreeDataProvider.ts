import * as vscode from 'vscode';



export class TreeDetailsDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<undefined | void> = new vscode.EventEmitter<undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<undefined | void> = this._onDidChangeTreeData.event;

  data: TreeItem[];

  constructor() {
    this.data = [];
  }

  addChildren(item:TreeItem){
    if(!item.visible){return;}
    this.data.push(item);
  }

  clear(){
    this.data = [];
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

}
