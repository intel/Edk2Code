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
            void vscode.env.openExternal(vscode.Uri.parse("https://intel.github.io/Edk2Code/advance_features/#how-to-enable-compile-information"));
        }
    });
}



export function infoMissingCppExtension() {
    if (gConfigAgent.isWarningCppExtension()) {
        void vscode.window.showInformationMessage(
            "The MS C/C++ or Clangd extension is not installed. Please install one of those to use full EDK2Code features.",
            "Install Extension",
            "Don't show this message again",
            "Close"
        ).then(async selection => {
            if (selection === "Install Extension") {
                const extensionChoice = await vscode.window.showQuickPick(
                    ["C/C++ for Visual Studio Code", "Clangd"],
                    { placeHolder: "Select the extension to install" }
                );

                if (extensionChoice === "C/C++ for Visual Studio Code") {
                    void vscode.env.openExternal(vscode.Uri.parse('vscode:extension/ms-vscode.cpptools'));
                } else if (extensionChoice === "Clangd") {
                    void vscode.env.openExternal(vscode.Uri.parse('vscode:extension/llvm-vs-code-extensions.vscode-clangd'));
                }
            } else if (selection === "Don't show this message again") {
                await gConfigAgent.setWarningCppExtension(false);
            }
        });
    }
}


export async function isFixWorkspacePath(buildPath:string, workspacePath:string):Promise<Boolean>{
    return new Promise<Boolean>(async (resolve, reject) => {
        return vscode.window.showInformationMessage(`The Active platform in the build directory "${buildPath}" is different than Vscode Workspace path folder "${workspacePath}". Do you want EDK2Code to attempt to fix it? **Build directory wont be modified by this**`, "Yes", "No").then(async selection => {
            if (selection === "Yes"){
                resolve(true);
            }else{
                resolve(false);
            }
          });
    });

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