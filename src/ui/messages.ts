import * as vscode from 'vscode';
import { rescanIndex } from '../contextState/cmds';
import { gCscope } from '../extension';
import { delay, fixCompileCommands } from '../utils';


export function askReloadFiles(){
    void vscode.window.showInformationMessage("Configuration changed. Need to rescan index", "Rescan now").then(async selection => {
        if (selection === "Rescan now"){
            await rescanIndex();
            
        }
      });
}

export function isCpptoolsExtension() {
    const cpptoolsExtension = vscode.extensions.getExtension('ms-vscode.cpptools');
    if (!cpptoolsExtension) {
		missingCppExtension();
        return false;
    }
    return true;
}

export function infoMissingCompileInfo(){
    if(isCpptoolsExtension()===true){
        void vscode.window.showInformationMessage("Compile Info folder is missing.", "How to enable?").then(async selection => {
            if (selection === "How to enable?"){
                void vscode.env.openExternal(vscode.Uri.parse("https://github.com/intel/Edk2Code/wiki/Index-source-code#enable-compile-information"));
            }
        });
    }
}


export function missingCppExtension(){
    void vscode.window.showInformationMessage("The ms-vscode.cpptools extension is not installed. Please install it to use full EDK2Code features.", "Install").then(async selection => {
        if (selection === "Install"){
            void vscode.env.openExternal(vscode.Uri.parse('vscode:extension/ms-vscode.cpptools'));
        }
    });
}

export function infoMissingCompilesCommandCpp(){
    void vscode.window.showInformationMessage("Build contains compile_commands.json but C++ is not configured", "Fix").then(async selection => {
        if (selection === "Fix"){
            // await vscode.env.openExternal(vscode.Uri.parse("https://github.com/intel/Edk2Code/wiki/Index-source-code#compile_commandsjson"));
            await vscode.commands.executeCommand('C_Cpp.ConfigurationEditJSON');

            let attempts = 5;
            while(attempts){
                if(await fixCompileCommands()){
                    return;
                }
                attempts--;
                await delay(1000);;
            }

        }
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