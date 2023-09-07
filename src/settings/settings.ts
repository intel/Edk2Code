/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

const elementId: { [key: string]: string } = {
    // Basic settings
    dscPaths: "dscPaths",
    buildDefines: "buildDefines",
    packagePaths: "packagePaths",
    
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

    constructor() {
        this.vsCodeApi = acquireVsCodeApi();
        window.addEventListener("keydown", this.onTabKeyDown.bind(this));
        window.addEventListener("message", this.onMessageReceived.bind(this));

        // Add event listeners to UI elements

        this.addEventsToInputValues();
        this.vsCodeApi.postMessage({
            command: "initialized"
        });
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

        const elements: NodeListOf<HTMLElement> = document.getElementsByName("inputValue");
        let config:any = {};
        elements.forEach(el => {
            const data: HTMLInputElement = <HTMLInputElement>document.getElementById(el.id);
            config[data.id]=data.value;
        });

        this.vsCodeApi.postMessage({
            command: "change",
            config: config
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
        }
    }

    private updateConfig(config: any): void {
        this.updating = true;
        try {
            const joinEntries: (input: any) => string = (input: string[]) => (input && input.length) ? input.join("\n") : "";

            // Basic settings
            (<HTMLInputElement>document.getElementById(elementId.dscPaths)).value = joinEntries(config.dscPaths);
            (<HTMLInputElement>document.getElementById(elementId.packagePaths)).value = joinEntries(config.packagePaths);
            (<HTMLInputElement>document.getElementById(elementId.buildDefines)).value = joinEntries(config.buildDefines);
           
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
