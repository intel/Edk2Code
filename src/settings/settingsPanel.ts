import * as vscode from 'vscode';
import { getNonce } from "../utilities/getNonce";
import { getUri } from "../utilities/getUri";
import * as fs from 'fs';
import * as path from 'path';
import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { gExtensionContext } from '../extension';
import { ConfigAgent, WorkspaceConfig, WorkspaceConfigErrors } from '../configuration';
import { askReloadFiles } from '../ui/messages';


function deepCopy(obj: any) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: WebviewPanel;
    private _disposables: Disposable[] = [];
    private configAgent: ConfigAgent|undefined;

    private addConfigRequested = new vscode.EventEmitter<string>();
    private _configValuesChanged = new vscode.EventEmitter<void>();

    public get configValuesChanged(): vscode.Event<void> {
        return this._configValuesChanged.event;
    }

    initialized: boolean = false;
    settingsPanelActivated: any;

    /**
     * The HelloWorldPanel class private constructor (called only from the render method).
     *
     * @param panel A reference to the webview panel
     * @param extensionUri The URI of the directory containing the extension
     */
    private constructor(panel: WebviewPanel, extensionUri: Uri) {
        this._panel = panel;

        // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
        // the panel or when the panel is closed programmatically)
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Set the HTML content for the webview panel
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

        // Set an event listener to listen for messages passed from the webview context
        this._setWebviewMessageListener(this._panel.webview);
    }

    /**
     * Renders the current webview panel if it exists otherwise a new webview panel
     * will be created and displayed.
     *
     * @param extensionUri The URI of the directory containing the extension.
     */
    public static render(extensionUri: Uri, configAgent:ConfigAgent) {
        if (SettingsPanel.currentPanel) {
            // If the webview panel already exists reveal it
            SettingsPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            // If a webview panel does not already exist create and show a new one
            const panel = window.createWebviewPanel(
                // Panel view type
                "showHelloWorld",
                // Panel title
                "EDK2 Configuration",
                // The editor column the panel should be displayed in
                vscode.ViewColumn.One,
                // Extra panel configurations
                {
                    enableCommandUris:true,
                    // Enable JavaScript in the webview
                    enableScripts: true,
                    // Restrict the webview to only load resources from the `out` directory
                    localResourceRoots: [Uri.joinPath(extensionUri, "out")],
                }
            );
            
            SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
            SettingsPanel.currentPanel.configAgent = configAgent;
            SettingsPanel.currentPanel.configValuesChanged(() => configAgent.saveConfigurationUI());

        }
    }

    /**
     * Cleans up and disposes of webview resources when the webview panel is closed.
     */
    public dispose() {
        SettingsPanel.currentPanel = undefined;

        // Dispose of the current webview panel
        this._panel.dispose();

        // Dispose of all disposables (i.e. commands) associated with the current webview panel
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Defines and returns the HTML that should be rendered within the webview panel.
     *
     * @remarks This is also the place where *references* to CSS and JavaScript files
     * are created and inserted into the webview HTML.
     *
     * @param webview A reference to the extension webview
     * @param extensionUri The URI of the directory containing the extension
     * @returns A template string literal containing the HTML that should be
     * rendered within the webview panel
     */
    private _getWebviewContent(webview: vscode.Webview, extensionUri: Uri) {

        let content = fs.readFileSync(getUri(webview, extensionUri, ["src", "settings", "settings.html"]).fsPath).toString();
        content = content.replace(
            /{{nonce}}/g,
            getNonce());

        const settingsJsUri: vscode.Uri = this._panel.webview.asWebviewUri(getUri(webview, extensionUri, ["out", "settings", "settings.js"]));
        content = content.replace(
            /{{settings_js_uri}}/g,
            settingsJsUri.toString());

        return content;
    }


    private onMessageReceived(message: any): void {
        if (message === null || message === undefined) {
            return;
        }
        switch (message.command) {
            case 'change':
                this.updateConfig(message);
                break;
            case 'configSelect':
                this.configSelect(message.index);
                break;
            case 'addConfig':
                this.addConfig(message.name);
                break;
            case 'knownCompilerSelect':
                this.knownCompilerSelect();
                break;
            case "initialized":
                this.initialized = true;
                this.initilizePanel();
                break;
        }


    }
    
    initilizePanel() {
        SettingsPanel.currentPanel!.updateWebview(this.configAgent!.getWorkspaceConfig(), this.configAgent!.getWorkspaceErrors());
    }

    updateConfig(message: any) {
        let configData = message.config;
        let config:any = {};
        for (const key in configData) {
            let data = configData[key].split("\n").map((x:string)=>{return x.trim();});
            config[key] = data;
        }
        SettingsPanel.currentPanel?.configAgent?.writeWorkspaceConfig(config);

        askReloadFiles();
    }
    configSelect(index: any) {
        throw new Error('Method not implemented.');
    }
    knownCompilerSelect() {
        throw new Error('Method not implemented.');
    }

    private addConfig(name: string): void {
        this.addConfigRequested.fire(name);
    }


    /**
     * Sets up an event listener to listen for messages passed from the webview context and
     * executes code based on the message that is recieved.
     *
     * @param webview A reference to the extension webview
     */
    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(this.onMessageReceived, this);
    }


    updateWebview(data:WorkspaceConfig, errors:WorkspaceConfigErrors|null): void {
        let configValues = deepCopy(data); // Copy configuration values
        if (this._panel && this.initialized) {
            void this._panel.webview.postMessage({ command: 'updateConfig', config: configValues });
            if (errors !== null) {
                void this._panel.webview.postMessage({ command: 'updateErrors', errors: errors });
            }
        }
    }
}