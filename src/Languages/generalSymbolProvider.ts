import * as vscode from 'vscode';
import * as fs from 'fs';
import { getStaticPath, itsPcdSelected, split } from '../utils';
import path = require('path');
import { CompletionItemKind } from 'vscode';
import { EdkDatabase } from '../edkParser/edkDatabase';
import { gEdkDatabase } from '../extension';



export class EdkSymbolProvider implements vscode.DocumentSymbolProvider {
  edkDatabase:EdkDatabase;

  constructor(db:EdkDatabase){
      this.edkDatabase = db;
  }

  public async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken){

      let parser = await this.edkDatabase.getParser(document.uri.fsPath);
      
      if(!parser){return;}
      await parser.parseFile();
      
      let symbols = parser.getSymbolsTree();
      
      return symbols;
  }
}





export class HelpHoverProvider implements vscode.HoverProvider{
  entries: any;
  selectionFunction: Function;
  fields: { fieldname: string; pre: string; pos: string; }[];

  constructor (jsonFile:string, selectionFunction:Function, fields:{fieldname:string, pre:string, pos:string}[]){
    let jsonHelp = getStaticPath(jsonFile);
    var values = fs.readFileSync(jsonHelp).toString();
    this.entries = JSON.parse(values);
    this.selectionFunction = selectionFunction;
    this.fields = fields;
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken){
    let word = document.getText(document.getWordRangeAtPosition(position));
    let selectedHelp = undefined;
    if (word!== undefined){
      for (const help of this.entries) {
        if(this.selectionFunction(word,help)){
          selectedHelp = help;
        }
      }
      if(selectedHelp!== undefined){
        let hoverData = "";
        for (const field of this.fields) {
          if (selectedHelp[field.fieldname]!==""){
            hoverData += field.pre+selectedHelp[field.fieldname]+field.pos;
          }
        }
        return new vscode.Hover(hoverData);
      }
    }
  }
}






export class DictHoverProvider implements vscode.HoverProvider{
  edkDatabase: EdkDatabase;

  constructor (database:EdkDatabase){
    this.edkDatabase = database;
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken){
    let word = document.getText(document.getWordRangeAtPosition(position));
    let pcd = itsPcdSelected(document,position);

    if(pcd){
      return new vscode.Hover(pcd.value);
    }
    
    let hoverData = this.edkDatabase.getBuildDefines().get(word);
    if(!hoverData){return undefined;}
    return new vscode.Hover(hoverData);
  }
}




export class JsonCompletionItemLabel implements vscode.CompletionItemLabel{
  label: string;
  description: string;
  constructor(label:string, description:string){
    this.label = label;
    this.description = description;
  }
}

export class JsonCompletionProvider implements vscode.CompletionItemProvider{
  entries: any;
  completionCreateFunction: Function;

  constructor (jsonFile:string, completionCreateFunction:Function){
    let jsonHelp = getStaticPath(jsonFile);
    this.completionCreateFunction = completionCreateFunction;
    var values = fs.readFileSync(jsonHelp).toString();
    this.entries = JSON.parse(values);
  }

  async  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext){
    let returnList = [];
    for (const help of this.entries) {
        let x = this.completionCreateFunction(help);
        returnList.push(new vscode.CompletionItem(x, CompletionItemKind.Keyword));
    }
    return returnList;
  }
}


