import * as vscode from 'vscode';
import path = require("path");
import { gDebugLog, gWorkspacePath } from './extension';
import * as fs from 'fs';
import { infoMissingCppExtension } from './ui/messages';
import { closeFileIfOpened, delay } from './utils';



export async function checkCppConfiguration(){
    // Check if CPP extesion is installed
    if(!isCpptoolsInstalled()){
        infoMissingCppExtension();
        return;
    }

    if(!isCppPropertiesFile()){
        await touchCppPropertiesFile(); // Asks CPP extension to create the file
    }
    
    let retries = 30;
    while(retries){
        if(fixCppPropertiesFile()){
            break;
        }
        await delay(100);
        retries--;
    }
}


function getCppPropertiesPath(){
    let cCppPropertiesPath = path.join(gWorkspacePath, ".vscode", "c_cpp_properties.json");
    return cCppPropertiesPath;
}

export function isCpptoolsInstalled() {
    const cpptoolsExtension = vscode.extensions.getExtension('ms-vscode.cpptools');
    if (!cpptoolsExtension) {
        return false;
    }
    return true;
}

export function isCppPropertiesFile(){
    if (fs.existsSync(getCppPropertiesPath())) {
        return true;
    }
    return false;
}

export async function touchCppPropertiesFile(){
    await vscode.commands.executeCommand('C_Cpp.ConfigurationEditJSON');
}

export function fixCppPropertiesFile(){
    if(isCppPropertiesFile()){
        try {

            void closeFileIfOpened(getCppPropertiesPath());

            let cProperties = JSON.parse(fs.readFileSync(getCppPropertiesPath()).toString());
            const expectedPath = path.join("${workspaceFolder}", ".edkCode", "compile_commands.json");
            const commandsPath = cProperties["configurations"][0]["compileCommands"];
            gDebugLog.debug(`cCppPropertiesPath: ${commandsPath}`);
            gDebugLog.debug(`expectedPath: ${expectedPath}`);
            if(commandsPath !== expectedPath){
                cProperties["configurations"][0]["compileCommands"] = expectedPath;
                fs.writeFileSync(getCppPropertiesPath(), JSON.stringify(cProperties,null,4));
            }
            
        } catch (error) {
            gDebugLog.error(String(error));
        }
        return true;
    }
    return false;
}