import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { gCompileCommands } from './extension';
import { CompileCommandsEntry } from './compileCommands';

function getCompilerName(command: string): string {
    const match = command.match(/^"?([^"\s]+)"?/);
    return match ? path.basename(match[1]) : 'unknown';
}

function getOutputFile(command: string): string {
    const match = command.match(/-o\s+(\S+)/);
    return match ? match[1] : 'N/A';
}

function getFlags(command: string): string[] {
    const flags: string[] = [];
    // Match flags that are not -D, -I, -o, or the compiler/source file
    const match = command.match(/\s(-[^DIo]\S*)/g);
    if (match) {
        match.forEach(f => flags.push(f.trim()));
    }
    return flags;
}

function buildReport(entry: CompileCommandsEntry): string {
    const fileName = path.basename(entry.file);
    const compiler = getCompilerName(entry.command);
    const output = getOutputFile(entry.command);
    const defines = entry.getDefines();
    const includes = entry.getIncludePaths();

    const lines: string[] = [];
    lines.push('---------------------------------------------------------------');
    lines.push(`|  EDK2 Compile: ${fileName}`);
    lines.push('---------------------------------------------------------------');
    lines.push(`|  Compiler:   ${compiler}`);
    lines.push(`|  Source:     ${entry.file}`);
    lines.push(`|  Output:     ${output}`);
    lines.push(`|  Directory:  ${entry.directory}`);
    lines.push('---------------------------------------------------------------');
    lines.push(`|  Defines (${defines.length}):`);
    defines.forEach(d => lines.push(`|    -D ${d}`));
    lines.push('---------------------------------------------------------------');
    lines.push(`|  Include Paths (${includes.length}):`);
    includes.forEach(i => lines.push(`|    ${i}`));
    lines.push('---------------------------------------------------------------');
    return lines.join('\n');
}

export async function compileCFile(fileUri?: vscode.Uri) {
    let filePath: string;
    if (fileUri) {
        filePath = fileUri.fsPath;
    } else {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            void vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        filePath = editor.document.uri.fsPath;
    }

    gCompileCommands.load();
    const entry = gCompileCommands.getCompileCommandForFile(filePath);
    if (!entry) {
        void vscode.window.showErrorMessage(`No compile command found for ${path.basename(filePath)}`);
        return;
    }

    const report = buildReport(entry);

    // Write report to a separate text file to avoid shell escaping issues
    const isWindows = os.platform() === 'win32';
    const reportPath = path.join(os.tmpdir(), 'edk2_compile_report.txt');
    fs.writeFileSync(reportPath, report);

    // Write command to a temp script to avoid terminal line-length limits
    const scriptExt = isWindows ? '.bat' : '.sh';
    const scriptPath = path.join(os.tmpdir(), `edk2_compile${scriptExt}`);
    const fileName = path.basename(filePath);

    let scriptContent: string;
    if (isWindows) {
        scriptContent = `@echo off\ntype "${reportPath}"\necho.\ncd /d "${entry.directory}"\n${entry.command}\nif %ERRORLEVEL% EQU 0 (echo Compilation successful: ${fileName}) else (echo Compilation FAILED: ${fileName})`;
    } else {
        scriptContent = `#!/bin/bash\ncat "${reportPath}"\necho ""\ncd "${entry.directory}"\n${entry.command}\nif [ $? -eq 0 ]; then echo "Compilation successful: ${fileName}"; else echo "Compilation FAILED: ${fileName}"; fi`;
    }
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

    const terminal = vscode.window.createTerminal({ name: `Compile: ${fileName}`, cwd: entry.directory });
    terminal.show();
    const runCmd = isWindows ? `"${scriptPath}"` : `bash "${scriptPath}"`;
    terminal.sendText(runCmd);
}
