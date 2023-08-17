import path = require('path');
import * as vscode from 'vscode';
import { gExtensionContext, gEdkDatabase, gConfigAgent, gWorkspacePath } from './extension';
import { getNonce } from './utilities/getNonce';
import { getRealPathRelative } from './utils';
import { EdkDatabase } from './edkParser/edkDatabase';

export class ProjectReport {
    edkDatabase: EdkDatabase;
    constructor(projectParser:EdkDatabase) {
        this.edkDatabase = projectParser;
    }

    async render() {

        const webviewPanel = vscode.window.createWebviewPanel(
            'Project Report',
            `Project Report`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true
            }
        );

        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                
                switch (message.command) {
                    case 'reloadCmd':
                        // get defines in message.commands and populate settingsx.defines
                        for (const setDefine of message.data) {
                            if(setDefine.value.trim()!== "???" && setDefine.value.trim()!==""){
                                await gConfigAgent.setBuildDefines(setDefine.name, setDefine.value);
                            }
                        }
                    case 'finishCmd':
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        

                        let settingsx = gEdkDatabase.getSettings();
                        gEdkDatabase.resetVariables();
                        await gEdkDatabase.clearWorkspace();
                        gEdkDatabase.setInputBuildDefines(settingsx.defines);
                        gEdkDatabase.setPackagesPaths(settingsx.includes);
                        let quickLoad = true;
                        if(message.command === "finishCmd"){
                            quickLoad = false;
                        }
                        await gEdkDatabase.load(settingsx.dscFiles, quickLoad);
                        await gEdkDatabase.saveSettings(gEdkDatabase.getInputBuildDefines(), settingsx.dscFiles, settingsx.includes);
                        let report = new ProjectReport(gEdkDatabase);
                        if(quickLoad){
                            await report.render();
                        }
        		        
                        // vscode.commands.executeCommand('workbench.action.openSettings', 'edk2code' );
                        return;
                    case "loadOptions":
                        // Remove $(variables)
                        let hint = message.data.hint;
                        let name = message.data.name;
                        let truncatePath = hint.replaceAll("/","\\").split(")");
                        truncatePath = truncatePath[truncatePath.length-1];
                        let filterOptions = new Set();
                        let options = await this.edkDatabase.findPathGlob(truncatePath);
                        for (let option of options) {
                            console.log(option);
                            
                            option = getRealPathRelative(option);
                            for (const incPath of this.edkDatabase.getPackagesPaths().sort((a:string,b:string)=>{return b.length - a.length;})) {
                                option = option.replace(incPath,"");
                            }
                            option = option.replace(truncatePath,"");
                            filterOptions.add(option);
                            console.log(option);
                        }
                        // let options = this.compileInfo.projectParser.findPathGlobSync(truncatePath);
                        if(filterOptions.size>0){
                            let settings = gEdkDatabase.getSettings();
                            settings.defines.set(message.data.name, <string>Array.from(filterOptions.keys())[0]);
                            await gEdkDatabase.saveSettings(settings.defines, settings.dscFiles, settings.includes);
                            
                        }
                        await webviewPanel.webview.postMessage({command:"updateDefineOptions", data:Array.from(filterOptions.keys()), name:name});
                        return;
                    case "ChangeDefine":
                        let settings = gEdkDatabase.getSettings();
                        settings.defines.set(message.data.name, message.data.value);
                        await gEdkDatabase.saveSettings(settings.defines, settings.dscFiles, settings.includes);
                        return;
                    case "SearchDscDefine":
                        let dscPaths = gEdkDatabase.getDscPaths().join(", ").replaceAll(`${gWorkspacePath}\\`, "");
                        await vscode.commands.executeCommand("workbench.action.findInFiles", {query:`$(${message.data.name})`, filesToInclude:dscPaths, isCaseSensitive:true, isRegex:false, triggerSearch:true});
                }
            },
            undefined,
            gExtensionContext.subscriptions
        );

        await this.setHtmlContent(webviewPanel.webview, gExtensionContext);
    }

    
    async setHtmlContent(webview: vscode.Webview, extensionContext: vscode.ExtensionContext) {
        const nonce = getNonce();
  
        const fileUri = (fp: string) => {
          const fragments = fp.split('/');
          return vscode.Uri.file(
            path.join(extensionContext.asAbsolutePath(""),...fragments)
          );
        };
  
        const assetUri = (fp: string) => {
          return webview.asWebviewUri(fileUri(fp));
        };
        
        //
        // Popuplate defines
        //


        // Populare defines for paths
        let defines = "";
        let idNumber = 0;
        for (const [name, hints] of this.edkDatabase.getMissingPathVars()) {
            
            // Ignore paths with two variables
            let twoVariables = false;
            for (const hint of hints) {
                if(hint.split("$").length > 2){
                    twoVariables = true;
                }
            }
            if(twoVariables){
                continue;
            }

            let hintStr = "";
            for (const hint of hints) {
                let replacedHint = hint;
                let matches = hint.matchAll(/\$\((?<target>.*?)\)/gi);
                for (const match of matches) {
                    if(match !== null &&
                        match.groups !== undefined &&
                        "target" in match.groups){
                            replacedHint = replacedHint.replaceAll(match.groups['target'],`<code>${match.groups['target']}</code>`);
                        }
                }
                hintStr += `<div hint="${hint}" name="${name}" class="hintButton" id="btn_${idNumber}"> ${replacedHint}</div>`;              
                idNumber+=1;
            }
            

            defines += /*html*/`
            <div class="defineOption">
                <div class="hintHeader">
                ${name}= <select class="defineSelectBox" name=${name} id="select_${name}">
                         </select><vscode-badge style="margin-left:5px"> 0 options (Select a path bellow)</vscode-badge>
                </div id=defineOption_${name}>
                <div id ="hint_${name}">
                Select path to see options <vscode-icon name="question" title="This is a list of Paths found in DSC files which
contains undefined variable ${name}. Select a path to see options of values for ${name}."></vscode-icon>:
      
   
                <vscode-scrollable class="hints" >
                    ${hintStr}
                </vscode-scrollable>
                </div>
            </div>
            `;
        }


        // Populate paths with two missing variables
        for (const [name, hints] of this.edkDatabase.getMissingPathVars()) {
            // Ignore paths with two variables
            let twoVariables = false;
            for (const hint of hints) {
                if(hint.split("$").length > 2){
                    twoVariables = true;
                }
            }
            if(twoVariables){
                defines += /*html*/`
                <div>
                <vscode-button icon="search" class = "defineOptionVar" id="missing_dsc_${name}">${name}*</vscode-button>
                    <vscode-textfield placeholder="???" value="???"  id="missing_dsc_value_${name}" class="defineOptionVarValue"></vscode-textfield>
                </div>
                `;
            }
        }

        // Populate missing defines
        for (const [name, value] of this.edkDatabase.getBuildDefines()) {
            if(value === "???"){
                defines += /*html*/`
                <div>
                <vscode-button icon="search" class = "defineOptionVar" id="missing_dsc_${name}">${name}</vscode-button>
                    <vscode-textfield placeholder="???" value="${value}"  id="missing_dsc_value_${name}" class="defineOptionVarValue"></vscode-textfield>
                </div>
                `;
            }

        }
        ///<<<<
        
        //
        // Popuplate Includes
        //
        let includes = "";
        for (const includePath of this.edkDatabase.getPackagesPaths()) {
            includes += `
            <vscode-table-row>
            <vscode-table-cell>${includePath}</vscode-table-cell>
            </vscode-table-row>
            `;
        }


          let htmlContent = /*html*/
      `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="${assetUri('static/jquery.min.js')}"></script>
        <link rel="stylesheet" href="${assetUri('node_modules/@vscode/codicons/dist/codicon.css')}" nonce="${nonce}" id="vscode-codicon-stylesheet">
              <script src="${assetUri('node_modules/@bendera/vscode-webview-elements/dist/bundled.js')}" nonce="${nonce}" type="module"></script>
        <style>
        .hints {
            height:100px;
            padding-bottom: 10px;
            border: solid;
            border-width: thin;
            background: white;
            color: black;
        }
        .highligth{
            background:yellow;
        }
        .missingOption{
            color:red;

        }
        .defineOption{
            background: whitesmoke;
            padding: 20px;
            margin: 10px;
        }

        .defineOptionVarValue{
            align-items:end;
        }
        .helpArea{
            padding: 10px;
            background: ghostwhite;
            border-radius: 5px;
        }
        .defineSelectBox{
        
        }
        .hintButton{
            cursor: pointer;
        }
        .hintHeader{
            padding: 10px;
            
        }

        .disable {
            pointer-events: none;
            opacity: 0.3;
        }
        </style>
      </head>
      <script>
        const vscode = acquireVsCodeApi();
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('btnReloadCmd').addEventListener('vsc-click', (ev) => {

                const definesOptionsText = document.getElementsByClassName("defineOptionVarValue");
                var defineOptions = [];
                for (let i = 0; i < definesOptionsText.length; i++) {
                    let selectId = definesOptionsText[i].id

                        let selectBox = document.getElementById(selectId);
                        defineOptions.push({"name": selectBox.id.replace("missing_dsc_value_",""), "value":selectBox.value});

                        

                }
                
                console.log(defineOptions);
                
                vscode.postMessage({
                    command: 'reloadCmd',
                    data: defineOptions
                })
            });

            document.getElementById('btnFinishCmd').addEventListener('vsc-click', (ev) => {

                vscode.postMessage({
                    command: 'finishCmd'
                })
            });


            // Handle the message inside the webview
            window.addEventListener('message', (event) => {  
                const message = event.data;
                console.log(message)
                switch (message.command) {
                    case 'updateDefineOptions':
                        console.log(message.data)
                        let data = message.data;
                        let name = message.name;
                        let selectItem = $("#select_" + name);
                        selectItem.html("");
                        // remove previous options
                        selectItem.children().empty();
    

                        for (let i = 0; i < data.length; i++) {
                            text = data[i];
                            selectItem.append("<option>"+text+"</option>")
                        }

                        // Enable build definitions area
                        $("#buildDefinitions").removeClass("disable");
                        if(data.length === 1){
                            selectItem.siblings("vscode-badge").html("Just one option. This must be the rigth one")
                        }else{
                            selectItem.siblings("vscode-badge").html(data.length + " options")
                        }
                        

                        break;
                }

            });


            const collection = document.getElementsByClassName("hintButton");
            for (let i = 0; i < collection.length; i++) {
                let btnId = "btn_" + i;
                collection[i].addEventListener('click',()=>{
                    let div = $("#"+btnId);
                    let hint = div.attr("hint")
                    let name = div.attr("name")

                    // Highligth selected option
                    div.siblings().removeClass("highligth");
                    div.addClass("highligth");

                    // Disable build definitions area
                    let selectId = "buildDefinitions";
                    let selectItem = $("#"+selectId);
                    selectItem.addClass("disable")
                    
                    vscode.postMessage({
                        command: 'loadOptions',
                        data:{"hint": hint, "name":name}
                    })
                })
            }


            const selectCollection = document.getElementsByClassName("defineSelectBox");
            for (let i = 0; i < selectCollection.length; i++) {
                let selectId = selectCollection[i].id
                selectCollection[i].addEventListener("change",(x)=>{
                    
                    let selectBox = document.getElementById(selectId);
                    vscode.postMessage({
                        command: 'ChangeDefine',
                        data:{"name": selectBox.name, "value":selectBox.value}
                    })
                    console.log(selectBox.value)
                });
            }

            const missingDscs = document.getElementsByClassName("defineOptionVar");
            for (let i = 0; i < missingDscs.length; i++) {
                let selectId = missingDscs[i].id
                missingDscs[i].addEventListener("click",(x)=>{
                    
                    let missingDiv = document.getElementById(selectId);
                    //todo: Remove highligth class and then add the highligt to the selected item
                    vscode.postMessage({
                        command: 'SearchDscDefine',
                        data:{"name": missingDiv.id.replace("missing_dsc_","")}
                    })
                    
                });
            }
        });
      </script>

      <body>
        <div class=helpArea>
This screen will help you to complete the configuration of the workspace.<br>
You need to select values for <i>"Missing build definitions"</i>. After you selected a
value, you can press the "Save and reload" button to see new results.<br>
You don't have to populate all variables but you will get better results if you complete the most.
You have to press "Finish" button to end the configuration.<br>

<b>DSC parsed:</b> <code>${gConfigAgent.getBuildDscPaths()[0]}</code><br>
<b>Files in project:</b> ${this.edkDatabase.getFilesInUse().length}<br><br>

<vscode-button icon="refresh" id="btnReloadCmd">Save and reload</vscode-button>
<vscode-button icon="save" id="btnFinishCmd">Finish</vscode-button>
        </div>


        

        <h2>Missing build definitions for paths: ${this.edkDatabase.getMissingPathVars().size}</h2>

        <div id="buildDefinitions">
        ${defines}
        </div>





        <h2>Package paths: <vscode-icon name="question" title="This is just information on what paths
were discovered during parsing"></vscode-icon></h2>
        <vscode-table columns='["auto"]' zebra bordered>
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Include</vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
                    ${includes}
            </vscode-table-body>
        </vscode-table>
      </body>

    </html>
    `;
          webview.html = htmlContent;
      }
}