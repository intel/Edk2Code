// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

import { ConfigAgent } from './configuration';
import { Cscope, CscopeAgent } from './cscope';
import { DebugLog } from './debugLog';
import * as edkStatusBar from './statusBar';
import { FileUseWarning } from './usedFileTracker';
import * as cmds from "./contextState/cmds";

import { initLanguages } from './Languages/languages';
import { ModuleReport } from './moduleReport';
import { GuidProvider } from './Languages/guidProvider';
import { PathFind } from './pathfind';
import { EdkWorkspaces } from './index/edkWorkspace';
import { Edk2CallHierarchyProvider } from './callHiearchy';
import { copyToClipboard, findClosestCommonDirectory, getCurrentDocument, getDocsUrl, gotoFile, showVirtualFile } from './utils';
import { getParserForDocument } from './edkParser/parserFactory';
import { DiagnosticManager } from './diagnostics';
import { WorkspaceTreeProvider, WorkspaceRootItem, IncludeTreeItem, DocumentSymbolItem, WorkspaceTreeNode, isFileInWorkspaceTree, isInfInWorkspaces } from './workspaceTree/WorkspaceTreeProvider';
import { InfDsc } from './index/edkWorkspace';
import { MapFilesManager } from './mapParser';
import { CompileCommands } from './compileCommands';
import { showReleaseNotes } from './newVersionPage/newVersionMessage';
import { startMcpServer, stopMcpServer } from './mcp/mcpServer';


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

export var gModuleReport: ModuleReport;
export var gGuidProvider:GuidProvider;
export var gDiagnosticManager:DiagnosticManager;

export var edkWorkspaceTreeProvider: WorkspaceTreeProvider;
export var edkWorkspaceTreeView: vscode.TreeView<WorkspaceTreeNode>;

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
		
		// Internal
		vscode.commands.registerCommand('edk2code.searchDefinition', ()=>{}),
		vscode.commands.registerCommand("edk2code.gotoFile", async (fileUri, selRange)=>{await gotoFile(fileUri,selRange);}),
		// vscode.commands.registerCommand("edk2code.viewWarnings", async ()=>{await gErrorReportAgent.reportErrors();}),


		// Debug
		vscode.commands.registerCommand('edk2code.debugCommand', async ()=>{

			let doc = getCurrentDocument()!;
			let parser = await getParserForDocument(doc);
			let content = "";
			for (const symb  of parser?.symbolsList!) {
				content += `${symb.toString()}\n`;
			}
			await showVirtualFile(doc.fileName,content);
		}),



		vscode.commands.registerCommand('edk2code.copyWorkspaceTree', async () => {
			const text = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Serializing workspace tree',
					cancellable: false
				},
				async progress => {
					progress.report({ message: 'Building tree text for the clipboard...' });
					return await edkWorkspaceTreeProvider.serializeTree();
				}
			);
			await vscode.env.clipboard.writeText(text);
			void vscode.window.showInformationMessage('Workspace tree copied to clipboard.');
		}),

		vscode.commands.registerCommand('edk2code.copyWorkspaceNodePath', async (node: WorkspaceRootItem | IncludeTreeItem | DocumentSymbolItem) => {
			if (!('nodePath' in node)) {
				return;
			}
			await vscode.env.clipboard.writeText(node.nodePath);
			void vscode.window.showInformationMessage(`Workspace path copied to clipboard`);
		}),

		vscode.commands.registerCommand('edk2code.filterWorkspaceSymbols', async () => {
			await edkWorkspaceTreeProvider.showFilterPicker();
		}),

		vscode.commands.registerCommand('edk2code.gotoOverwrite', async (node: DocumentSymbolItem) => {
			if (node?.overwrittenBy) {
				await gotoFile(node.overwrittenBy.uri, node.overwrittenBy.range);
				await edkWorkspaceTreeProvider.revealLocation(
					node.overwrittenBy.uri,
					node.overwrittenBy.range.start,
					edkWorkspaceTreeView
				);
			}
		}),

		vscode.commands.registerCommand('edk2code.refreshWorkspaceConfig', async () => {
			await gEdkWorkspaces.loadConfig();
		}),

		vscode.commands.registerCommand('edk2code.selectWorkspaceView', async () => {
			const workspaces = gEdkWorkspaces.workspaces;
			if (workspaces.length === 0) {
				void vscode.window.showInformationMessage('No EDK2 workspaces loaded yet.');
				return;
			}
			const items = workspaces.map((ws, i) => ({
				label: ws.platformName ?? path.basename(ws.mainDsc.fsPath),
				description: vscode.workspace.asRelativePath(ws.mainDsc, false),
				index: i
			}));
			const picked = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select workspace to display',
				title: 'EDK2: Select Workspace'
			});
			if (picked !== undefined) {
				edkWorkspaceTreeProvider.selectWorkspace(picked.index);
			}
		}),

		vscode.commands.registerCommand('edk2code.revealEditorInWorkspaceTree', async () => {
			await edkWorkspaceTreeProvider.revealActiveEditor(edkWorkspaceTreeView);
		}),

		vscode.commands.registerCommand('edk2code.searchWorkspaceTree', async () => {
			await edkWorkspaceTreeProvider.searchTree(edkWorkspaceTreeView);
		}),

		vscode.commands.registerCommand('edk2code.focusEditorInWorkspaceView', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }

			const langId = editor.document.languageId;

			// Helper: switch to the workspace that contains the given URI if it's
			// not the currently displayed one. Returns false if user cancelled.
			async function ensureWorkspaceForUri(uri: vscode.Uri): Promise<boolean> {
				const allWs = gEdkWorkspaces.workspaces;
				const currentIdx = edkWorkspaceTreeProvider.activeIndex;
				// Already showing the right workspace?
				if (currentIdx < allWs.length && isFileInWorkspaceTree(uri, [allWs[currentIdx]])) {
					return true;
				}
				// Search other workspaces
				for (let i = 0; i < allWs.length; i++) {
					if (i === currentIdx) { continue; }
					if (isFileInWorkspaceTree(uri, [allWs[i]])) {
						const wsName = allWs[i].platformName ?? path.basename(allWs[i].mainDsc.fsPath);
						const answer = await vscode.window.showInformationMessage(
							`File not found in the current workspace tree. Switch to "${wsName}"?`,
							{ modal: false },
							'Switch'
						);
						if (answer !== 'Switch') { return false; }
						edkWorkspaceTreeProvider.selectWorkspace(i);
						return true;
					}
				}
				return true;
			}

			// DSC / DSC-include: reveal directly by cursor position
			if (langId === 'edk2_dsc') {
				if (!await ensureWorkspaceForUri(editor.document.uri)) { return; }
				await edkWorkspaceTreeProvider.revealActiveEditor(edkWorkspaceTreeView);
				return;
			}

			// INF: first find DSC declaration(s), then reveal that location
			if (langId === 'edk2_inf') {
				const fileUri = editor.document.uri;
				const wps = await gEdkWorkspaces.getWorkspace(fileUri);

				let declarations: InfDsc[] = [];
				for (const wp of wps) {
					declarations = declarations.concat(await wp.getDscDeclaration(fileUri));
				}

				if (declarations.length === 0) {
					void vscode.window.showInformationMessage('This INF file has no DSC declaration in the loaded workspaces.');
					return;
				}

				let chosen: InfDsc;
				if (declarations.length === 1) {
					chosen = declarations[0];
				} else {
					const items = declarations.map(d => ({
						label: vscode.workspace.asRelativePath(d.location.uri, false),
						description: `line ${d.location.range.start.line + 1}`,
						detail: d.text.trim(),
						decl: d
					}));
					const picked = await vscode.window.showQuickPick(items, {
						placeHolder: 'Multiple DSC declarations found – select one to reveal',
						title: 'EDK2: Focus on workspace view'
					});
					if (!picked) { return; }
					chosen = picked.decl;
				}

				if (!await ensureWorkspaceForUri(chosen.location.uri)) { return; }
				await edkWorkspaceTreeProvider.revealLocation(
					chosen.location.uri,
					chosen.location.range.start,
					edkWorkspaceTreeView
				);
			}
		}),

		vscode.commands.registerCommand('edk2code.startMcpServer', async () => {
			const portStr = vscode.workspace.getConfiguration('edk2code').get<number>('mcpServerPort', 3100);
			await startMcpServer(portStr);
		}),
		vscode.commands.registerCommand('edk2code.stopMcpServer', () => {
			stopMcpServer();
		})
	];

	// We need to concat custom commands, because they are not in the list of commands
	// because they are added after the extension is activated
	context.subscriptions.push(...commands);
	gExtensionContext = context;
	edkStatusBar.init(context);

	gConfigAgent.initConfigWatcher();

	initLanguages();
	gMapFileManager = new MapFilesManager();
	gCompileCommands = new CompileCommands();

	edkWorkspaceTreeProvider = new WorkspaceTreeProvider();
	edkWorkspaceTreeView = vscode.window.createTreeView('workspaceView', { treeDataProvider: edkWorkspaceTreeProvider, showCollapseAll: true, dragAndDropController: edkWorkspaceTreeProvider });

	await gEdkWorkspaces.loadConfig();
	gFileUseWarning = new FileUseWarning();


	

	gCscope = new Cscope();
	gCscopeAgent = new CscopeAgent();
	
	if(gConfigAgent.getUseCscope() && gCscope.existCscopeFile()){
		void gCscope.reload().then(()=>{
			if(gConfigAgent.getUseEdkCallHiearchy()){
				gEdk2CallHierarchyProvider = new Edk2CallHierarchyProvider();
			}
		});
	}

	


	// ─── Track whether the active editor belongs to the workspace tree ─────────
	async function updateEditorInWorkspaceContext(editor: vscode.TextEditor | undefined): Promise<void> {
		const uri = editor?.document.uri;
		const langId = editor?.document.languageId;

		const inDscTree =
			uri !== undefined &&
			isFileInWorkspaceTree(uri, gEdkWorkspaces.workspaces);

		const inInfWorkspace =
			uri !== undefined &&
			langId === 'edk2_inf' &&
			isInfInWorkspaces(uri, gEdkWorkspaces.workspaces);

		void vscode.commands.executeCommand('setContext', 'edk2code.editorFileInWorkspaceTree', inDscTree);
		void vscode.commands.executeCommand('setContext', 'edk2code.infFileInWorkspaceTree', inInfWorkspace);
	}
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => { void updateEditorInWorkspaceContext(editor); })
	);
	void updateEditorInWorkspaceContext(vscode.window.activeTextEditor);

	void showReleaseNotes(context);
	
}





// this method is called when your extension is deactivated
export async function deactivate() {
	stopMcpServer();
}










