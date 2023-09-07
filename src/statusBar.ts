import * as vscode from 'vscode';
import { gExtensionContext } from './extension';
export var myStatusBarItem: vscode.StatusBarItem;

var helpUrl:string = "";
var textStack:string[] = [];

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

export function setToolTip(text:string){
    myStatusBarItem.tooltip = text;
}

export function setHelpUrl(url:string ){
    helpUrl = url;
}

export function setInfo(text:string){
    myStatusBarItem.tooltip = text;
}


export function pushText(text:string){
    textStack.push(myStatusBarItem.text);
    myStatusBarItem.text = `EDK2: ${text}`;
    myStatusBarItem.show();
    myStatusBarItem.tooltip = "";
}

export function popText(){
    let text = textStack.pop();
    myStatusBarItem.text = text? text:"EDK2: Started*";
    myStatusBarItem.show();
    myStatusBarItem.tooltip = "";
}

export function setText(text: string): void {
    textStack = [];
    myStatusBarItem.text = `EDK2: ${text}`;
    myStatusBarItem.show();
    myStatusBarItem.tooltip = "";
}


export function setColor(color:string){
    myStatusBarItem.backgroundColor = new vscode.ThemeColor(color);
}

export function setWorking(){
    if(!myStatusBarItem.text.startsWith("$(sync~spin)")){
        myStatusBarItem.text = `$(sync~spin) ${myStatusBarItem.text}`;
    }
    
}

export function clearWorking(){
    myStatusBarItem.text = myStatusBarItem.text.replace("$(sync~spin) ", "");
}