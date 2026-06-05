import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { gConfigAgent, gDebugLog, gWorkspacePath } from './extension';
import { readEdkCodeFolderFile, writeEdkCodeFolderFile, deleteEdkCodeFolderFile, getEdkCodeFolderFilePath } from './edk2CodeFolder';

let buildFormPanel: vscode.WebviewPanel | undefined;

const BUILD_CONFIG_FILE = 'edk2_build_configuration.json';
const GLOBAL_CONFIG_KEY = '__global__';

export interface BuildInvocation {
    /** Absolute or workspace-relative path to the DSC to build. */
    dscPath?: string;
    /** Absolute or workspace-relative path to an INF to build with `-m`. */
    modulePath?: string;
}

/**
 * Global build configuration stored in .edkCode/edk2_build_configuration.json.
 * Shared across all module builds. Extendable for future global settings.
 */
interface GlobalBuildConfig {
    /** EDK2 workspace root containing edksetup.bat/sh. Empty = use VS Code workspace path. */
    edkSetupPath: string;
    /** NASM assembler path prefix. Exported as NASM_PREFIX. */
    nasmPrefix: string;
    /** IASL compiler path prefix. Exported as IASL_PREFIX. */
    iaslPrefix: string;
    /** Path to EDK2 BaseTools binaries. Exported as EDK_TOOLS_BIN. */
    edkToolsBin: string;
}

const DEFAULT_GLOBAL_CONFIG: GlobalBuildConfig = {
    edkSetupPath: '',
    nasmPrefix: '',
    iaslPrefix: '',
    edkToolsBin: ''
};

interface DefineEntry {
    name: string;
    value: string;
}

interface BuildFormState {
    platform: string;
    module: string;
    arch: string;
    target: string;
    toolchain: string;
    action: string;
    skuid: string;
    threads: string;
    fdfFile: string;
    romImage: string;
    fvImage: string;
    capsuleImage: string;
    skipAutogen: boolean;
    reParse: boolean;
    caseInsensitive: boolean;
    warningAsError: boolean;
    logFile: string;
    silent: boolean;
    quiet: boolean;
    verbose: boolean;
    debug: string;
    defines: DefineEntry[];
    reportFile: string;
    reportType: string[];
    flag: string;
    noCache: boolean;
    confDir: string;
    checkUsage: boolean;
    ignoreSources: boolean;
    pcds: string[];
    cmdLen: string;
    hash: boolean;
    binaryDestination: string;
    binarySource: string;
    genfdsMultiThread: boolean;
    noGenfdsMultiThread: boolean;
    disableIncludePathCheck: boolean;
    extraArgs: string[];
    packagePaths: string[];
    /** DSC choices to populate the dropdown (not persisted). */
    dscPaths: string[];
}

/** Key used to store/load per-module config in the JSON file. */
function configKey(state: { platform: string; module: string }): string {
    return state.module || state.platform || '__default__';
}

function loadAllConfig(): Record<string, any> {
    const raw = readEdkCodeFolderFile(BUILD_CONFIG_FILE);
    if (!raw) { return {}; }
    try { return JSON.parse(raw); } catch { return {}; }
}

function saveAllConfig(all: Record<string, any>): void {
    writeEdkCodeFolderFile(BUILD_CONFIG_FILE, JSON.stringify(all, null, 2));
}

function loadGlobalConfig(): GlobalBuildConfig {
    const all = loadAllConfig();
    return { ...DEFAULT_GLOBAL_CONFIG, ...(all[GLOBAL_CONFIG_KEY] ?? {}) };
}

function saveGlobalConfig(global: GlobalBuildConfig): void {
    const all = loadAllConfig();
    all[GLOBAL_CONFIG_KEY] = global;
    saveAllConfig(all);
}

function loadSavedConfig(key: string): Partial<BuildFormState> | undefined {
    const all = loadAllConfig();
    return all[key] ?? undefined;
}

function saveConfig(key: string, state: BuildFormState): void {
    const all = loadAllConfig();
    // Don't persist the dscPaths list — it's runtime only
    const { dscPaths, ...toSave } = state;
    all[key] = toSave;
    saveAllConfig(all);
}

function deleteSavedConfig(key: string): void {
    const all = loadAllConfig();
    delete all[key];
    // Keep at least global config
    if (Object.keys(all).length === 0 || (Object.keys(all).length === 1 && all[GLOBAL_CONFIG_KEY])) {
        if (Object.keys(all).length === 0) {
            deleteEdkCodeFolderFile(BUILD_CONFIG_FILE);
        } else {
            saveAllConfig(all);
        }
    } else {
        saveAllConfig(all);
    }
}

/**
 * Public entry point for the EDK2 build command.
 * Always opens the build configuration form (webview) first, then runs
 * the build in a terminal when the user clicks "Build".
 */
export async function buildEdk2Workspace(options?: BuildInvocation) {
    const isWindows = process.platform === 'win32';

    // Load global config (edkSetupPath, nasmPrefix, etc.)
    const globalConfig = loadGlobalConfig();

    // Get DSC paths
    const dscPaths = gConfigAgent.getBuildDscPaths();
    if (!dscPaths || dscPaths.length === 0) {
        void vscode.window.showErrorMessage('No DSC paths configured. Please configure DSC paths first.');
        return;
    }

    // Determine pre-selected DSC
    let selectedDsc: string | undefined = options?.dscPath;
    if (!selectedDsc) {
        if (dscPaths.length === 1) {
            selectedDsc = dscPaths[0];
        } else {
            const picked = await vscode.window.showQuickPick(dscPaths, {
                placeHolder: 'Select DSC file to build',
                title: 'EDK2 Build'
            });
            if (!picked) { return; }
            selectedDsc = picked;
        }
    }

    // Build defaults from settings
    const defaultState: BuildFormState = {
        platform: selectedDsc,
        module: options?.modulePath ?? '',
        arch: gConfigAgent.getBuildArch(),
        target: gConfigAgent.getBuildTarget(),
        toolchain: gConfigAgent.getBuildToolchain(),
        action: '',
        skuid: '',
        threads: '',
        fdfFile: '',
        romImage: '',
        fvImage: '',
        capsuleImage: '',
        skipAutogen: false,
        reParse: false,
        caseInsensitive: false,
        warningAsError: false,
        logFile: '',
        silent: false,
        quiet: false,
        verbose: false,
        debug: '',
        defines: Array.from(gConfigAgent.getBuildDefines().entries()).map(([k, v]) => ({ name: k, value: v })),
        reportFile: '',
        reportType: [],
        flag: '',
        noCache: false,
        confDir: '',
        checkUsage: false,
        ignoreSources: false,
        pcds: [],
        cmdLen: '',
        hash: false,
        binaryDestination: '',
        binarySource: '',
        genfdsMultiThread: false,
        noGenfdsMultiThread: false,
        disableIncludePathCheck: false,
        extraArgs: gConfigAgent.getBuildExtraArgs().filter(a => a.trim()),
        packagePaths: gConfigAgent.getBuildPackagePaths().filter(p => p.trim()),
        dscPaths: dscPaths
    };

    // Load saved config if available
    const key = configKey(defaultState);
    const saved = loadSavedConfig(key);
    const initial: BuildFormState = saved
        ? { ...defaultState, ...saved, dscPaths }
        : defaultState;

    // Open the form (stays open; handles build internally)
    showBuildForm(initial, defaultState, globalConfig, isWindows);
}

/** Validation error with associated field ID for highlighting in the form. */
interface ValidationError {
    field: string;
    message: string;
}

/** Resolve a config path: if relative, resolve against workspace root; if absolute, use as-is. */
function resolveConfigPath(p: string): string {
    if (!p) { return ''; }
    if (path.isAbsolute(p)) { return p; }
    return path.join(gWorkspacePath, p);
}

/** Validate global config paths. Returns an array of validation errors (empty if all OK). */
function validateGlobalConfig(config: GlobalBuildConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    // EDK Setup Path: must point to edksetup.bat or edksetup.sh
    const rawSetup = config.edkSetupPath.trim();
    if (rawSetup) {
        const setupPath = resolveConfigPath(rawSetup);
        if (!fs.existsSync(setupPath)) {
            errors.push({ field: 'edkSetupPath', message: `EDK2 setup script not found: ${setupPath}` });
        } else if (fs.statSync(setupPath).isDirectory()) {
            errors.push({ field: 'edkSetupPath', message: `Expected a file (edksetup.bat/.sh), got a directory: ${setupPath}` });
        }
    } else {
        // Default: look for edksetup in workspace root
        const isWindows = process.platform === 'win32';
        const defaultScript = path.join(gWorkspacePath, isWindows ? 'edksetup.bat' : 'edksetup.sh');
        if (!fs.existsSync(defaultScript)) {
            errors.push({ field: 'edkSetupPath', message: `EDK2 setup script not found in workspace: ${defaultScript}` });
        }
    }

    // NASM Prefix: must point to nasm executable
    const rawNasm = config.nasmPrefix.trim();
    if (rawNasm) {
        const nasmPath = resolveConfigPath(rawNasm);
        if (!fs.existsSync(nasmPath)) {
            errors.push({ field: 'nasmPrefix', message: `NASM executable not found: ${nasmPath}` });
        } else if (fs.statSync(nasmPath).isDirectory()) {
            errors.push({ field: 'nasmPrefix', message: `Expected a file (nasm executable), got a directory: ${nasmPath}` });
        }
    } else if (!process.env['NASM_PREFIX']) {
        errors.push({ field: 'nasmPrefix', message: `NASM path is not configured and NASM_PREFIX is not set in environment` });
    }

    // IASL Prefix: must point to iasl executable
    const rawIasl = config.iaslPrefix.trim();
    if (rawIasl) {
        const iaslPath = resolveConfigPath(rawIasl);
        if (!fs.existsSync(iaslPath)) {
            errors.push({ field: 'iaslPrefix', message: `IASL executable not found: ${iaslPath}` });
        } else if (fs.statSync(iaslPath).isDirectory()) {
            errors.push({ field: 'iaslPrefix', message: `Expected a file (iasl executable), got a directory: ${iaslPath}` });
        }
    }

    // EDK Tools Bin: must be an existing directory
    const rawToolsBin = config.edkToolsBin.trim();
    if (rawToolsBin) {
        const toolsBinPath = resolveConfigPath(rawToolsBin);
        if (!fs.existsSync(toolsBinPath)) {
            errors.push({ field: 'edkToolsBin', message: `EDK_TOOLS_BIN directory not found: ${toolsBinPath}` });
        } else if (!fs.statSync(toolsBinPath).isDirectory()) {
            errors.push({ field: 'edkToolsBin', message: `Expected a directory, got a file: ${toolsBinPath}` });
        }
    }

    return errors;
}

/** Internal: assemble the command line from form state and execute it in a terminal. */
async function runBuild(state: BuildFormState, edkRoot: string, isWindows: boolean, globalConfig: GlobalBuildConfig) {
    // Derive NASM_PREFIX: directory of the nasm executable, ending with separator
    const rawNasm = (globalConfig.nasmPrefix || '').trim();
    const nasmPrefix = rawNasm ? path.dirname(resolveConfigPath(rawNasm)) + path.sep : '';

    // Derive IASL_PREFIX: directory of the iasl executable, ending with separator
    const rawIasl = (globalConfig.iaslPrefix || '').trim();
    const iaslPrefix = rawIasl ? path.dirname(resolveConfigPath(rawIasl)) + path.sep : '';

    // EDK_TOOLS_BIN: resolve as-is (already validated as a directory)
    const edkToolsBin = (globalConfig.edkToolsBin || '').trim()
        ? resolveConfigPath(globalConfig.edkToolsBin.trim()) : '';

    // Derive setup script name and edkRoot directory from edkSetupPath
    const rawSetup = (globalConfig.edkSetupPath || '').trim();
    let setupScript: string;
    if (rawSetup) {
        const resolvedSetup = resolveConfigPath(rawSetup);
        edkRoot = path.dirname(resolvedSetup);
        setupScript = path.basename(resolvedSetup);
    } else {
        setupScript = isWindows ? 'edksetup.bat' : 'edksetup.sh';
    }

    // Package paths
    const packagePaths = (state.packagePaths || []).map(s => s.trim()).filter(s => s.length > 0);

    /**
     * Convert an absolute INF/DSC path into a path that EDK2 `build` can resolve.
     */
    const toEdkRelative = (p: string): string => {
        if (!p) { return p; }
        if (!path.isAbsolute(p)) { return p; }
        const roots = [edkRoot, ...packagePaths];
        for (const root of roots) {
            if (!root) { continue; }
            const rel = path.relative(root, p);
            if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
                return rel;
            }
        }
        return p;
    };

    const platformArg = toEdkRelative(state.platform);
    const moduleArg = toEdkRelative(state.module);

    // Compute the effective workspace root (WORKSPACE env variable / CWD for edksetup).
    // EDK2 resolves relative -p paths as WORKSPACE/path. We find where the platform DSC
    // actually lives and derive the workspace root from that.
    let workspaceRoot = edkRoot;
    if (platformArg && !path.isAbsolute(platformArg)) {
        const candidates = new Set<string>();
        candidates.add(edkRoot);
        for (const p of packagePaths) {
            if (path.isAbsolute(p)) {
                candidates.add(p);
                candidates.add(path.dirname(p));
            }
        }
        for (const candidate of candidates) {
            if (fs.existsSync(path.join(candidate, platformArg))) {
                workspaceRoot = candidate;
                break;
            }
        }
    }

    // If workspaceRoot differs from edkRoot, use full path for the setup script
    const setupScriptCall = (workspaceRoot !== edkRoot)
        ? path.join(edkRoot, setupScript)
        : setupScript;

    // Compose build args
    const args: string[] = [];
    if (platformArg) { args.push(`-p ${platformArg}`); }
    if (moduleArg) { args.push(`-m ${moduleArg}`); }
    if (state.arch) {
        // Support multiple architectures separated by space or comma (e.g. "IA32 X64")
        const archs = state.arch.split(/[\s,]+/).filter(Boolean);
        for (const a of archs) { args.push(`-a ${a}`); }
    }
    if (state.target) { args.push(`-b ${state.target}`); }
    if (state.toolchain) { args.push(`-t ${state.toolchain}`); }
    if (state.skuid) { args.push(`-x ${state.skuid}`); }
    if (state.threads) { args.push(`-n ${state.threads}`); }
    if (state.fdfFile) { args.push(`-f ${state.fdfFile}`); }
    if (state.romImage) { args.push(`-r ${state.romImage}`); }
    if (state.fvImage) { args.push(`-i ${state.fvImage}`); }
    if (state.capsuleImage) { args.push(`-C ${state.capsuleImage}`); }
    if (state.skipAutogen) { args.push(`-u`); }
    if (state.reParse) { args.push(`-e`); }
    if (state.caseInsensitive) { args.push(`-c`); }
    if (state.warningAsError) { args.push(`-w`); }
    if (state.logFile) { args.push(`-j ${state.logFile}`); }
    if (state.silent) { args.push(`-s`); }
    if (state.quiet) { args.push(`-q`); }
    if (state.verbose) { args.push(`-v`); }
    if (state.debug) { args.push(`-d ${state.debug}`); }

    // Defines: array of {name, value}
    for (const def of (state.defines || [])) {
        if (def.name) {
            const val = def.value.includes(' ') ? `"${def.value}"` : def.value;
            args.push(`-D ${def.name}=${val}`);
        }
    }

    if (state.reportFile) { args.push(`-y ${state.reportFile}`); }
    for (const rt of state.reportType || []) {
        if (rt) { args.push(`-Y ${rt}`); }
    }
    if (state.flag) { args.push(`-F ${state.flag}`); }
    if (state.noCache) { args.push(`-N`); }
    if (state.confDir) { args.push(`--conf=${state.confDir}`); }
    if (state.checkUsage) { args.push(`--check-usage`); }
    if (state.ignoreSources) { args.push(`--ignore-sources`); }

    // PCDs: array of strings
    for (const pcd of (state.pcds || [])) {
        const trimmed = pcd.trim();
        if (trimmed) { args.push(`--pcd=${trimmed}`); }
    }

    if (state.cmdLen) { args.push(`-l ${state.cmdLen}`); }
    if (state.hash) { args.push(`--hash`); }
    if (state.binaryDestination) { args.push(`--binary-destination=${state.binaryDestination}`); }
    if (state.binarySource) { args.push(`--binary-source=${state.binarySource}`); }
    if (state.genfdsMultiThread) { args.push(`--genfds-multi-thread`); }
    if (state.noGenfdsMultiThread) { args.push(`--no-genfds-multi-thread`); }
    if (state.disableIncludePathCheck) { args.push(`--disable-include-path-check`); }

    // Extra args: array of strings
    for (const a of (state.extraArgs || [])) {
        const trimmed = a.trim();
        if (trimmed) { args.push(trimmed); }
    }

    // Trailing positional action keyword
    if (state.action) { args.push(state.action); }

    const buildArgsStr = args.join(' ');

    let cmd: string;
    if (isWindows) {
        // On Windows, `set "VAR=value"` already preserves spaces — no inner quoting needed
        const pkgPath = packagePaths.join(';');
        const parts: string[] = [];
        parts.push(`set "WORKSPACE=${workspaceRoot}"`);
        parts.push(`set "PACKAGES_PATH=${pkgPath}"`);
        if (nasmPrefix) { parts.push(`set "NASM_PREFIX=${nasmPrefix}"`); }
        if (iaslPrefix) { parts.push(`set "IASL_PREFIX=${iaslPrefix}"`); }
        if (edkToolsBin) { parts.push(`set "EDK_TOOLS_BIN=${edkToolsBin}"`); }
        parts.push(`call ${setupScriptCall}`);
        parts.push(`build ${buildArgsStr}`);
        cmd = parts.join(' && ');
    } else {
        // On Linux, the outer double-quotes in export protect spaces
        const pkgPath = packagePaths.join(':');
        const parts: string[] = [];
        parts.push(`export WORKSPACE="${workspaceRoot}"`);
        parts.push(`export PACKAGES_PATH="${pkgPath}"`);
        if (nasmPrefix) { parts.push(`export NASM_PREFIX="${nasmPrefix}"`); }
        if (iaslPrefix) { parts.push(`export IASL_PREFIX="${iaslPrefix}"`); }
        if (edkToolsBin) { parts.push(`export EDK_TOOLS_BIN="${edkToolsBin}"`); }
        parts.push(`. ${setupScriptCall}`);
        parts.push(`build ${buildArgsStr}`);
        cmd = parts.join(' && ');
    }

    gDebugLog.info(`EDK2 Build command: ${cmd}`);

    // Use a VS Code Task so we get proper process lifecycle tracking
    const shellExec = isWindows
        ? new vscode.ShellExecution(cmd, { cwd: workspaceRoot })
        : new vscode.ShellExecution(cmd, { cwd: workspaceRoot });

    const taskDef: vscode.TaskDefinition = { type: 'edk2build' };
    const task = new vscode.Task(
        taskDef,
        vscode.TaskScope.Workspace,
        'EDK2 Build',
        'edk2code',
        shellExec
    );
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Shared,
        clear: true
    };

    const execution = await vscode.tasks.executeTask(task);

    // Wait for the task process to end
    return new Promise<void>((resolve) => {
        const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
            if (e.execution === execution) {
                disposable.dispose();
                resolve();
            }
        });
    });
}

// ────────────────────────────────────────────────────────────────────────────
// Build configuration form (webview)
// ────────────────────────────────────────────────────────────────────────────

function getFormHtml(extensionPath: string): string {
    const htmlPath = path.join(extensionPath, 'static', 'buildForm.html');
    return fs.readFileSync(htmlPath, 'utf8');
}

function showBuildForm(initial: BuildFormState, defaults: BuildFormState, globalConfig: GlobalBuildConfig, isWindows: boolean): void {
    if (buildFormPanel) {
        // If already open, just reveal and re-init
        buildFormPanel.reveal();
        buildFormPanel.webview.postMessage({ command: 'init', state: initial, globalConfig });
        return;
    }

    // Get extension path for loading HTML
    const ext = vscode.extensions.getExtension('intel-corporation.edk2code');
    const extensionPath = ext?.extensionPath ?? path.join(__dirname, '..');

    const panel = vscode.window.createWebviewPanel(
        'edk2code.buildForm',
        'EDK2 Build Configuration',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true, enableFindWidget: true }
    );
    buildFormPanel = panel;

    panel.onDidDispose(() => {
        buildFormPanel = undefined;
    });

    panel.webview.onDidReceiveMessage(async (msg: any) => {
        if (!msg) { return; }
        if (msg.command === 'ready') {
            // Send initial state + global config to webview
            panel.webview.postMessage({ command: 'init', state: initial, globalConfig });
        } else if (msg.command === 'build') {
            const state = msg.state as BuildFormState;
            const formGlobal = msg.globalConfig as GlobalBuildConfig;

            // Save global config
            if (formGlobal) {
                saveGlobalConfig(formGlobal);
            }

            // Persist the submitted state
            saveConfig(configKey(state), state);

            // Re-read global config
            const updatedGlobal = loadGlobalConfig();

            // Validate
            const errors = validateGlobalConfig(updatedGlobal);
            if (errors.length > 0) {
                // Send validation errors to webview for highlighting
                panel.webview.postMessage({ command: 'validationErrors', errors });
                return;
            }

            // Disable form during build
            panel.webview.postMessage({ command: 'buildStarted' });

            // Derive edkRoot from setup script path (runBuild will also do this, but we need it for cwd)
            const rawSetup = updatedGlobal.edkSetupPath.trim();
            let finalEdkRoot: string;
            if (rawSetup) {
                finalEdkRoot = path.dirname(resolveConfigPath(rawSetup));
            } else {
                finalEdkRoot = process.env['WORKSPACE'] || gWorkspacePath;
            }

            await runBuild(state, finalEdkRoot, isWindows, updatedGlobal);

            // Re-enable form after build command is sent
            panel.webview.postMessage({ command: 'buildFinished' });
        } else if (msg.command === 'cancel') {
            panel.dispose();
        } else if (msg.command === 'openConfig') {
            const filePath = getEdkCodeFolderFilePath(BUILD_CONFIG_FILE);
            const uri = vscode.Uri.file(filePath);
            vscode.commands.executeCommand('vscode.open', uri);
        } else if (msg.command === 'reset') {
            // Delete saved config and re-initialize with defaults
            deleteSavedConfig(configKey(initial));
            panel.webview.postMessage({ command: 'init', state: defaults, globalConfig: DEFAULT_GLOBAL_CONFIG });
        }
    });

    panel.webview.html = getFormHtml(extensionPath);
}


