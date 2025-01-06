import * as vscode from 'vscode';
import { CppProvider } from './cppProvider';
import * as fs from 'fs';
import { closeFileIfOpened, delay } from '../utils';
import { gDebugLog, gWorkspacePath } from '../extension';
import path = require("path");
import { updateCompilesCommandCpp } from '../ui/messages';

export class MsCppProvider extends CppProvider {
    extensionId = "ms-vscode.cpptools";
    fixFile: Boolean|undefined = undefined;

    async isFixFile(): Promise<Boolean> {
        if (this.fixFile === undefined){
            let update = await updateCompilesCommandCpp();
            this.fixFile = update;
        }
        return this.fixFile;
    }

    isCpptoolsInstalled(): boolean {
        return vscode.extensions.getExtension(this.extensionId) !== undefined;
    }

    async validateConfiguration(): Promise<boolean> {

        if(!this.isCppPropertiesFile()){
            if(! await this.isFixFile()){
                return true;
            }
            await this.touchCppPropertiesFile(); // Asks CPP extension to create the file
        }
        
        let retries = 30;
        while(retries){
            if(await this.fixCppPropertiesFile()){
                break;
            }
            await delay(100);
            retries--;
        }
        return true;
    }

    private async touchCppPropertiesFile(){
        await vscode.commands.executeCommand('C_Cpp.ConfigurationEditJSON');
    }

    private getCppPropertiesPath(){
        let cCppPropertiesPath = path.join(gWorkspacePath, ".vscode", "c_cpp_properties.json");
        return cCppPropertiesPath;
    }

    async fixCppPropertiesFile(){
        if(this.isCppPropertiesFile()){
            try {
    
                await closeFileIfOpened(this.getCppPropertiesPath());
    
                let cProperties = JSON.parse(fs.readFileSync(this.getCppPropertiesPath()).toString());
                const expectedPath = path.join("${workspaceFolder}", ".edkCode", "compile_commands.json");
                const commandsPath = cProperties["configurations"][0]["compileCommands"];
                gDebugLog.debug(`cCppPropertiesPath: ${commandsPath}`);
                gDebugLog.debug(`expectedPath: ${expectedPath}`);
                if(commandsPath !== expectedPath){
                    let update = await this.isFixFile();
                    if(!update){
                        return true;
                    }
                    cProperties["configurations"][0]["compileCommands"] = expectedPath;
                    fs.writeFileSync(this.getCppPropertiesPath(), JSON.stringify(cProperties,null,4));
                }
                
            } catch (error) {
                gDebugLog.error(String(error));
            }
            return true;
        }
        return false;
    }

    private isCppPropertiesFile(){
        if (fs.existsSync(this.getCppPropertiesPath())) {
            return true;
        }
        return false;
    }
}

