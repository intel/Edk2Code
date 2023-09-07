import * as vscode from 'vscode';
import * as edkStatusBar from './statusBar';
import path = require('path');
import { gCscope, gEdkWorkspaces } from './extension';




export class FileUseWarning {
    constructor() {
        vscode.window.onDidChangeActiveTextEditor(async (editor)=> {
            if(editor){
                await this.fileOpened(editor);
            }
        });
    }


    

    async fileOpened(editor: vscode.TextEditor) {

        // Get opened file
        
        let document = editor.document;

        let langId = document.languageId;
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

        //
        // Notify user if file is in use
        //

        // edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki");
        // edkStatusBar.setText("");
        // edkStatusBar.setText(`$(check) ${path.basename(document.fileName)}`);
        
        if(gEdkWorkspaces.isConfigured()){
            let wps = await gEdkWorkspaces.getWorkspace(editor.document.uri);
            let wpFound = [];
            for (const wp of wps) {
                if(await wp.isFileInUse(editor.document.uri)){
                    wpFound.push(wp.platformName);

                }
            }

            if(wpFound.length){
                edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki");
                edkStatusBar.setColor('statusBarItem.activeBackground');
                edkStatusBar.setText(`${wpFound.join("|")}`);
                edkStatusBar.setToolTip("");
                return;
            }

            // If file is an H file, then check in cscope.files
            if(gCscope.includesFile(editor.document.uri)){
                edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki");
                edkStatusBar.setColor('statusBarItem.activeBackground');
                edkStatusBar.setText(`(Included Path) ${path.basename(document.fileName)}`);
                edkStatusBar.setToolTip("");
                return;
            }

            edkStatusBar.setColor('statusBarItem.warningBackground');
            edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki/Functionality#unused-libraries");
            edkStatusBar.setText(`$(warning) ${path.basename(document.fileName)}`);
            edkStatusBar.setToolTip("This file is not used by any loaded workspace");
            return;
        }else{
            edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki/Index-source-code");
            edkStatusBar.setColor('statusBarItem.activeBackground');
            edkStatusBar.setText(`Workspace not found`);
            edkStatusBar.setToolTip("No workspace is configured");
        }

    }
}


