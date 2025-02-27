import path = require("path");
import { gModuleReport } from "./extension";
import * as fs from 'fs';
import { assert } from "console";
import { normalizePath, pathCompare } from "./utils";
import { getEdkCodeFolderFilePath } from "./edk2CodeFolder";


export class EdkFile{
    data: any;
    path:string;
    constructor(data:any){
        this.data = data;
        this.path = data["Path"];
    }
}

export class EdkFunction{
    name: string;
    constructor(name:string){
        this.name = name;
    }
}

export class EdkLibraryClass{
    data: any;
    constructor(data:any){
        this.data = data;
    }
}

export class EdkLibrary{
    data: any;
    path:string;
    constructor(data:any){
        this.data = data;
        this.path = data["Path"];
    }
}

export class EdkGuid{
    data: any;
    constructor(data:any){
        this.data = data;
    }
}

export class EdkPackage{
    data: any;
    constructor(data:any){
        this.data = data;
    }
}

export class EdkPcd{
    data: any;
    constructor(data:any){
        this.data = data;
    }
}

export class EdkModule{


    name:string;
    arch:string;
    path: string;
    guid: string;
    buildType: string;
    isLibrary: string;
    sourceDir: string;
    files:EdkFile[] = [];
    moduleEntryPointList: EdkFunction[];
    libraries: EdkLibrary[];
    constructorList: EdkFunction[];
    destructorList: EdkFunction[];
    packages: EdkPackage[];
    ppi: EdkGuid[];
    protocol: EdkGuid[];
    pcd: EdkPcd[];
    moduleReport: ModuleReport;
    libraryClassName: string;
    raw:any;


    constructor(data:any){
        this.raw = data;
        this.name = data["Name"];
        this.arch = data["Arch"];
        this.path = normalizePath(data["Path"]);
        this.guid = data["Guid"];
        this.buildType = data["BuildType"];
        this.isLibrary = data["IsLibrary"];
        this.sourceDir = data["SourceDir"];
        this.moduleReport = gModuleReport;
        if (data["LibraryClass"].length > 0){
            this.libraryClassName = data["LibraryClass"][0][0]; 
        }else{
            this.libraryClassName = "";
        }
        
        this.files = [];
        for (const file of data["Files"]) {
            this.files.push(new EdkFile(file));
        }
        
        // LibraryClass

        this.moduleEntryPointList = [];
        for (const i of data["ModuleEntryPointList"]) {
            this.moduleEntryPointList.push(new EdkFunction(i));
        }

        // constructor
        this.constructorList = [];
        for (const i of data["ConstructorList"]) {
            this.constructorList.push(new EdkFunction(i));
        }
        // destructor
        this.destructorList = [];
        for (const i of data["DestructorList"]) {
            this.destructorList.push(new EdkFunction(i));
        }

        //libraries
        this.libraries = [];
        for (const i of data["Libraries"]) {
            this.libraries.push(new EdkLibrary(i));
        }

        //packages
        this.packages = [];
        for (const i of data["Packages"]) {
            this.packages.push(new EdkPackage(i));
        }
        //ppi
        this.ppi = [];
        for (const i of data["PPI"]) {
            this.ppi.push(new EdkGuid(i));
        }
        //protocol
        this.protocol = [];
        for (const i of data["Protocol"]) {
            this.protocol.push(new EdkGuid(i));
        }
        //pcd
        this.pcd = [];
        for (const i of data["Pcd"]) {
            this.pcd.push(new EdkPcd(i));
        }
        
    }

    
    getInfLibrarySection(){
        return new EdkIniFile(this.path).getSection("LibraryClasses");
    }

    getLibrariesModules(){
        let librariesModules:EdkModule[] = [];
        for (const lib of this.libraries) {
            let libModule = this.moduleReport.getModule(lib.path);
            if(libModule!==undefined){
                librariesModules.push(libModule);
            }else{

            }
            
        }
        return librariesModules;
    }


    getUsages() {
        let callers = [];
        for (const mod of this.moduleReport.getModuleList()) {
            if(mod.usesLibrary(this)){
                callers.push(mod);
            }
        }
        return callers;
    }
    usesLibrary(module: EdkModule) {
        for (const lib of this.libraries) {
            if(pathCompare(lib.path,module.path)){
                return true;
            }
        }
        return false;
    }
}

export class ModuleReport
{
    isPopulated: boolean = false;
    private static instance: ModuleReport;
    reportPath: string;
    private data: any;
    private moduleData:EdkModule[];
    private treeString: string ="";
    
    constructor(){        
        this.reportPath = getEdkCodeFolderFilePath("module_report.json");
        this.moduleData = [];
        this.load();
    }

    public static getInstance(){
        if(!ModuleReport.instance){
            ModuleReport.instance = new ModuleReport();
        }
        return ModuleReport.instance;
    }

    load(){
        this.moduleData = [];
        if(!fs.existsSync(this.reportPath)){
            return;
        }
        let strData = fs.readFileSync(this.reportPath).toString();
        this.data = JSON.parse(strData);

        for (const d of this.data) {
            this.moduleData.push(new EdkModule(d));
        }

        if(this.moduleData.length === 0){
            this.isPopulated = false;
        }else{
            this.isPopulated = true;
        }

    }

    getModuleInfo(path:string){
        for (const module of this.moduleData) {
            if(pathCompare(module.path, path)){
                return module;
            }
        }
        return undefined;
    }

    getModule(path:string){
        let module;
        if (path.toLocaleLowerCase().endsWith(".inf")) {
            module = this.getModuleInfo(path);
        } else {
            module = this.searchModuleByFiles(path);
        }
        return module;
    }

    getModuleList(){
        return this.moduleData;
    }


    getLibraryTree(target:EdkModule, context:EdkModule){
        assert(!context.isLibrary);
        this.treeString="";
        let contextLibs = context.getLibrariesModules();
        let emptyList:any[] = [];
        let reportObject = {
            "name":"",
            "path":"",
            "children":emptyList,
            "recursive":false
        };
        this.getLibraryTreeRecursive(0, target,contextLibs, [], reportObject);
        // showVirtualFile(`Library Tree: ${target.name}`, this.treeString);
        return reportObject;
    }

    private getLibraryTreeRecursive(deep:number,target:EdkModule, contextLibs:EdkModule[],
                                    libraryTreesVisited:string[], reportObject:any){
        const tab = "\t".repeat(deep);
        if(libraryTreesVisited.includes(target.path)){

            reportObject["children"].push({
                "name":target.name,
                "path":target.path.replaceAll(path.sep, "\\"+path.sep),
                "children":[],
                "recursive":true
            });
            this.treeString += `${tab}${target.name} * ${target.path}\n`;
            return;
        }
        libraryTreesVisited.push(target.path);

        let targetReport = {
            "name":target.name,
            "path":target.path,
            "children":[],
            "recursive":false
        };
        reportObject["children"].push(targetReport);

        this.treeString += `${tab}${target.name} : ${target.path}\n`;

        let libraries = target.getInfLibrarySection();
        for (const lib of libraries) {
            // look for EdkModule based on library name
            let module = undefined;
            for (const contextLib of contextLibs) {
                if(contextLib.libraryClassName === lib || contextLib.name === lib){
                    module = contextLib;
                }
            }
            if(module === undefined){
                // This means this library is not compatible in this context
                continue;
            }
            
            this.getLibraryTreeRecursive(deep+1, module, contextLibs,libraryTreesVisited, targetReport);
        }
    }

    searchModuleByFiles(path:string){
        for (const module of this.getModuleList()) {
            for (const moduleFile of module.files) {
                if(pathCompare(moduleFile.path,path)){
                    return module;
                }
            }
            
        }
        return undefined;
    }

}

export class EdkIniFile{
    path: string;
    lines: string[];
    data: Map<any, string[]>;
    constructor(path:string){
        this.path = path;
        assert(fs.existsSync(this.path));
        this.data = new Map();
        // Read lines uncommented
        const lines = fs.readFileSync(this.path).toString().split(/\r?\n/);
        this.lines = [];
        for (let line of lines) {
            line = line.trim();
            if(line.startsWith("#")){continue;}
            if(line === ""){continue;}
            this.lines.push(line.split('#')[0].trim());
        }

        let currentSection = undefined;
        // loop on clean lines
        for (const line of this.lines) {
            if(line.startsWith("[")){
                let sectionName = line.replace("[","").replace("]","");
                if(!this.data.has(sectionName)){
                    this.data.set(sectionName,[]);
                    currentSection = sectionName;
                }
                continue;
            }
            this.data.get(currentSection)?.push(line);
        }
        
    }

    getSection(sectionName:string){
        sectionName = sectionName.toLocaleLowerCase();
        let returnData: string[] = [];
        for (const section of this.data.keys()) {
            if(section.split(".")[0].toLocaleLowerCase() === sectionName){
                const x = this.data.get(section);
                if(x!==undefined){
                    returnData = returnData.concat(x);
                }
            }
        }
        return returnData;
    }
}