Read [](file:///d%3A/github/Edk2Code/src/Languages/symbolProvider.ts#1-1), lines 1 to 100

Read [](file:///d%3A/github/Edk2Code/src/symbols/dscSymbols.ts#1-1), lines 1 to 100

Read [](file:///d%3A/github/Edk2Code/src/Languages/languages.ts)

Read [](file:///d%3A/github/Edk2Code/src/edkParser/dscParser.ts#1-1), lines 1 to 120

Read [](file:///d%3A/github/Edk2Code/src/edkParser/languageParser.ts#1-1), lines 1 to 100

Read [](file:///d%3A/github/Edk2Code/src/symbols/symbolFactory.ts#1-1), lines 1 to 80

Read [](file:///d%3A/github/Edk2Code/src/edkParser/languageParser.ts#100-100), lines 100 to 100

Here's the flow, end to end:

---

### 1. Registration (languages.ts)

`initLanguages()` calls:
```ts
vscode.languages.registerDocumentSymbolProvider(
  { scheme: 'file', language: 'edk2_dsc' },
  new EdkSymbolProvider()
);
```
This tells VS Code to call `EdkSymbolProvider` whenever the Outline/breadcrumb panel needs symbols for a `edk2_dsc` file.

---

### 2. `EdkSymbolProvider` (symbolProvider.ts)

Implements `vscode.DocumentSymbolProvider`. VS Code calls `provideDocumentSymbols()`, which:
1. Creates a parser via `ParserFactory.getParser(document)` — returns a `DscParser` for DSC files.
2. Calls `parser.parseFile()`.
3. Returns `parser.symbolsTree` — a `DocumentSymbol[]` tree.

---

### 3. DSC Parser — `BlockParser` tree (dscParser.ts)

The parser is defined as a hierarchy of `BlockParser` subclasses. Each one has:
- `tag`: regex that identifies lines starting this block
- `start`/`end`: optional regexes for block boundaries
- `type`: an `Edk2SymbolType` enum value
- `context`: nested child `BlockParser[]`

For DSC, the structure looks like:

```
BlockDefines      → [Defines] / [BuildOptions]
  └─ BlockDefinition     (DEFINE foo = bar)
BlockComponents   → [Components.*]
  └─ BlockComponentInf  (*.inf entries)
      ├─ BlocklibraryDef
      └─ BlockPcd
BlockLibraryClasses → [LibraryClasses.*]
  └─ BlocklibraryDef
BlockIncludes     → !include lines
```

---

### 4. `BlockParser.parse()` (languageParser.ts)

For each line, it:
1. Matches `tag` against the current line.
2. Calls `SymbolFactory.produceSymbol(type, ...)` to instantiate the right symbol class.
3. Calls `docParser.addSymbol(symbol)` and `pushSymbolStack(symbol)` — this nests the symbol under whatever is currently on the stack.
4. Recurses through `context` child parsers for inner lines, until `end` is matched.

---

### 5. Symbol classes (dscSymbols.ts)

Each DSC concept maps to a typed class with a `vscode.SymbolKind`:

| DSC element | Class | `SymbolKind` |
|---|---|---|
| `[Defines]`, `[Components]` | `EdkSymbolDscSection` | `Class` |
| `DEFINE key = val` | `EdkSymbolDscDefine` | `Constant` |
| `LibClass\|path.inf` | `EdkSymbolDscLibraryDefinition` | `Module` |
| PCD entries | `EdkSymbolDscPcdDefinition` | `String` |
| `!include` | `EdkSymbolDscInclude` | `File` |

---

### Summary

VS Code calls `provideDocumentSymbols` → `DscParser` scans the file line-by-line using a tree of regex-based `BlockParser` rules → matched lines are turned into `EdkSymbol` objects (via `SymbolFactory`) and pushed onto a hierarchy stack → the resulting `DocumentSymbol[]` tree (`symbolsTree`) is returned to VS Code, which renders it as the Outline view with proper nesting and icons.