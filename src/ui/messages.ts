import * as vscode from 'vscode';
import { rescanIndex } from '../contextState/cmds';
import { gCscope } from '../extension';


export function askReloadFiles(){
    void vscode.window.showInformationMessage("Configuration changed. Need to rescan index", "Rescan now").then(async selection => {
        if (selection === "Rescan now"){
            await rescanIndex();
            
        }
      });
}


export function infoMissingCompileInfo(){
    void vscode.window.showInformationMessage("Compile Info folder is missing.", "How to enable?").then(async selection => {
        if (selection === "How to enable?"){
            await vscode.env.openExternal(vscode.Uri.parse("https://github.com/intel/Edk2Code/wiki/Index-source-code#enable-compile-information"));
        }
      });
}

export function infoMissingCompilesCommandCpp(){
    void vscode.window.showInformationMessage("Build contains compile_commands.json but C++ is not configured","Fix", "Help").then(async selection => {
        if (selection === "Help"){
            await vscode.env.openExternal(vscode.Uri.parse("https://github.com/intel/Edk2Code/wiki/Index-source-code#enable-compile-information"));
        }
      });
}

export async function updateCompilesCommandCpp():Promise<Boolean>{
    return new Promise<Boolean>(async (resolve, reject) => {
        return vscode.window.showInformationMessage("c_cpp_properties.json points to wrong compile_commands.json", "Fix").then(async selection => {
            if (selection === "Fix"){
                resolve(true);
            }else{
                resolve(false);
            }
          });
    });

}