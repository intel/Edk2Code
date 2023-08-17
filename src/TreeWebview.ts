
import * as vscode from 'vscode';
import { TreeDetailsDataProvider, TreeItem } from './TreeDataProvider';
import { copyTreeProviderToClipboard, gotoFile, openFileSide } from './utils';
import { gExtensionContext } from './extension';
import { getNonce } from './utilities/getNonce';
import path = require('path');

//https://bendera.github.io/vscode-webview-elements/

export class TreeWebview {
    treeProvider: TreeDetailsDataProvider;
    private count: number = 0;
  contextModule: string;
  targetModule: string;
    
    constructor(treeProvider: TreeDetailsDataProvider, targetModule:string, contextModule:string) {
        this.treeProvider = treeProvider;
        this.targetModule = targetModule;
        this.contextModule = contextModule;
    }

    private processTree(currentNode: TreeItem, htmlText: string) {
        let children = <TreeItem[]>currentNode.children;
        

        let returnHtml =`
        {
          icons,
          label: '${currentNode.label}',
          value: '${currentNode.description?.toString().replaceAll("\\","/")}',
          open: true,
        `;

        if (children.length > 0) {
            returnHtml += `subItems: [`;
            for (const r of children) {
                returnHtml += this.processTree(r, htmlText);
            }
            returnHtml += `],`;
        }
        return returnHtml + "},";
    }

    render() {
        let htmlTree = "";
        for (const items of <TreeItem[]>this.treeProvider.getChildren()) {
            htmlTree += this.processTree(items, '');
        }

        const webviewPanel = vscode.window.createWebviewPanel(
            'vscodeTest',
            `Library tree: ${path.basename(this.targetModule)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true
            }
        );
        webviewPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openFile':
                        openFileSide(vscode.Uri.file(message.path), new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)));
                        return;
                    case 'copy':
                      copyTreeProviderToClipboard(this.treeProvider);
                      return;
                }
            },
            undefined,
            gExtensionContext.subscriptions
        );
        this.setHtmlContent(webviewPanel.webview, gExtensionContext, htmlTree);
    }


    setHtmlContent(webview: vscode.Webview, extensionContext: vscode.ExtensionContext, reportObject: any) {
      const nonce = getNonce();

      const fileUri = (fp: string) => {
        const fragments = fp.split('/');
        return vscode.Uri.file(
          path.join(extensionContext.asAbsolutePath(""),...fragments)
        );
      };

      const assetUri = (fp: string) => {
        return webview.asWebviewUri(fileUri(fp));
      };

        let htmlContent = /*html*/
        
    `
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="${assetUri('node_modules/@vscode/codicons/dist/codicon.css')}" nonce="${nonce}" id="vscode-codicon-stylesheet">
			<script src="${assetUri('node_modules/@bendera/vscode-webview-elements/dist/bundled.js')}" nonce="${nonce}" type="module"></script>
    </head>
    <script>
      const vscode = acquireVsCodeApi();
      document.addEventListener('DOMContentLoaded', () => {
        const tree = document.querySelector('#tree');

        const icons = {
          branch: 'chevron-right',
          leaf: 'circle-small',
          open: 'chevron-down',
        };

        const data = [
          ${reportObject}
        ];
        tree.data = data;

        tree.addEventListener('vsc-select', (event) => {

          vscode.postMessage({
              command: 'openFile',
              path: event.detail.value
          })
        });

        document.getElementById('button-1').addEventListener('vsc-click', (ev) => {
          vscode.postMessage({
              command: 'copy'
          })
        });

      });
    </script>
    <body>
      <div style="background: ghostwhite;
      padding: 10px;
      border-radius: 5px;">
      <p>Library dependencies of <code>${this.targetModule}</code> in context of <code>${this.contextModule}</code> module.
      <br><small>Recursive dependencies are ommited.</small></p>
      <vscode-button id="button-1" icon="copy">Copy tree</vscode-button>
      </div>
      <vscode-tree id="tree"></vscode-tree>
    </body>
  </html>
  `;
        webview.html = htmlContent;
    }
}



