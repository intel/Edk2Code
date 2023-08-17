import * as vscode from 'vscode';
var currentFile = "";
import * as edkStatusBar from './statusBar';
import { normalizePath } from './utils';
import path = require('path');
import { gEdkDatabase } from './extension';


export class FileUseWarning {
    constructor() {
        vscode.window.onDidChangeActiveTextEditor(this.fileOpened);
    }

    async fileOpened() {
        // Get opened file
        var openedFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
        if (openedFilePath === undefined) { return; }
        if (currentFile === openedFilePath) {
            return;
        }

        // Set status bar with no contex of file
        edkStatusBar.setColor('statusBarItem.activeBackground');
        edkStatusBar.setText(``);

        currentFile = openedFilePath;
        openedFilePath = normalizePath(openedFilePath);
        if (openedFilePath === undefined) { return; }

        //
        // Notify user if file is in use
        //
        var baseFileName = path.basename(openedFilePath);
        edkStatusBar.setText("");
        edkStatusBar.setText(`$(check) ${baseFileName}`);
        
        let fileStatus = await gEdkDatabase.isFileInuse(openedFilePath);
        if(fileStatus===undefined){
            // Database not created
            edkStatusBar.setColor('statusBarItem.activeBackground');
            edkStatusBar.setText(`$(info) Usage undefined`);
            return;
        }            
        if(fileStatus===true){
            edkStatusBar.setColor('statusBarItem.activeBackground');
            edkStatusBar.setText(`$(check) ${baseFileName}`);
        }else{
            edkStatusBar.setColor('statusBarItem.warningBackground');
            edkStatusBar.setText(`$(warning) ${baseFileName} not used in current context`);
        }

    }
}


