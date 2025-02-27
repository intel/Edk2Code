// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ConfigAgent } from './configuration';
import { Cscope, CscopeAgent } from './cscope';
import { DebugLog } from './debugLog';
import * as edkStatusBar from './statusBar';
import { FileUseWarning } from './usedFileTracker';
import * as cmds from "./contextState/cmds";
import { GrayoutController } from './grayout';
import { initLanguages } from './Languages/languages';
import { ModuleReport } from './moduleReport';
import { GuidProvider } from './Languages/guidProvider';
import { PathFind } from './pathfind';
import { EdkWorkspaces } from './index/edkWorkspace';
import { Edk2CallHierarchyProvider } from './callHiearchy';
import { copyToClipboard, findClosestCommonDirectory, getCurrentDocument, getDocsUrl, gotoFile, showVirtualFile } from './utils';
import { ParserFactory } from './edkParser/parserFactory';
import { TreeDetailsDataProvider } from './TreeDataProvider';
import { DiagnosticManager } from './diagnostics';
import { MapFilesManager } from './mapParser';
import { CompileCommands } from './compileCommands';
import { TreeItem } from './treeElements/TreeItem';
import { showReleaseNotes } from './newVersionPage/newVersionMessage';


// Global variables
// export var gEdkDatabase: EdkDatabase;
export var gPathFind = new PathFind();
export var gEdkWorkspaces = new EdkWorkspaces();
export var gCompileCommands:CompileCommands;

export var gExtensionContext: vscode.ExtensionContext;
export var gWorkspacePath: string;
export var gConfigAgent:ConfigAgent;
export var gCscope:Cscope;
export var gCscopeAgent: CscopeAgent; // Agent to update cscope database
var gEdk2CallHierarchyProvider: Edk2CallHierarchyProvider;

export var gDebugLog: DebugLog;
export var gFileUseWarning: FileUseWarning;
export var gGrayOutController: GrayoutController;
export var gModuleReport: ModuleReport;
export var gGuidProvider:GuidProvider;
export var gDiagnosticManager:DiagnosticManager;

export var edkLensTreeDetailProvider: TreeDetailsDataProvider;
export var edkLensTreeDetailView: vscode.TreeView<vscode.TreeItem>;

export var gMapFileManager: MapFilesManager;


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	if (vscode.workspace.workspaceFolders !== undefined) {
		let workspacePaths = vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath);
        gWorkspacePath = findClosestCommonDirectory(workspacePaths);
        console.log(gWorkspacePath);
    }else{
        return;
    }

	gDebugLog = new DebugLog();
	gConfigAgent = new ConfigAgent();
	
	gDebugLog.info("Start EDK2 Extension");
	gDebugLog.info("Workspace path: "+gWorkspacePath);
	gDiagnosticManager = DiagnosticManager.getInstance();
	// By default start Context stage with offline commands


	var commands = [
		vscode.commands.registerCommand('edk2code.rebuildIndex', async ()=>{await cmds.rebuildIndexDatabase();}),
		vscode.commands.registerCommand('edk2code.openConfigurationUi', async ()=>{await cmds.openWpConfigGui();}),
		vscode.commands.registerCommand('edk2code.openConfigurationJson', async ()=>{await cmds.openWpConfigJson();}),
		vscode.commands.registerCommand('edk2code.rescanIndex', async ()=>{await cmds.rescanIndex();}),
		vscode.commands.registerCommand('edk2code.help', async ()=>{
			const docUrl = getDocsUrl();
			await vscode.env.openExternal(vscode.Uri.parse(docUrl));

		}),
		vscode.commands.registerCommand('edk2code.openFile', async ()=>{await cmds.openFile();}),
		vscode.commands.registerCommand('edk2code.openLib', async()=>{await cmds.openLib();}),
		vscode.commands.registerCommand('edk2code.openModule', async ()=>{await cmds.openModule();}),
		vscode.commands.registerCommand('edk2code.gotoDefinition', async (fileUri)=>{ await cmds.gotoDefinitionCscope(fileUri);}),
		vscode.commands.registerCommand('edk2code.gotoDefinitionInput', ()=>{cmds.gotoDefinitionInput();}),

		vscode.commands.registerCommand('edk2code.gotoInf',async (fileUri)=>{await cmds.gotoInf(fileUri);}),
		vscode.commands.registerCommand('edk2code.dscUsage', async (fileUri)=>{await cmds.gotoDscDeclaration(fileUri);}),
		vscode.commands.registerCommand('edk2code.dscInclusion', async (fileUri)=>{await cmds.gotoDscInclusion(fileUri);}),
		vscode.commands.registerCommand('edk2code.references', async (fileUri)=>{await cmds.showReferenceStack(fileUri);}),
		
		vscode.commands.registerCommand('edk2code.libUsage', async (editor)=>{await cmds.showLibUsage(editor.document.uri);}),
		vscode.commands.registerCommand('edk2code.showReferences', ()=>{cmds.showReferences();}),
		vscode.commands.registerTextEditorCommand('edk2code.showLibraryTree', async (editor)=>{await cmds.showEdkMap(editor.document.uri);}),
		
		// Internal
		vscode.commands.registerCommand('edk2code.searchDefinition', ()=>{}),
		vscode.commands.registerCommand("edk2code.gotoFile", async (fileUri, selRange)=>{await gotoFile(fileUri,selRange);}),
		// vscode.commands.registerCommand("edk2code.viewWarnings", async ()=>{await gErrorReportAgent.reportErrors();}),


		// Debug
		vscode.commands.registerCommand('edk2code.debugCommand', async ()=>{

			let factory = new ParserFactory();
			let doc = getCurrentDocument()!;
			let parser = factory.getParser(doc);
			await parser?.parseFile();
			let content = "";
			for (const symb  of parser?.symbolsList!) {
				content += `${symb.toString()}\n`;
			}
			await showVirtualFile(doc.fileName,content);
		}),

		vscode.commands.registerCommand('edk2code.copyTreeData', () => {
			// Your export logic here
			let strTree = edkLensTreeDetailProvider.toString();
			void vscode.env.clipboard.writeText(strTree);
			void vscode.window.showInformationMessage('Details copied to clipboard.');
		
		  }),

		  vscode.commands.registerCommand('edk2code.expandAllTree', () => {
			// Your export logic here
			let strTree = edkLensTreeDetailProvider.expandAll(edkLensTreeDetailView);
		  }),

		  vscode.commands.registerCommand('edk2code.focusOnNode', async (node:TreeItem) => {
			await cmds.focusOnNode(node);
		  }),

		  vscode.commands.registerCommand('edk2code.NodeFocusBack', async () => {
			await cmds.nodeFocusBack();
		  }),


		  vscode.commands.registerCommand('edk2code.getItemTreePath', (node:TreeItem) => {
			// Your export logic here
			let itemParent = node.getParent();
			let pathStack = [node];
			while(itemParent){
				pathStack.push(itemParent);
				itemParent = itemParent.getParent();
			}
			let path = "";
			let count = 0;
			for (const pathItem of pathStack.reverse()) {
				path += "  ".repeat(count) + pathItem.toString() + "\n";
				count++;
			}
			void copyToClipboard(path, "Path copied to clipboard");
		  }),



	];

	context.subscriptions.concat(commands);
	gExtensionContext = context;
	edkStatusBar.init(context);

	gConfigAgent.initConfigWatcher();

	initLanguages();
	gMapFileManager = new MapFilesManager();
	gCompileCommands = new CompileCommands();

	await gEdkWorkspaces.loadConfig();
	gFileUseWarning = new FileUseWarning();


	

	gCscope = new Cscope();
	gCscopeAgent = new CscopeAgent();
	
	if(gCscope.existCscopeFile()){
		void gCscope.reload().then(()=>{
			if(gConfigAgent.getUseEdkCallHiearchy()){
				gEdk2CallHierarchyProvider = new Edk2CallHierarchyProvider();
			}
		});
	}


	edkLensTreeDetailProvider = new TreeDetailsDataProvider();
	edkLensTreeDetailView = vscode.window.createTreeView('detailsView', { treeDataProvider: edkLensTreeDetailProvider, showCollapseAll:true });
	
	edkLensTreeDetailProvider.refresh();
	edkLensTreeDetailView.onDidExpandElement(async event => {
		let node = event.element as TreeItem;
		await node.expand();
		edkLensTreeDetailProvider.refresh();
	});

	await vscode.commands.executeCommand('setContext', 'edk2code.isNodeFocusBackStack', false);
	
	void showReleaseNotes(context);
	
}





// this method is called when your extension is deactivated
export async function deactivate() {

}










