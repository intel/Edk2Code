/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

const elementId: { [key: string]: string } = {
    // Basic settings
    dscPaths: "dscPaths",
    dscPathsList: "dscPathsList",
    dscAddBtn: "dscAddBtn",
    buildDefines: "buildDefines",
    buildDefinesList: "buildDefinesList",
    buildDefinesAddBtn: "buildDefinesAddBtn",
    buildDefineNewName: "buildDefineNewName",
    buildDefineNewValue: "buildDefineNewValue",
    packagePaths: "packagePaths",
    packagePathsList: "packagePathsList",
    packagePathsAddBtn: "packagePathsAddBtn",
    
};

interface VsCodeApi {
    postMessage(msg: Record<string, any>): void;
    setState(state: Record<string, any>): void;
    getState(): any;
}

declare function acquireVsCodeApi(): VsCodeApi;

class SettingsApp {
    private readonly vsCodeApi: VsCodeApi;
    private updating: boolean = false;
    private dscPaths: string[] = [];
    private buildDefines: {name: string, value: string}[] = [];
    private packagePaths: string[] = [];

    constructor() {
        this.vsCodeApi = acquireVsCodeApi();
        window.addEventListener("keydown", this.onTabKeyDown.bind(this));
        window.addEventListener("message", this.onMessageReceived.bind(this));

        // Add event listeners to UI elements

        this.addEventsToInputValues();
        this.addDscListEvents();
        this.addBuildDefinesEvents();
        this.addPackagePathsEvents();
        this.addMcpEvents();
        this.vsCodeApi.postMessage({
            command: "initialized"
        });
    }

    private addDscListEvents(): void {
        document.getElementById(elementId.dscAddBtn)!.addEventListener("click", () => {
            this.vsCodeApi.postMessage({ command: "selectDscFile" });
        });
    }

    // --- MCP ---

    private addMcpEvents(): void {
        document.getElementById("mcpToggleBtn")!.addEventListener("click", () => {
            this.vsCodeApi.postMessage({ command: "toggleMcp" });
        });
        document.getElementById("mcpAutoConfigBtn")!.addEventListener("click", () => {
            this.vsCodeApi.postMessage({ command: "autoConfigureMcp" });
        });
        document.getElementById("mcpPort")!.addEventListener("change", () => {
            const port = parseInt((<HTMLInputElement>document.getElementById("mcpPort")).value, 10);
            if (port >= 1 && port <= 65535) {
                this.vsCodeApi.postMessage({ command: "changeMcpPort", port });
            }
        });
    }

    private updateMcpStatus(running: boolean): void {
        const btn = document.getElementById("mcpToggleBtn") as HTMLButtonElement;
        const status = document.getElementById("mcpStatus")!;
        if (running) {
            btn.textContent = "Stop MCP Server";
            status.textContent = "Running";
            status.style.color = "var(--vscode-charts-green)";
        } else {
            btn.textContent = "Start MCP Server";
            status.textContent = "Stopped";
            status.style.color = "var(--vscode-foreground)";
        }
    }

    private updateMcpConfigStatus(message: string): void {
        document.getElementById("mcpConfigStatus")!.textContent = message;
    }

    private renderDscList(): void {
        const container = document.getElementById(elementId.dscPathsList)!;
        container.innerHTML = "";
        this.dscPaths.forEach((path, index) => {
            const item = document.createElement("div");
            item.className = "dsc-list-item";

            const pathSpan = document.createElement("span");
            pathSpan.className = "dsc-path";
            pathSpan.textContent = path;
            item.appendChild(pathSpan);

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.textContent = "Edit";
            editBtn.addEventListener("click", () => this.editDscItem(index));
            item.appendChild(editBtn);

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => this.deleteDscItem(index));
            item.appendChild(deleteBtn);

            container.appendChild(item);
        });
    }

    private editDscItem(index: number): void {
        const container = document.getElementById(elementId.dscPathsList)!;
        const item = container.children[index] as HTMLElement;
        const currentPath = this.dscPaths[index];

        item.innerHTML = "";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "dsc-edit-input";
        input.value = currentPath;
        item.appendChild(input);

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", () => {
            this.dscPaths[index] = input.value;
            this.renderDscList();
            this.onDscPathsChanged();
        });
        item.appendChild(saveBtn);

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => this.renderDscList());
        item.appendChild(cancelBtn);

        input.focus();
    }

    private deleteDscItem(index: number): void {
        this.dscPaths.splice(index, 1);
        this.renderDscList();
        this.onDscPathsChanged();
    }

    private onDscPathsChanged(): void {
        if (this.updating) { return; }
        this.vsCodeApi.postMessage({
            command: "change",
            config: this.collectConfig()
        });
    }

    // --- Build Defines ---

    private addBuildDefinesEvents(): void {
        document.getElementById(elementId.buildDefinesAddBtn)!.addEventListener("click", () => {
            const nameInput = <HTMLInputElement>document.getElementById(elementId.buildDefineNewName);
            const valueInput = <HTMLInputElement>document.getElementById(elementId.buildDefineNewValue);
            const name = nameInput.value.trim();
            const value = valueInput.value.trim();
            if (name) {
                this.buildDefines.push({ name, value });
                this.renderBuildDefinesList();
                this.onBuildDefinesChanged();
                nameInput.value = "";
                valueInput.value = "";
            }
        });
    }

    private renderBuildDefinesList(): void {
        const container = document.getElementById(elementId.buildDefinesList)!;
        container.innerHTML = "";
        this.buildDefines.forEach((def, index) => {
            const item = document.createElement("div");
            item.className = "define-list-item";

            const nameSpan = document.createElement("span");
            nameSpan.className = "define-name";
            nameSpan.textContent = def.name;
            item.appendChild(nameSpan);

            const valueSpan = document.createElement("span");
            valueSpan.className = "define-value";
            valueSpan.textContent = def.value;
            item.appendChild(valueSpan);

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.textContent = "Edit";
            editBtn.addEventListener("click", () => this.editBuildDefineItem(index));
            item.appendChild(editBtn);

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => this.deleteBuildDefineItem(index));
            item.appendChild(deleteBtn);

            container.appendChild(item);
        });
    }

    private editBuildDefineItem(index: number): void {
        const container = document.getElementById(elementId.buildDefinesList)!;
        const item = container.children[index] as HTMLElement;
        const current = this.buildDefines[index];

        item.innerHTML = "";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "define-edit-input";
        nameInput.value = current.name;
        item.appendChild(nameInput);

        const valueInput = document.createElement("input");
        valueInput.type = "text";
        valueInput.className = "define-edit-input";
        valueInput.value = current.value;
        item.appendChild(valueInput);

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", () => {
            this.buildDefines[index] = { name: nameInput.value.trim(), value: valueInput.value.trim() };
            this.renderBuildDefinesList();
            this.onBuildDefinesChanged();
        });
        item.appendChild(saveBtn);

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => this.renderBuildDefinesList());
        item.appendChild(cancelBtn);

        nameInput.focus();
    }

    private deleteBuildDefineItem(index: number): void {
        this.buildDefines.splice(index, 1);
        this.renderBuildDefinesList();
        this.onBuildDefinesChanged();
    }

    private onBuildDefinesChanged(): void {
        if (this.updating) { return; }
        this.vsCodeApi.postMessage({
            command: "change",
            config: this.collectConfig()
        });
    }

    // --- Package Paths ---

    private addPackagePathsEvents(): void {
        document.getElementById(elementId.packagePathsAddBtn)!.addEventListener("click", () => {
            this.vsCodeApi.postMessage({ command: "selectPackagePath" });
        });
    }

    private renderPackagePathsList(): void {
        const container = document.getElementById(elementId.packagePathsList)!;
        container.innerHTML = "";
        this.packagePaths.forEach((p, index) => {
            const item = document.createElement("div");
            item.className = "pkg-list-item";

            const pathSpan = document.createElement("span");
            pathSpan.className = "pkg-path";
            pathSpan.textContent = p;
            item.appendChild(pathSpan);

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.textContent = "Edit";
            editBtn.addEventListener("click", () => this.editPackagePathItem(index));
            item.appendChild(editBtn);

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => this.deletePackagePathItem(index));
            item.appendChild(deleteBtn);

            container.appendChild(item);
        });
    }

    private editPackagePathItem(index: number): void {
        const container = document.getElementById(elementId.packagePathsList)!;
        const item = container.children[index] as HTMLElement;
        const currentPath = this.packagePaths[index];

        item.innerHTML = "";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "pkg-edit-input";
        input.value = currentPath;
        item.appendChild(input);

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", () => {
            this.packagePaths[index] = input.value;
            this.renderPackagePathsList();
            this.onPackagePathsChanged();
        });
        item.appendChild(saveBtn);

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => this.renderPackagePathsList());
        item.appendChild(cancelBtn);

        input.focus();
    }

    private deletePackagePathItem(index: number): void {
        this.packagePaths.splice(index, 1);
        this.renderPackagePathsList();
        this.onPackagePathsChanged();
    }

    private onPackagePathsChanged(): void {
        if (this.updating) { return; }
        this.vsCodeApi.postMessage({
            command: "change",
            config: this.collectConfig()
        });
    }

    private collectConfig(): any {
        const elements: NodeListOf<HTMLElement> = document.getElementsByName("inputValue");
        let config: any = {};
        elements.forEach(el => {
            const data: HTMLInputElement = <HTMLInputElement>document.getElementById(el.id);
            config[data.id] = data.value;
        });
        config[elementId.dscPaths] = this.dscPaths.join("\n");
        config[elementId.buildDefines] = this.buildDefines.map(d => `${d.name}=${d.value}`).join("\n");
        config[elementId.packagePaths] = this.packagePaths.join("\n");
        return config;
    }

    private addEventsToInputValues(): void {
        const elements: NodeListOf<HTMLElement> = document.getElementsByName("inputValue");
        elements.forEach(el => {
            el.addEventListener("change", this.onChanged.bind(this, el.id));
        });
    }



    private onTabKeyDown(e: any): void {
        if (e.keyCode === 9) {
            document.body.classList.add("tabbing");
            window.removeEventListener("keydown", this.onTabKeyDown);
            window.addEventListener("mousedown", this.onMouseDown.bind(this));
        }
    }

    private onMouseDown(): void {
        document.body.classList.remove("tabbing");
        window.removeEventListener("mousedown", this.onMouseDown);
        window.addEventListener("keydown", this.onTabKeyDown.bind(this));
    }


    private onChanged(id: string): void {
        if (this.updating) {
            return;
        }

        this.vsCodeApi.postMessage({
            command: "change",
            config: this.collectConfig()
        });
    }

    private onMessageReceived(e: MessageEvent): void {
        const message: any = e.data; // The json data that the extension sent
        switch (message.command) {
            case 'updateConfig':
                this.updateConfig(message.config);
                break;
            case 'updateErrors':
                this.updateErrors(message.errors);
                break;
            case 'addDscFile':
                if (message.path && !this.dscPaths.includes(message.path)) {
                    this.dscPaths.push(message.path);
                    this.renderDscList();
                    this.onDscPathsChanged();
                }
                break;
            case 'addPackagePath':
                if (message.path && !this.packagePaths.includes(message.path)) {
                    this.packagePaths.push(message.path);
                    this.renderPackagePathsList();
                    this.onPackagePathsChanged();
                }
                break;
            case 'mcpStatus':
                this.updateMcpStatus(message.running);
                if (message.port !== undefined) {
                    (<HTMLInputElement>document.getElementById("mcpPort")).value = message.port.toString();
                }
                break;
            case 'mcpConfigResult':
                this.updateMcpConfigStatus(message.message);
                break;
        }
    }

    private updateConfig(config: any): void {
        this.updating = true;
        try {
            // DSC paths
            this.dscPaths = (config.dscPaths && config.dscPaths.length) ? [...config.dscPaths] : [];
            this.renderDscList();

            // Build defines (stored as "name=value" strings)
            if (config.buildDefines && config.buildDefines.length) {
                this.buildDefines = config.buildDefines.map((entry: string) => {
                    const eqIdx = entry.indexOf("=");
                    if (eqIdx >= 0) {
                        return { name: entry.substring(0, eqIdx), value: entry.substring(eqIdx + 1) };
                    }
                    return { name: entry, value: "" };
                });
            } else {
                this.buildDefines = [];
            }
            this.renderBuildDefinesList();

            // Package paths
            this.packagePaths = (config.packagePaths && config.packagePaths.length) ? [...config.packagePaths] : [];
            this.renderPackagePathsList();
           
        } finally {
            this.updating = false;
        }
    }

    private updateErrors(errors: any): void {
        this.updating = true;
        try {
            this.showErrorWithInfo(elementId.configNameInvalid, errors.name);
            this.showErrorWithInfo(elementId.configNameInvalid, errors.name);
            this.showErrorWithInfo(elementId.configNameInvalid, errors.name);
        } finally {
            this.updating = false;
        }
    }

    private showErrorWithInfo(elementID: string, errorInfo: string): void {
        this.showElement(elementID, errorInfo ? true : false);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        document.getElementById(elementID)!.innerHTML = errorInfo ? errorInfo : "";
    }



    private showElement(elementID: string, show: boolean): void {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        document.getElementById(elementID)!.style.display = show ? "block" : "none";
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const app: SettingsApp = new SettingsApp();
