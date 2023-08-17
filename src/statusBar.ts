import * as vscode from 'vscode';
export var myStatusBarItem: vscode.StatusBarItem;

export function init(context:vscode.ExtensionContext){
    // create a new status bar item that we can now manage
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    context.subscriptions.push(myStatusBarItem);
    setText("Started");
}

export function setInfo(text:string){
    myStatusBarItem.tooltip = text;
}

export function setText(text: string): void {
    myStatusBarItem.text = `EDK2: ${text}`;
    myStatusBarItem.show();
    myStatusBarItem.tooltip = "";
}


export function setColor(color:string){
    myStatusBarItem.backgroundColor = new vscode.ThemeColor(color);
}

export function setWorking(){
    myStatusBarItem.text = `$(sync~spin) ${myStatusBarItem.text}`;
}

export function clearWorking(){
    myStatusBarItem.text = myStatusBarItem.text.replace("$(sync~spin) ", "");
}