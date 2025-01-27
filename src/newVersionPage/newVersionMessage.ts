import { getCurrentVersion } from "../utils";
import * as vscode from 'vscode';


export async function showReleaseNotes(context: vscode.ExtensionContext){
    const CURRENT_VERSION = getCurrentVersion();
    const previousVersion = context.globalState.get<string>('extensionVersion');
    if (previousVersion !== CURRENT_VERSION) {
        const panel = vscode.window.createWebviewPanel(
            'releaseNotes',
            `EDK2Code Release Notes ${CURRENT_VERSION}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
            }
        );

        panel.webview.html = `
<h1>Edk2Code <strong>${CURRENT_VERSION}</strong></h1>
<p>Thanks for using the <strong>Edk2Code Vscode extension</strong>.</p>
<p>🎉 If you find this extension useful 🎉:</p>
<ul>
<li>⭐ Give a start on <a href="https://github.com/intel/Edk2Code">Github</a></li>
<li>📜 Leave a review in <a href="https://marketplace.visualstudio.com/items?itemName=intel-corporation.edk2code">Vscode marketplace</a></li>
</ul>
<h2><a href="https://intel.github.io/Edk2Code/releases/${CURRENT_VERSION}/">View new features</a></h2>
           `;
        await context.globalState.update('extensionVersion', CURRENT_VERSION);
    }
}