import * as vscode from 'vscode';
import { gExtensionContext } from './extension';
export var myStatusBarItem: vscode.StatusBarItem;

var helpUrl:string = "";

export function init(context:vscode.ExtensionContext){
    // create a new status bar item that we can now manage
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    
    const myCommandId = 'edk2code.statusCmd';
    
    gExtensionContext.subscriptions.push(vscode.commands.registerCommand(myCommandId, async () => {
        await vscode.env.openExternal(vscode.Uri.parse(
            helpUrl));

	}));
    myStatusBarItem.command = myCommandId;

    context.subscriptions.push(myStatusBarItem);
    setText("Started");
}

export function setHelpUrl(url:string ){
    helpUrl = url;
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