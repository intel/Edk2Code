import { getCurrentVersion } from "../utils";
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function showReleaseNotes(context: vscode.ExtensionContext){
    const CURRENT_VERSION = getCurrentVersion();
    const previousVersion = context.globalState.get<string>('extensionVersion');
    if (previousVersion !== CURRENT_VERSION) {
        await context.globalState.update('extensionVersion', CURRENT_VERSION);
        
        const releaseNotesPath = path.join(context.extensionPath, 'src', 'newVersionPage', `${CURRENT_VERSION}.md`);
        if (fs.existsSync(releaseNotesPath)) {
            const releaseNotesUri = vscode.Uri.file(releaseNotesPath);
            await vscode.commands.executeCommand('markdown.showPreview', releaseNotesUri);
        }
    }
}