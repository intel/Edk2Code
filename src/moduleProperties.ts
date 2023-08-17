import * as vscode from 'vscode';
import { ModuleReport } from './moduleReport';
import { getRealPath, getRealPathRelative, openedFilePath } from './utils';

import { edkLensTreeDetailProvider, edkLensTreeDetailView, gModuleReport, gEdkDatabase } from './extension';
import { TreeItem } from './TreeDataProvider';



export class ModuleProperties {
    moduleReport: ModuleReport;


    private setTitle(text:string){
        edkLensTreeDetailView.title = `EDK2 ${text}`;
    }

    constructor() {
        vscode.window.onDidChangeActiveTextEditor(this.fileOpened, this);
        this.moduleReport = gModuleReport;
        this.moduleReport.load();
    }

    private clearProperties(){
        edkLensTreeDetailProvider.clear();
        edkLensTreeDetailProvider.refresh();
        this.setTitle("Not module selected");
    }

    async fileOpened() {
        let openFile = await openedFilePath();
        if (openFile === undefined) { return; }

        let fileStatus = await gEdkDatabase.isFileInuse(openFile);
        if (fileStatus === false) { 
            this.clearProperties();
            return; 
        }

        this.moduleReport.load();
        let module = this.moduleReport.getModule(openFile);
        
        if(module === undefined){
            this.clearProperties();
            return;
        }
        
        edkLensTreeDetailProvider.clear();
        this.setTitle(module.name);



        let propertyList = [
            "Name",
            "Arch",
            "Guid",
            "BuildType"
        ];

        for (const prop of propertyList) {
            edkLensTreeDetailProvider.addChildren(new Edk2TreeProperty(prop, module.raw));
        }


        edkLensTreeDetailProvider.addChildren(new Edk2TreePropertyFile("Path", module.raw));
        edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayFiles("Files", module.raw["Files"]));

        if (module.isLibrary) {
            edkLensTreeDetailView.title += " (Lib)";

            edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayFunctions("Constructors", module.raw["ConstructorList"]));
            edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayFunctions("Destructors", module.raw["DestructorList"]));

        } else {
            // Libraries are resolved in driver context
            edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayFunctions("ModuleEntryPoints", module.raw["ModuleEntryPointList"]));
            edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayFiles("Libraries", module.raw["Libraries"]));
        }

        edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayGuids("PPI", module.raw["PPI"]));
        edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayGuids("Protocol", module.raw["Protocol"]));
        edkLensTreeDetailProvider.addChildren(new Edk2TreeArrayFiles("Packages", module.raw["Packages"]));

        edkLensTreeDetailProvider.refresh();
    }



}



class Edk2TreeProperty extends TreeItem {
    module: any;
    constructor(label: string, module: any) {
        super(label);
        this.module = module;
        this.description = module[label];
        this.iconPath = new vscode.ThemeIcon("symbol-constant");
    }
}

class Edk2TreePropertyFile extends Edk2TreeProperty {
    constructor(label: string, module: any) {
        super(label, module);
        this.label = "";
        this.description = getRealPathRelative(this.module[label]);
        this.iconPath = undefined;
        this.resourceUri = vscode.Uri.file(getRealPath(this.module[label]));
        this.command = {
            title: "",
            command: "vscode.open",
            arguments: [vscode.Uri.file(this.module[label])]
        };
    }
}

class Edk2ArrayItem extends Edk2TreeProperty {
    constructor(label: string, itemsList: any) {

        super(label, module);
        this.iconPath = new vscode.ThemeIcon("array");

        if(itemsList.length === 0){
            this.visible = false;
        }

        for (const item of itemsList) {
            this.populate(item);
        }
    }
    populate(item: any) {
        throw new Error("Not implemented");
    }
}

class Edk2TreeArrayFiles extends Edk2ArrayItem {
    populate(item: any) {
        let tempNode = new Edk2TreePropertyFile("Path", item);
        tempNode.label = "";
        this.addChildren(tempNode);
    }
}

class Edk2TreeArrayFunctions extends Edk2ArrayItem {

    populate(item: any) {
        let tempNode = new TreeItem(item);
        tempNode.iconPath = new vscode.ThemeIcon("symbol-method");
        // TODO:Change to look only in source files
        tempNode.command = {
            title: "",
            command: "edk2code.searchDefinition",
            arguments: [item]
        };
        this.addChildren(tempNode);
    }
}

class Edk2TreeArrayGuids extends Edk2ArrayItem {
    
    populate(item: any) {
        let tempNode = new TreeItem(item["Name"]);
        tempNode.description = item["Guid"];
        tempNode.iconPath = new vscode.ThemeIcon("symbol-object");
        // Change to look only in Packages
        tempNode.command = {
            title: "",
            command: "edk2code.searchDefinition",
            arguments: [item["Name"]]
        };
        this.addChildren(tempNode);
    }
}
