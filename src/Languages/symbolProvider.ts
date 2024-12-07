import * as vscode from 'vscode';
import * as fs from 'fs';
import { getStaticPath, itsPcdSelected } from '../utils';
import path = require('path');
import { CompletionItemKind } from 'vscode';
import { ParserFactory } from '../edkParser/parserFactory';
import { gConfigAgent, gEdkWorkspaces } from '../extension';
import { Debouncer } from '../debouncer';


export class EdkSymbolProvider implements vscode.DocumentSymbolProvider {
  private _idUpdateNeeded: boolean = true;

  constructor() {
    vscode.workspace.onDidChangeTextDocument(this.setFlag, this);
  }

  private setFlag(event: vscode.TextDocumentChangeEvent) {
    const languageIds = ["edk2_dsc", "edk2_inf", "edk2_dec", "edk2_fdf"];
    if (languageIds.includes(event.document.languageId)) {
      this._idUpdateNeeded = true;
    }
  }

  public async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken) {

    // Create a parser for the document
    let factory = new ParserFactory();

    let parser = factory.getParser(document);
    if (parser) {

      await parser.parseFile();
      
        if (document.languageId === 'edk2_dsc' || document.languageId === 'edk2_fdf') {
          // create document from dscPath
          let wp = await gEdkWorkspaces.getWorkspace(document.uri);
          if(wp.length){
            // By defautl use the first workspace to parse the dsc file
            if(this._idUpdateNeeded){
              const debouncer = Debouncer.getInstance();
              debouncer.debounce("updateDocumentSymbols",async () => {
                await wp[0].proccessWorkspace();
                this._idUpdateNeeded = false;
              }, gConfigAgent.getDelayToRefreshWorkspace());
            }
            if (document.languageId === 'edk2_fdf') {
              await wp[0].fdfPostProcces(document);
            }else{
              await wp[0].grayoutDocument(document);
            }
          }
        }
      return parser.symbolsTree;
    }
    return [];
  }
}

export class HelpHoverProvider implements vscode.HoverProvider {
  entries: any;
  selectionFunction: Function;
  fields: { fieldname: string; pre: string; pos: string; }[];
  wordRegex: RegExp | undefined;
  constructor(jsonFile: string, selectionFunction: Function, fields: { fieldname: string, pre: string, pos: string }[], wordRegex: RegExp | undefined = undefined) {
    if (fs.existsSync(jsonFile)) {
      let jsonHelp = jsonFile;
      var values = fs.readFileSync(jsonHelp).toString();
      this.entries = JSON.parse(values);
    } else {
      this.entries = [];
    }
    this.wordRegex = wordRegex;
    this.selectionFunction = selectionFunction;
    this.fields = fields;
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
    let word = document.getText(document.getWordRangeAtPosition(position, this.wordRegex));
    let selectedHelp = undefined;
    if (word !== undefined) {
      for (const help of this.entries) {
        if (this.selectionFunction(word, help)) {
          selectedHelp = help;
        }
      }
      if (selectedHelp !== undefined) {
        let hoverData = "";
        for (const field of this.fields) {
          if (selectedHelp[field.fieldname] !== "") {
            hoverData += field.pre + selectedHelp[field.fieldname] + field.pos;
          }
        }
        return new vscode.Hover(hoverData);
      }
    }
  }
}


export class DictHoverProvider implements vscode.HoverProvider {
  dictData: Map<string, string>;
  wordRegex: RegExp | undefined;
  caseSensitive: boolean = false;
  constructor(database: Map<string, string>, wordRegex: RegExp | undefined = undefined, caseSensitive: boolean = false) {
    this.wordRegex = wordRegex;
    this.dictData = database;
    this.caseSensitive = caseSensitive;
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {

    let word = document.getText(document.getWordRangeAtPosition(position, this.wordRegex));
    if (!this.caseSensitive) {
      word = word.toUpperCase();
    }
    let hoverData = this.dictData.get(word);
    if (!hoverData) { return undefined; }
    return new vscode.Hover(hoverData);
  }
}



export class DictHoverProviderDb implements vscode.HoverProvider {

  constructor() {

  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
    let word = document.getText(document.getWordRangeAtPosition(position));
    let line = document.lineAt(position.line).text;

    // Match definition?
    if(line.match(new RegExp(`\\$\\(\\s*${word}\\s*\\)`))) {
      let wp = await gEdkWorkspaces.getWorkspace(document.uri);
      if(wp.length){
        let def = wp[0].getDefinitions().get(word);
        if (def) {
          return new vscode.Hover(def.value);
        }else{
          return new vscode.Hover("Undefined");
        }
      }
    }


    let pcd = await itsPcdSelected(document, position);
    if (pcd) {
      return new vscode.Hover(pcd.value);
    }



    // return new vscode.Hover(data.value);
  }
}




export class JsonCompletionItemLabel implements vscode.CompletionItemLabel {
  label: string;
  description: string;
  constructor(label: string, description: string) {
    this.label = label;
    this.description = description;
  }
}

export class JsonCompletionProvider implements vscode.CompletionItemProvider {
  entries: any;
  completionCreateFunction: Function;

  constructor(jsonFile: string, completionCreateFunction: Function) {
    let jsonHelp = getStaticPath(jsonFile);
    this.completionCreateFunction = completionCreateFunction;
    var values = fs.readFileSync(jsonHelp).toString();
    this.entries = JSON.parse(values);
  }

  async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
    let returnList = [];
    for (const help of this.entries) {
      let x = this.completionCreateFunction(help);
      returnList.push(new vscode.CompletionItem(x, CompletionItemKind.Keyword));
    }
    return returnList;
  }
}


