// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


import { DebugLog, LogLevel } from './debugLog';
import { ConfigAgent } from './configuration';
import { Cscope, CscopeAgent } from './cscope';
import { gotoFile,isWorkspacePath, pathCompare, showVirtualFile, toPosix} from './utils';
import * as edkStatusBar from './statusBar';
import { FileUseWarning } from './usedFileTracker';
import glob = require("fast-glob");
import { TreeDetailsDataProvider } from './TreeDataProvider';
import { gotoContexOcurrences as showReferences, gotoDefinition, gotoDefinitionInput, gotoDefinitionText, gotoDscDeclaration, gotoDscInclusion, gotoInf, libUsage, openFile, searchCcode } from './navigation';
import { ModuleProperties } from './moduleProperties';
import { Edk2CallHierarchyProvider } from './callHiearchy';
import * as fs from 'fs';

//Test
import { showLibraryTree } from './libraryTree';
import { GrayoutController } from './grayout';

import { Edk2SymbolProducer, Edk2SymbolType } from './edkParser/edkSymbols';
import { initLanguages as initLanguagesProviders } from './Languages/languages';
import path = require('path');
import { ModuleReport } from './moduleReport';
import { AslParser } from './edkParser/aslParser';
import { VfrParser } from './edkParser/vfrParser';
import { EdkDatabase } from './edkParser/edkDatabase';

import { BuildFolder } from './Languages/buildFolder';
import { ProjectReport } from './projectReport';
import { DscParser } from './edkParser/dscParser';
import { ErrorReportAgent } from './errorReport/errorReportAgent';



// Global variables
export var gEdkDatabase: EdkDatabase;

export var gExtensionContext: vscode.ExtensionContext;
export var gWorkspacePath: string;
export var gConfigAgent = new ConfigAgent();
export var gCscope:Cscope;
export var gCscopeAgen: CscopeAgent; // Agent to update cscope database
export var gDscParser:DscParser;
export var gAslParser:AslParser;
export var gVfrParser:VfrParser;
export var gSymbolProducer:Edk2SymbolProducer;
export var gDebugLog: DebugLog;
export var gFileUseWarning: FileUseWarning;
export var gGrayOutController: GrayoutController;
export var gModuleReport: ModuleReport;
export var gErrorReportAgent:ErrorReportAgent;

// To clean up
export var moduleProperties: ModuleProperties;
var edk2CallHierarchyProvider: Edk2CallHierarchyProvider;
export var edkLensTreeDetailProvider: TreeDetailsDataProvider;
export var edkLensTreeDetailView: vscode.TreeView<vscode.TreeItem>;



// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	gDebugLog = new DebugLog();

	
	if (vscode.workspace.workspaceFolders !== undefined) {
        for (const p of vscode.workspace.workspaceFolders) {
			gDebugLog.info(`Workpace path: ${p.uri.fsPath}`);
        }
        gWorkspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }else{
        gDebugLog.info("Workspace not detected");
        return;
    }


	var commands = [
		vscode.commands.registerCommand('edk2code.rebuildIndex', rebuildIndexDatabase),
		vscode.commands.registerCommand('edk2code.reloadIndex', reloadIndex),
		vscode.commands.registerCommand('edk2code.openFile', async ()=>{await openFile();}),
		vscode.commands.registerCommand('edk2code.openLib', async ()=>{await openFile(Edk2SymbolType.dscLibraryDefinition);}),
		vscode.commands.registerCommand('edk2code.openModule', async ()=>{await openFile(Edk2SymbolType.dscModuleDefinition);}),
		vscode.commands.registerCommand('edk2code.gotoDefinition', gotoDefinition),
		vscode.commands.registerCommand('edk2code.gotoDefinitionInput', gotoDefinitionInput),
		vscode.commands.registerCommand('edk2code.searchCcode', searchCcode),
		vscode.commands.registerCommand('edk2code.saveBuildConfiguration', async ()=>{await gConfigAgent.saveBuildConfig();}),
		vscode.commands.registerCommand('edk2code.loadBuildConfiguration', async ()=>{await gConfigAgent.loadBuildConfig();}),
		
		vscode.commands.registerCommand('edk2code.gotoInf',async ()=>{await gotoInf();}),
		vscode.commands.registerCommand('edk2code.dscUsage', async ()=>{await gotoDscDeclaration();}),
		vscode.commands.registerCommand('edk2code.libUsage', async ()=>{await libUsage();}),
		vscode.commands.registerCommand('edk2code.dscInclusion', async ()=>{await gotoDscInclusion();}),
		vscode.commands.registerCommand('edk2code.showReferences', async ()=>{await showReferences();}),

		vscode.commands.registerCommand('edk2code.showLibraryTree', showLibraryTree),

		// Internal
		vscode.commands.registerCommand('edk2code.searchDefinition', gotoDefinitionText),
		vscode.commands.registerCommand("edk2code.gotoFile", async (fileUri, selRange)=>{await gotoFile(fileUri,selRange);}),
		vscode.commands.registerCommand("edk2code.viewWarnings", async ()=>{gErrorReportAgent.console.show();}),




		// Debug
		vscode.commands.registerCommand('edk2code.debugCommand', async ()=>{
			// Prints list of symbols detected
			let symbData = "";
			for (const par of gEdkDatabase.getParsersLang()) {
				symbData+= `${par.filePath}\n`;
				for (const sym of par.getSymbolsList()) {
					symbData += `  ${sym}\n`;
				}
			}
			symbData += "";
			await showVirtualFile("symbols",symbData,"json");

			let buildPath = await vscode.window.showOpenDialog({defaultUri:vscode.Uri.file(gWorkspacePath), canSelectFiles:true, canSelectFolders:false, canSelectMany:false,
				filters:{
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'JSON': ['json'],
				},
					title:"Select module_report.json"
				});
		
			// If build folder picked
			let jsonReference:any = [];
			if(buildPath){
				jsonReference = JSON.parse(fs.readFileSync(buildPath[0].fsPath).toString());
				
			}
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Parsing modules",
				cancellable: true
			}, async (progress, reject) => {
				// Print module libraries
				let libReport = "";
				let modules = await gEdkDatabase.findByType(Edk2SymbolType.dscModuleDefinition, "edk2_dsc");
				const increment = 100/modules.length;
				for (const module of modules) {
					libReport += `MODULE: ${module.value}\n`;
					progress.report({increment:increment, message:module.name});
					// Find reference Module
					let moduleName = gEdkDatabase.findByName("base_name","edk2_inf",module.value);
					let referenceModule;
					if(moduleName){
						for (const rm of jsonReference) {
							if(rm["Name"] === moduleName[0].value){
								referenceModule = rm;
							}
						}
					}


					// Get libraries of module
					let moduleLibraries = await gEdkDatabase.findByType(Edk2SymbolType.infLibrary,"edk2_inf", module.value);
					for (const moduleLibrary of moduleLibraries) {
						
						let libraryDef = await gEdkDatabase.getLibraryDefinition(moduleLibrary);
						if(libraryDef.length === 0){
							libReport += `  ERROR: ${moduleLibrary.value}\n`;
							let libraryDef = await gEdkDatabase.getLibraryDefinition(moduleLibrary);
						}
						for (const l of libraryDef) {
							
							if(referenceModule){
								// compare with reference
								let found = false;
								for (const refLib of referenceModule["Libraries"]) {
									if(pathCompare(refLib["Path"], l.value)){

										found = true;
										break;
									}
								}
								if(!found){
									libReport+= "Missmatch";
									let libraryDef = await gEdkDatabase.getLibraryDefinition(moduleLibrary);
								}
							}

							libReport += `  LIB: ${l.name}|${l.value}\n`;
						}
					}
				}
				await showVirtualFile("libraries", libReport, "text");
			});
			
		}),
	];

	context.subscriptions.concat(commands);
	gExtensionContext = context;
	gCscope = new Cscope();
	gCscopeAgen = new CscopeAgent();

	edkStatusBar.init(context);
	gGrayOutController = new GrayoutController();
	gSymbolProducer = new Edk2SymbolProducer();
	gEdkDatabase = new EdkDatabase();
	await gEdkDatabase.resetVariables();
	let settings = gEdkDatabase.getSettings();
	if(settings.dscFiles.length > 0){
		gEdkDatabase.setInputBuildDefines(settings.defines);
		gEdkDatabase.setPackagesPaths(settings.includes);
		
		await gEdkDatabase.load(settings.dscFiles);
	} else{
		edkStatusBar.setHelpUrl("https://github.com/intel/Edk2Code/wiki/Index-source-code");
		edkStatusBar.setText("Source not indexed");
		
	}
	
	initLanguagesProviders();
	gFileUseWarning = new FileUseWarning();
	edk2CallHierarchyProvider = new Edk2CallHierarchyProvider();
	
	gModuleReport = new ModuleReport();
	gModuleReport.load();
	if(0){
		
		edkLensTreeDetailProvider = new TreeDetailsDataProvider();
		edkLensTreeDetailView = vscode.window.createTreeView('detailsView', { treeDataProvider: edkLensTreeDetailProvider, showCollapseAll:true });
	}

	gErrorReportAgent = new ErrorReportAgent();

	
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function reloadIndex() {
	gDebugLog.verbose("reloadIndex()");
	let settings = gEdkDatabase.getSettings();
	if(settings.dscFiles.length > 0){
		await gEdkDatabase.resetVariables();
		gEdkDatabase.setInputBuildDefines(settings.defines);
		gEdkDatabase.setPackagesPaths(settings.includes);
		await gEdkDatabase.load(settings.dscFiles);
	}
}

async function rebuildIndexDatabase() {
	gDebugLog.verbose("rebuildIndexDatabase()");
	
	var options: vscode.QuickPickItem[] = [];
	options.push({
		label: "Reload from BUILD data",
		description: "Use this if posible",
		detail: "Will parse build information to give acurate results"
	});
	options.push({
		label: "Reload from DSC file (Experimental)",
		detail:"Will inffer build information and additional configuration is required. Results migth not be acurate"
	});


	let option = await vscode.window.showQuickPick(options, {title: "Selectg option", matchOnDescription:true, matchOnDetail:true});
	if(!option){return;}


	// LOAD FROM BUILD
	if(option.label === "Reload from BUILD data"){
		// Pick build folder
		let buildPath = await vscode.window.showOpenDialog({defaultUri:vscode.Uri.file(gWorkspacePath), canSelectFiles:false, canSelectFolders:true, canSelectMany:false,
		filters:{
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'BuildFolder': ['Build'],
		},
			title:"Select EDK build folder"
		});

		// If build folder picked
		if(buildPath){
			// Check if its part of workspace
			if(isWorkspacePath(buildPath[0].fsPath)){
				let buildInfoFolders: any[] = [];
				let configPath = buildPath[0].fsPath;
			
				// Look for BuildOptions file in selected buildPath
				if(configPath !== undefined){
					let lookPath = toPosix(path.join(configPath, "**","BuildOptions"));
					buildInfoFolders = await vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: "Looking for compile info",
						cancellable: true
					}, async (progress, reject) => {
						return glob(lookPath);
					});
				}
	
				// Build Options not found this is not a build folder
				if (buildInfoFolders.length === 0){
					// eslint-disable-next-line @typescript-eslint/no-floating-promises
					vscode.window.showErrorMessage(`Build data was not found in selected folder`);
					return;
				}

				buildInfoFolders = buildInfoFolders.map((x)=>{
					return path.parse(String(x)).dir;
				});
	
				// Show options for builds
				var options: vscode.QuickPickItem[] = [];
				for (const foundPath of buildInfoFolders) {
					let splitPath = foundPath.split(path.posix.sep);
					
					options.push({
						label: splitPath[splitPath.length - 2],
						description: "",
						detail: foundPath,
					});
				}

				// Add option for all builds
				options.push({
					label: "Load all",
					description: "Migth give inacurate results",
					detail: "Experimental",
				});

				let option = await vscode.window.showQuickPick(options, {title: "Select build", matchOnDescription:true, matchOnDetail:true});
				if (option === undefined) {return;}

				let selectedFolders = buildInfoFolders;
				if(option.label !== "Load all"){
					selectedFolders = [option.detail];
				}
				
				gDebugLog.verbose("Loading from build");

				let buildFolder = new BuildFolder(selectedFolders);
				let buildData = await buildFolder.getBuildOptions();
				
				if(buildData){
					await gConfigAgent.setDimmUnusedLibraries(true);
					gDebugLog.verbose("Delete workspace files");
					await gEdkDatabase.resetVariables();
					await gEdkDatabase.clearWorkspace();
					buildFolder.copyFilesToRoot();
					gEdkDatabase.setInputBuildDefines(buildData.buildDefines);
					gEdkDatabase.setBuildFolders(buildFolder.buildFolderPaths);
					let mapFiles = await buildFolder.loadMapFiles();
					await gEdkDatabase.load(buildData.dscFiles);
					await gEdkDatabase.saveSettings(buildData.buildDefines, buildData.dscFiles, gEdkDatabase.getPackagesPaths());
					gModuleReport.load();
				}
			}else{
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				vscode.window.showErrorMessage(`${buildPath[0].fsPath} its outside workspace`);
			}
		}

	}else 
	// LOAD FROM DSC
	if (option.label.includes("Reload from DSC file")){
		// Pick build folder
		let dscPath = await vscode.window.showOpenDialog({defaultUri:vscode.Uri.file(gWorkspacePath), canSelectFiles:true, canSelectFolders:false, canSelectMany:false,
		filters:{
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'DSC': ['dsc'],
		},
			title:"Select EDK build folder"
		});
		if(dscPath){
			if(isWorkspacePath(dscPath[0].fsPath)){
				// disable grayout unused libraries as information may not be acurate
				await gConfigAgent.setDimmUnusedLibraries(false); 
				
				await gEdkDatabase.resetVariables();
				await gEdkDatabase.clearWorkspace();
				await gEdkDatabase.load([dscPath[0].fsPath],true);
				await gEdkDatabase.saveSettings(gEdkDatabase.getInputBuildDefines(),[dscPath[0].fsPath], gEdkDatabase.getPackagesPaths());
				let report = new ProjectReport(gEdkDatabase);
        		await report.render();
				
			}
		}
	}



}






