
import { gDebugLog, gModuleReport } from "./extension";
import { EdkIniFile, EdkModule, ModuleReport } from "./moduleReport";

import { getNonce } from "./utilities/getNonce";
import { getUri } from "./utilities/getUri";
import { getCurrentDocument, gotoFile } from "./utils";
import * as vscode from 'vscode';
import { TreeWebview } from "./TreeWebview";
import { TreeDetailsDataProvider, TreeItem } from "./TreeDataProvider";

class ModulePickOption implements vscode.QuickPickItem{
    label: string;
    kind?: vscode.QuickPickItemKind | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    picked?: boolean | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly vscode.QuickInputButton[] | undefined;
    module:EdkModule;
    constructor(module:EdkModule){
        this.label = module.name;
        this.description=module.arch;
        this.detail = module.path;
        this.module = module;
    }

}

export async function showLibraryTree(){
    gDebugLog.debug("CMD show library tree");
    let document = getCurrentDocument();
    
    let moduleReport = gModuleReport;
    if(document === undefined){return;}

    gDebugLog.debug(document.fileName);

    if(!document.fileName.endsWith(".inf")){
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showErrorMessage("Run this command when you are on a .inf file");
      return;
    }

    // if(!gEdkDatabase.isFileInuse(document.fileName)){
    //   // eslint-disable-next-line @typescript-eslint/no-floating-promises
    //   vscode.window.showErrorMessage("This file is not in use on the current compilation");
    //   return;
    // }
    

    if(!moduleReport.isPopulated){
      void vscode.window.showErrorMessage("Module information was not generated during compilation.", "Help").then(async selection => {
        if (selection === "Help"){
            await vscode.env.openExternal(vscode.Uri.parse(
                'https://github.com/intel/Edk2Code/wiki/Index-source-code#enable-compile-information'));
        }
      });
      return;
    }

    let moduleTarget = moduleReport.getModule(document.fileName);
    if(moduleTarget===undefined){
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showErrorMessage("This works after EDK project is loaded from build folder");
      return;
    }

    let contextModule;
    if(moduleTarget.isLibrary){
        let moduleUsers = moduleTarget.getUsages();
        var options: ModulePickOption[] = [];
        for (const mod of moduleUsers) {
            options.push(new ModulePickOption(mod));
        }

        let option = await vscode.window.showQuickPick(options, {title: "This is a library, select module context", matchOnDescription:true, matchOnDetail:true});
        if (option === undefined) {return;}
        contextModule = option.module;
    }else{
        contextModule = moduleTarget;
    }

    let reportObject = moduleReport.getLibraryTree(moduleTarget, contextModule);
    let treeProvider = new TreeDetailsDataProvider();
    let root = new TreeItem(reportObject["children"][0]["name"]);
    root.description = reportObject["children"][0]["path"];
    treeProvider.addChildren(root);
    for (const curerntNode of reportObject["children"][0]["children"]) {
      processReport(curerntNode, root);
    }
    
    let treeView = new TreeWebview(treeProvider,moduleTarget.name, contextModule.name);
    treeView.render();

}

function processReport(currentNode:any, node: TreeItem){
  let newNode = new TreeItem(currentNode["name"]);
  newNode.description = currentNode["path"];
  node.addChildren(newNode);

  if(currentNode["children"].length > 0){
    for (const r of currentNode["children"]) {
      processReport(r, newNode);
    }
  }
}
