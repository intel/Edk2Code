import path = require('path');
import * as vscode from 'vscode';
import { gDebugLog, gWorkspacePath } from './extension';
import * as fs from 'fs';
import { LogLevel } from './debugLog';
import { askReloadFiles } from './ui/messages';
import { readFile } from './utils';
import { SettingsPanel } from './settings/settingsPanel';
import { getEdkCodeFolderFilePath, existsEdkCodeFolderFile, writeEdkCodeFolderFile } from './edk2CodeFolder';
import { TernarySearchTree } from './ternarySearchTree';


export interface WorkspaceConfig {
    packagePaths:string[];
    dscPaths:string[];
    buildDefines:string[];
    workspaceTreeFilters?: number[];
}

export interface WorkspaceConfigErrors{
    packagePaths:string;
    dscPaths:string;
    buildDefines:string;
}

export class ConfigAgent {

    getWorkspaceErrors(): WorkspaceConfigErrors | null {
        return {packagePaths:"", dscPaths:"", buildDefines:""};
    }



    public vscodeSettings: vscode.WorkspaceConfiguration;

    private reloadConfigs = ["dscPaths", "buildDefines"];
    private configFileWatcher: vscode.FileSystemWatcher | null = null;
    private propertiesFile: vscode.Uri | undefined | null = undefined; // undefined and null values are handled differently
    private settingsPanel:SettingsPanel|undefined;

    private workspaceConfig:WorkspaceConfig;
    private settingsFileName: string = "edk2_workspace_properties.json";

    /**
     * Temporary T-tree file index built when the workspace is being processed.
     * Used by PathFind as a fast lookup while packagePaths are not yet populated.
     * Set to `null` when the processing is finished.
     */
    private _fileIndex: TernarySearchTree | null = null;

    /**
     * Tracks whether the last workspace processing completed successfully.
     * When `false`, the next `loadConfig` / `proccessWorkspace` will build
     * a temporary T-tree so PathFind can resolve files without relying on
     * the (still-empty) packagePaths.
     */
    private _workspaceProcessComplete: boolean = false;

    public constructor() {
        this.vscodeSettings = vscode.workspace.getConfiguration('edk2code');
        this.workspaceConfig = this.readWpConfig();
        vscode.workspace.onDidChangeConfiguration(this.reloadVscodeSettings.bind(this));

    }

    reloadVscodeSettings(event?: vscode.ConfigurationChangeEvent){
        this.vscodeSettings = vscode.workspace.getConfiguration('edk2code');
    }

    isWarningCppExtension(){
        return <boolean>this.get("warningAboutCppExtension");
    }

    async setWarningCppExtension(value:boolean){
        await this.set("warningAboutCppExtension",value);
    }

    isDiagnostics(){
        return <boolean>this.get("enableDiagnostics");
    }

    reloadConfigFile(){
        this.workspaceConfig = this.readWpConfig();
    }

    getConfigFileUri(){
        return vscode.Uri.file(getEdkCodeFolderFilePath(this.settingsFileName));
    }

    private readWpConfig(){
        let settingsPath = getEdkCodeFolderFilePath(this.settingsFileName);
        gDebugLog.trace(`Loading configuration from ${settingsPath}`);
        if(existsEdkCodeFolderFile(this.settingsFileName)){

            try {
                return JSON.parse(readFile(settingsPath));
            } catch (error) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                vscode.window.showErrorMessage(`${settingsPath} is corrupted: ${error}`);
                return this.getCleanWpConfig();
            }

        }else{
            return this.getCleanWpConfig();
        }
    }

    getWorkspaceConfig(): WorkspaceConfig {
        return this.workspaceConfig;
    }

    writeWorkspaceConfig(config:WorkspaceConfig){
        let data = JSON.stringify(config,null,4);
        writeEdkCodeFolderFile(this.settingsFileName,data);
        this.workspaceConfig = config;
    }

    clearWpConfiguration(){
        this.workspaceConfig = this.getCleanWpConfig();
        // Mark workspace as not-yet-processed so the next loadConfig
        // will build a temporary T-tree for fast file lookups.
        this._workspaceProcessComplete = false;
    }

    /**
     * Returns `true` if the previous workspace processing completed
     * successfully (i.e. packagePaths are fully populated).
     */
    isWorkspaceProcessComplete(): boolean {
        return this._workspaceProcessComplete;
    }

    /**
     * Mark the workspace processing as complete and dispose of the
     * temporary file index so that normal `findFiles` is used again.
     */
    setWorkspaceProcessComplete(): void {
        this._workspaceProcessComplete = true;
        if (this._fileIndex) {
            this._fileIndex.dispose();
            this._fileIndex = null;
        }
    }

    /**
     * Build the temporary T-tree file index if the workspace has not
     * yet been fully processed (packagePaths not populated).
     * This should be called at the beginning of workspace processing.
     */
    async buildFileIndexIfNeeded(): Promise<void> {
        if (!this._workspaceProcessComplete) {
            this._fileIndex = new TernarySearchTree();
            await this._fileIndex.buildFromWorkspace();
        }
    }

    /**
     * Returns the temporary file index if one is active, or `null`
     * when the workspace is fully processed and findFiles should be
     * used instead.
     */
    getFileIndex(): TernarySearchTree | null {
        return this._fileIndex;
    }

    initConfigWatcher(){

        this.configFileWatcher = vscode.workspace.createFileSystemWatcher(getEdkCodeFolderFilePath(this.settingsFileName));

        // this.configFileWatcher.onDidCreate((uri) => {
        //     this.propertiesFile = uri;
        //     this.handleConfigurationChange();
        // });

        // this.configFileWatcher.onDidDelete(() => {
        //     this.propertiesFile = null;
        //     this.resetToDefaultSettings(true);
        //     this.handleConfigurationChange();
        // });

        this.configFileWatcher.onDidChange(() => {
            this.handleConfigurationChange();
        });
    }

    setPanel(settingsPanel: SettingsPanel) {
        this.settingsPanel = settingsPanel;
        settingsPanel.configValuesChanged(() => this.saveConfigurationUI());
    }

    saveConfigurationUI(){

    }

    handleConfigurationChange() {
        let newConfig:WorkspaceConfig = this.readWpConfig();
        let reload = false;
        if(this.workspaceConfig.dscPaths.toString() !== newConfig.dscPaths.toString()){
            reload = true;
        }
        if(this.workspaceConfig.buildDefines.toString() !== newConfig.buildDefines.toString()){
            reload = true;
        }
        this.workspaceConfig = this.readWpConfig();
        if(reload){
            askReloadFiles();
        }
    }

    resetToDefaultSettings(arg0: boolean) {
        throw new Error('Method not implemented.');
    }

    getCleanWpConfig():WorkspaceConfig{
        return {packagePaths:[], dscPaths:[], buildDefines:[]};
    }





    get(option: string) {
        return this.vscodeSettings.get(option);
    }

    async set(option: string, value: any) {
        await this.vscodeSettings.update(option, value);
    }

    getLogLevel(): LogLevel {
        let logLevel: string = <string>this.get("logLevel");
        switch (logLevel) {
            case "None":
                return LogLevel.none;
            case "Error":
                return LogLevel.error;
            case "Warning":
                return LogLevel.warning;
            case "Info":
                return LogLevel.info;
            case "Verbose":
                return LogLevel.verbose;
            case "Debug":
                return LogLevel.debug;
            default:
                return LogLevel.none;
                break;
        }
    }

    async setBuildDefines(defines: Map<string, string>) {

        let toSave: string[] = [];
        for (const [key, value] of defines.entries()) {
            // Normalize double backslashes to single to avoid over-escaping in JSON
            toSave.push(`${key.trim()}=${value.trim().replace(/\\\\/g, '\\')}`);
        }
        this.workspaceConfig.buildDefines = toSave;
        this.writeWorkspaceConfig(this.workspaceConfig);

    }

    async setBuildDefine(name: string, value: string) {
        let buildDefines: string[] = this.workspaceConfig.buildDefines;
        let toSave: string[] = [];
        for (const def of buildDefines) {
            if (!def.startsWith(`${name}=`)) {
                toSave.push(def);
            }
        }
        // Normalize double backslashes to single to avoid over-escaping in JSON
        toSave.push(`${name}=${value.trim().replace(/\\\\/g, '\\')}`);
        this.workspaceConfig.buildDefines = toSave;
        this.writeWorkspaceConfig(this.workspaceConfig);
    }

    getBuildDefines() {
        let buildDefines: string[] = this.workspaceConfig.buildDefines;

        let buildDefinesObj: Map<string, string> = new Map();
        for (const def of buildDefines) {
            if(def.length === 0){continue;}
            if (def.includes("=")) {
                let values = def.split("=");
                if (values.length !== 2) { continue; }
                buildDefinesObj.set(values[0].trim(), values[1].trim());
            } else {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                vscode.window.showErrorMessage(`Malformed define in setting: "${def}"`);
            }
        }
        return buildDefinesObj;
    }

    getBuildPackagePaths() {
        let paths = this.workspaceConfig.packagePaths;
        let retPaths = [];
        for (const p  of paths) {
            if (path.isAbsolute(p)) {
                retPaths.push(p);
            } else {
                retPaths.push(path.join(gWorkspacePath, p));
            }
        }
        return retPaths;
    }


    pushBuildPackagePaths(path:string) {
        if(this.workspaceConfig.packagePaths.includes(path)){
            return;
        }
        // EDK2 build system does not allow spaces in PACKAGES_PATH entries
        if(path.includes(' ')){
            return;
        }
        this.workspaceConfig.packagePaths.push(path);
        this.writeWorkspaceConfig(this.workspaceConfig);
    }

    async setBuildDscPaths(dscFiles: string[]) {
        this.workspaceConfig.dscPaths = dscFiles;
        this.writeWorkspaceConfig(this.workspaceConfig);

    }

    getBuildDscPaths() {
        return this.workspaceConfig.dscPaths;
    }

    getWorkspaceTreeFilters(): number[] | undefined {
        return this.workspaceConfig.workspaceTreeFilters;
    }

    setWorkspaceTreeFilters(filters: number[]): void {
        this.workspaceConfig.workspaceTreeFilters = filters;
        this.writeWorkspaceConfig(this.workspaceConfig);
    }

    getIsGenIgnoreFile() {
        return <boolean>this.get("generateIgnoreFile");
    }

    getDelayToRefreshWorkspace() {
        return <number>this.get("delayToRefreshWorkspace");
    }

    getUseEdkCallHiearchy(){
        return <boolean>this.get("useEdkCallHierarchy");
    }

    getExpandCircularOrDuplicateLibraries(){
        return <boolean>this.get("ExpandCircularOrDuplicateLibraries");
    }

    getExtraIgnorePatterns() {
        return <string[]>this.get("extraIgnorePatterns");
    }

    getUseCscope() {
        return <boolean>this.get("useCscope");
    }

    getCscopeOverwritePath() {
        return (<string>this.get("cscopeOverwritePath")).trim();
    }

    getBuildToolchain(): string {
        return <string>this.get("buildToolchain") || (process.platform === 'win32' ? "VS2022" : "GCC5");
    }

    getBuildArch(): string {
        return <string>this.get("buildArch") || "X64";
    }

    getBuildTarget(): string {
        return <string>this.get("buildTarget") || "DEBUG";
    }

    getBuildExtraArgs(): string[] {
        return <string[]>this.get("buildExtraArgs") || [];
    }

    getIsGenGuidXrefFile() {
        return <boolean>this.get("generateGuidXref");
    }

    getIsShowLanguageWarnings() {
        return <boolean>this.get("showEdk2LanguageWarnings");
    }

    getIsDimmUnusedLibraries() {
        return <boolean>this.get("dimUnusedLibraries");
    }

    async setDimmUnusedLibraries(value: boolean) {
        await this.set("dimUnusedLibraries", value);
    }

    async saveBuildConfig() {
        let savePath = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(gWorkspacePath),
            filters: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Json': ['json'],
            },
        });
        if (savePath) {
            let packages = this.getBuildPackagePaths();
            let dscs = this.getBuildDscPaths();
            let defines = this.getBuildDefines();

            let definesList = [];
            for (const [key, value] of defines) {
                definesList.push(`${key}=${value}`);
            }


            let object = {
                "includePaths": packages,
                "dscs": dscs,
                "defines": definesList
            };
            fs.writeFileSync(savePath.fsPath, JSON.stringify(object, null, 2));
        }
    }



}