import * as vscode from 'vscode';
import { edkLensTreeDetailProvider } from '../extension';

export class TreeItem extends vscode.TreeItem {
    children: TreeItem[] = [];
    parent: TreeItem | undefined;
    visible:boolean = true;
    
    private tempIcon = this.iconPath;
    
    getParent() {
      return this.parent;
    }
  
    addChildren(node: TreeItem) {
      node.parent = this;
      this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      this.children.push(node);
    }
  
    *iterateChildren(): IterableIterator<TreeItem> {
      for (const child of this.children) {
          yield child;
          yield* child.iterateChildren();
      }
    }

    *iterateParents(): IterableIterator<TreeItem> {
      let current: TreeItem | undefined = this.parent;
      while (current) {
          yield current;
          current = current.parent;
      }
    }  

    toString(){
      let result = "";
      if(typeof this.label === 'string'){
        result =  `**${this.label}**`;
      }
      if(typeof this.label === 'object' && 'label' in this.label){
        result = `**${this.label.label}**`;
      }
  
      result += this.description ? `   -  *${this.description}*` : '';
      return result;
    }

    async expand(){}

    setLoading(){
      this.tempIcon = this.iconPath;
      this.iconPath = new vscode.ThemeIcon("loading~spin");
      edkLensTreeDetailProvider.refresh();
    }

    clearLoading(){
      this.iconPath = this.tempIcon;
      edkLensTreeDetailProvider.refresh();
    }

    needsExpandProcess(){
      if(this.collapsibleState === vscode.TreeItemCollapsibleState.None){
        return false;
      }

      if(this.children.length > 0){
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        return false;
      }

      return true;
    }

    async expandWithLoading(expandFunction:Function){
      if(this.needsExpandProcess()){
        this.setLoading();
        await expandFunction();
        this.clearLoading();
        if(this.children.length === 0){
          this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
      }
    }
  }