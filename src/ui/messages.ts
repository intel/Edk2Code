import * as vscode from 'vscode';
import { rescanIndex } from '../contextState/cmds';
import { gConfigAgent, gCscope } from '../extension';
import { delay } from '../utils';


export function askReloadFiles(){
    void vscode.window.showInformationMessage("Configuration changed. Need to rescan index", "Rescan now").then(async selection => {
        if (selection === "Rescan now"){
            await rescanIndex();
            
        }
      });
}


export function infoMissingCompileInfo(){
    void vscode.window.showInformationMessage("EDK2 Compile Information folder is missing.", "How to enable?").then(async selection => {
        if (selection === "How to enable?"){
            void vscode.env.openExternal(vscode.Uri.parse("https://github.com/intel/Edk2Code/wiki/Index-source-code#enable-compile-information"));
        }
    });
}



export function infoMissingCppExtension(){
    if(gConfigAgent.isWarningCppExtension()){
        void vscode.window.showInformationMessage("The MS C/C++ or Cland extension is not installed. Please install one of those to use full EDK2Code features.",
             "Install MS C/C++ extension",
             "Install Clangd extension",
             "Don't show this warning again").then(async selection => 
        {

            if (selection === "Install MS C/C++ extension"){
                void vscode.env.openExternal(vscode.Uri.parse('vscode:extension/ms-vscode.cpptools'));
            }

            if (selection === "Install Clangd extension"){
                void vscode.env.openExternal(vscode.Uri.parse('vscode:extension/llvm-vs-code-extensions.vscode-clangd'));
            }
            

            if(selection === "Don't show this warning again"){
                await gConfigAgent.setWarningCppExtension(false);
            }
        });
    }
}


export async function updateCompilesCommandCpp():Promise<Boolean>{
    return new Promise<Boolean>(async (resolve, reject) => {
        return vscode.window.showInformationMessage("c_cpp_properties.json/settings.json points to wrong compile_commands.json", "Fix").then(async selection => {
            if (selection === "Fix"){
                resolve(true);
            }else{
                resolve(false);
            }
          });
    });

}