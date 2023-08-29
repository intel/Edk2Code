import * as vscode from 'vscode';
var currentFile = "";
import * as edkStatusBar from './statusBar';
import { normalizePath } from './utils';
import path = require('path');
import { gEdkDatabase } from './extension';
import { EdkDatabase } from './edkParser/edkDatabase';


export class FileUseWarning {
    constructor() {
        vscode.window.onDidChangeActiveTextEditor(this.fileOpened);
    }

    async fileOpened() {

        if(!gEdkDatabase.parseComplete){
            // Skip if source hasn't been indexed
            return;
        }

        // Get opened file
        var openedFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
        if (openedFilePath === undefined) { return; }
        if (currentFile === openedFilePath) {
            return;
        }

        
        let langId = vscode.window.activeTextEditor?.document.languageId;
        if(langId===undefined){return;}
        if(!["c","cpp","edk2_dsc","edk2_inf","edk2_dec","asl","edk2_vfr","edk2_fdf"].includes(langId)){
            edkStatusBar.setColor('statusBarItem.activeBackground');
            edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki");
            edkStatusBar.setText(`No EDK file`);
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
        edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki");
        edkStatusBar.setText("");
        edkStatusBar.setText(`$(check) ${baseFileName}`);
        
        let fileStatus = await gEdkDatabase.isFileInuse(openedFilePath);
        if(fileStatus===undefined){
            // Database not created
            edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki/Index-source-code");
            edkStatusBar.setColor('statusBarItem.activeBackground');
            edkStatusBar.setText(`$(info) Usage undefined`);
            return;
        }            
        if(fileStatus===true){
            edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki");
            edkStatusBar.setColor('statusBarItem.activeBackground');
            edkStatusBar.setText(`$(check) ${baseFileName}`);
        }else{
            // Check if file is on DSC's but not compiled
            let symbols = await gEdkDatabase.findByValue(openedFilePath,undefined,true);
            if(symbols.length > 0){
                // file is on DSC files but not compiled
                edkStatusBar.setColor('statusBarItem.warningBackground');
                edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki/Functionality#unused-libraries");
                edkStatusBar.setText(`$(warning) ${baseFileName} is inactive on project DSC file`);
            }else{
                edkStatusBar.setColor('statusBarItem.errorBackground');
                edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki/Index-source-code#cscopefiles");
                edkStatusBar.setText(`$(error) ${baseFileName} not used in current context`);
            }

        }

    }
}


