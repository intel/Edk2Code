import * as vscode from 'vscode';
import { CppProvider } from './cppProvider';
import { updateCompilesCommandCpp } from '../ui/messages';

export class ClangdProvider extends CppProvider {
    extensionId = "llvm-vs-code-extensions.vscode-clangd";
    isCpptoolsInstalled(): boolean {
        return vscode.extensions.getExtension(this.extensionId) !== undefined;
    }

    async validateConfiguration(): Promise<boolean> {
        const expectedArgument = "--compile-commands-dir=${workspaceFolder}/.edkCode/";
        const clangdConfiguration = vscode.workspace.getConfiguration('clangd');
        const clangdArguments = clangdConfiguration.get<string[]>('arguments') || [];
        const existingIndex = clangdArguments.findIndex(arg => arg.startsWith('--compile-commands-dir='));
        let updatedArguments = [...clangdArguments];
        if (existingIndex === -1) {
            let update = await updateCompilesCommandCpp();
            if (update) {
                updatedArguments.push(expectedArgument);
                await clangdConfiguration.update('arguments', updatedArguments, vscode.ConfigurationTarget.Workspace);
            }
        } else if (!clangdArguments.includes(expectedArgument)) {
            let update = await updateCompilesCommandCpp();
            if (update) {
                updatedArguments[existingIndex] = expectedArgument;
                await clangdConfiguration.update('arguments', updatedArguments, vscode.ConfigurationTarget.Workspace);
            }
        }

        return true;
    }
}