# Test Suite

Integration tests for the Edk2Code VS Code extension.  
Tests run under Mocha (TDD UI) via `@vscode/test-electron`.

## Running Tests

- **VS Code**: Use the **Extension Tests** launch configuration (F5).
- **CLI**: `node ./out/test/runTest.js` (bypasses lint).

## Fixture Files

Test fixtures live in the `test/` folder at the repository root:

| Fixture | Used By |
|---------|---------|
| `testDscParsing.dsc` | `dscParser.test.ts`, `edkWorkspace.test.ts` |
| `testDecParsing.dec` | `decParser.test.ts` |
| `testFdfParsing.fdf` | `fdfParser.test.ts`, `edkWorkspace.test.ts` |
| `testInfParsing.inf` | `infParser.test.ts` |
| `testAslParsing.asl` | `aslParser.test.ts` |
| `testVfrParsing.vfr` | `vfrParser.test.ts` |
| `testDscProcess.dsc` | `edkWorkspaceProcess.test.ts` |

---

## Test Files — Detailed Breakdown

### `extension.test.ts`

**Suite: Extension Test Suite** — Smoke test that validates the test harness is working.

| # | Test | Description |
|---|------|-------------|
| 1 | Sample test | Asserts `Array.indexOf` returns `-1` for missing elements. Proves the Mocha runner and VS Code test host are functional. |

---

### `dscParser.test.ts`

**Suite: DSC Parser – Symbol Extraction** — Parses `test/testDscParsing.dsc` with `DscParser` and validates that all DSC symbol types are correctly extracted. The fixture includes `[Defines]`, `[SkuIds]`, `[LibraryClasses]` (common + `.X64`), `[Components]` (common + `.X64` with sub-sections), PCD sections, `[BuildOptions]`, root-level `DEFINE`, `!include`, and block comments.

| # | Test | Description |
|---|------|-------------|
| 1 | Parses [Defines] section | At least one `dscSection` symbol with name matching "defines". |
| 2 | Parses [LibraryClasses] sections (common + arch-specific) | At least 2 `dscSection` symbols for `LibraryClasses` (common and `.X64`). |
| 3 | Parses [Components] and [Components.X64] sections | At least 2 `dscSection` symbols for `Components`. |
| 4 | Parses [SkuIds] section | Exactly 1 `dscSection` symbol for `SkuIds`. |
| 5 | Parses [BuildOptions] section | At least 1 `dscBuildOptionsSection` symbol. |
| 6 | Parses PCD sections (FixedAtBuild + DynamicDefault) | At least 2 `dscSection` symbols with names matching "pcd". |
| 7 | Parses DEFINE statements inside [Defines] | At least 3 `dscDefine` symbols (`DEFINE MY_VAR`, `DEFINE EMPTY_VAR`, `ROOT_DEFINE`). |
| 8 | DEFINE with empty value is still parsed | Finds `EMPTY_VAR` in the define list (covers `DEFINE EMPTY_VAR=`). |
| 9 | Root-level DEFINE (outside section) is parsed | Finds `ROOT_DEFINE` as a `dscDefine` (defined outside any section header). |
| 10 | Parses library class definitions | At least 4 `dscLibraryDefinition` symbols (BaseLib, DebugLib, PrintLib, TimerLib, plus overrides). |
| 11 | Library definition with extra whitespace around pipe is parsed | Finds `PrintLib` even when the line has extra spaces around `\|`. |
| 12 | Parses simple .inf module references | At least 3 `dscModuleDefinition` symbols. |
| 13 | Module with sub-sections (curly braces) is parsed | Finds `ComplexModule.inf` and asserts it has `children.length > 0`. |
| 14 | Component sub-sections are parsed | At least 2 `dscComponentSubSection` symbols (`<LibraryClasses>`, `<PcdsFixedAtBuild>`, `<BuildOptions>`). |
| 15 | Parses PCD definitions | At least 3 `dscPcdDefinition` symbols across FixedAtBuild, DynamicDefault, and component-scoped PCDs. |
| 16 | Parses build option entries | At least 2 `dscBuildOption` symbols (GCC and MSFT lines). |
| 17 | Parses !include directive | At least 1 `dscInclude` symbol; specifically finds `TestInclude.dsc.inc`. |
| 18 | symbolsTree contains top-level section nodes | `symbolsTree` is non-empty and every root node has an expected DSC symbol type. |
| 19 | Library definitions are children of their parent section | The `[LibraryClasses]` section node contains at least 3 child `dscLibraryDefinition` symbols. |
| 20 | symbolsList length equals total nodes across the tree | Flat `symbolsList.length` equals recursive count of all nodes in `symbolsTree`. |
| 21 | Comments are not parsed as symbols | No symbol name starts with `#`. |

---

### `decParser.test.ts`

**Suite: DEC Parser – Symbol Extraction** — Parses `test/testDecParsing.dec` with `DecParser`. The fixture includes `[Defines]`, `[Includes]` (common + `.X64`), `[LibraryClasses]`, `[Guids]` with GUID-format values, `[Protocols]`, `[Ppis]`, `[PcdsFixedAtBuild]`, and `[PcdsPatchableInModule]`.

| # | Test | Description |
|---|------|-------------|
| 1 | Parses [Defines] section | At least 1 `decSection` matching "defines". |
| 2 | Parses [Includes] sections (common + arch-specific) | At least 2 `decSection` symbols for `Includes` (common and `.X64`). |
| 3 | Parses [LibraryClasses] section | At least 1 `decSection` matching "libraryclasses". |
| 4 | Parses [Guids] section | At least 1 `decSection` matching "guids". |
| 5 | Parses [Protocols] section | At least 1 `decSection` matching "protocols". |
| 6 | Parses [Ppis] section | At least 1 `decSection` matching "ppis". |
| 7 | Parses PCD sections | At least 2 `decSection` symbols with names matching "pcds" (FixedAtBuild + PatchableInModule). |
| 8 | Parses include directory entries | At least 2 `decInclude` symbols (e.g. `Include`, `Include/Library`). |
| 9 | Parses library class entries | At least 2 `decLibrary` symbols. |
| 10 | Parses GUID entries | At least 1 `decGuid` symbol with GUID-format value. |
| 11 | Parses protocol entries | At least 2 `decProtocol` symbols. |
| 12 | Parses PPI entries | At least 1 `decPpi` symbol. |
| 13 | Parses PCD entries | At least 2 `decPcd` symbols across different PCD sections. |
| 14 | symbolsTree is not empty | `symbolsTree.length > 0`. |
| 15 | symbolsList equals recursive tree count | Flat list count matches recursive tree traversal count. |
| 16 | Comments are not parsed as symbols | No symbol name starts with `#`. |

---

### `fdfParser.test.ts`

**Suite: FDF Parser – Symbol Extraction** — Parses `test/testFdfParsing.fdf` with `FdfParser`. The fixture includes `[FD.TestFd]`, `[FV.FVMAIN]` with INF entries and a `DEFINE`, `[FV.FVRECOVERY]` with an `APRIORI` block, `[Rule.Common.SEC]`, and `!include`.

| # | Test | Description |
|---|------|-------------|
| 1 | Parses [FD.*] section | At least 1 `fdfSection` matching "FD.". |
| 2 | Parses [FV.*] sections | At least 2 `fdfSection` symbols matching "FV." (FVMAIN and FVRECOVERY). |
| 3 | Parses [Rule.*] section | At least 1 `fdfSection` matching "Rule.". |
| 4 | Parses INF module references | At least 3 `fdfInf` symbols (SimpleModule, AnotherModule, AprioriModule, RecoveryModule). |
| 5 | Parses DEFINE statements | At least 2 `fdfDefinition` symbols. |
| 6 | Parses !include directive | At least 1 `fdfInclude` symbol; specifically finds `TestFdfInclude.fdf.inc`. |
| 7 | symbolsTree is not empty | `symbolsTree.length > 0`. |
| 8 | symbolsList equals recursive tree count | Flat list count matches recursive tree traversal count. |
| 9 | Comments are not parsed as symbols | No symbol name starts with `#`. |

---

### `infParser.test.ts`

**Suite: INF Parser – Symbol Extraction** — Parses `test/testInfParsing.inf` with `InfParser`. The fixture includes `[Defines]` (INF_VERSION, BASE_NAME, MODULE_TYPE, ENTRY_POINT, LIBRARY_CLASS, CONSTRUCTOR, DESTRUCTOR, DEFINE), `[Sources]` + `[Sources.X64]`, `[Packages]`, `[LibraryClasses]`, `[Protocols]`, `[Ppis]`, `[Guids]`, `[FixedPcd]`, and `[Depex]`.

| # | Test | Description |
|---|------|-------------|
| 1 | Parses [Defines] section | At least 1 `infSection` matching "defines". |
| 2 | Parses [Sources] section(s) | At least 1 `infSectionSource` symbol. |
| 3 | Parses [Packages] section | At least 1 `infSectionPackages` symbol. |
| 4 | Parses [LibraryClasses] section | At least 1 `infSectionLibraries` symbol. |
| 5 | Parses [Protocols] section | At least 1 `infSectionProtocols` symbol. |
| 6 | Parses [Ppis] section | At least 1 `infSectionPpis` symbol. |
| 7 | Parses [Guids] section | At least 1 `infSectionGuids` symbol. |
| 8 | Parses [Pcd] / [FixedPcd] section | At least 1 `infSectionPcds` symbol. |
| 9 | Parses [Depex] section | At least 1 `infSectionDepex` symbol. |
| 10 | Parses INF defines (MODULE_TYPE, BASE_NAME, etc.) | At least 7 `infDefine` symbols covering all key-value pairs in `[Defines]`. |
| 11 | Parses ENTRY_POINT define | Finds a define with name matching `ENTRY_POINT`. |
| 12 | Parses CONSTRUCTOR define | Finds a define with name matching `CONSTRUCTOR`. |
| 13 | Parses DESTRUCTOR define | Finds a define with name matching `DESTRUCTOR`. |
| 14 | Parses source file entries | At least 3 `infSource` symbols (`.c`, `.h`, arch-specific). |
| 15 | Parses package references | At least 2 `infPackage` symbols (e.g. `MdePkg/MdePkg.dec`). |
| 16 | Parses library class references | At least 3 `infLibrary` symbols. |
| 17 | Parses protocol entries | At least 2 `infProtocol` symbols. |
| 18 | Parses PPI entries | At least 1 `infPpi` symbol. |
| 19 | Parses GUID entries | At least 2 `infGuid` symbols. |
| 20 | Parses PCD entries | At least 1 `infPcd` symbol. |
| 21 | Parses dependency expression entries | At least 1 `infDepex` symbol. |
| 22 | symbolsTree is not empty | `symbolsTree.length > 0`. |
| 23 | symbolsList equals recursive tree count | Flat list count matches recursive tree traversal count. |
| 24 | Comments are not parsed as symbols | No symbol name starts with `#`. |

---

### `aslParser.test.ts`

**Suite: ASL Parser – Symbol Extraction** — Parses `test/testAslParsing.asl` with `AslParser`. The fixture includes a `DefinitionBlock`, 2 `External` declarations, 2 `Scope` blocks, 2 `Device` blocks (TPM0 with Name/Method/OperationRegion/Field, EC0 with Name/Method/OperationRegion/Field).

| # | Test | Description |
|---|------|-------------|
| 1 | Parses DefinitionBlock | At least 1 `aslDefinitionBlock` symbol. |
| 2 | Parses External declarations | At least 2 `aslExternal` symbols (`\_SB.PCI0`, `\_SB.PCI0.LPCB`). |
| 3 | Parses Scope blocks | At least 2 `aslScope` symbols (`\_SB`, `\_SB.PCI0`). |
| 4 | Parses Device blocks | At least 2 `aslDevice` symbols (`TPM0`, `EC0`). |
| 5 | Parses Name declarations | At least 4 `aslName` symbols (TVAR, _HID, _STR, PVAR, RBUF, etc.). |
| 6 | Parses Method blocks | At least 2 `aslMethod` symbols (_STA, _CRS, RFAN). |
| 7 | Parses OperationRegion declarations | At least 2 `aslOpRegion` symbols (TPMR, ECOR). |
| 8 | Parses Field declarations | At least 2 `aslField` symbols (Field on TPMR, Field on ECOR). |
| 9 | DefinitionBlock has children | The first `aslDefinitionBlock` has `children.length > 0`. |
| 10 | Device contains Names as children | `TPM0` device's children include at least one `aslName`. |
| 11 | symbolsTree is not empty | `symbolsTree.length > 0`. |
| 12 | symbolsList equals recursive tree count | Flat list count matches recursive tree traversal count. |
| 13 | Comments are not parsed as symbols | No symbol name starts with `//`. |

---

### `vfrParser.test.ts`

**Suite: VFR Parser – Symbol Extraction** — Parses `test/testVfrParsing.vfr` with `VfrParser`. The fixture includes a `formset` containing 2 `form` blocks, `oneof`, `checkbox`, `numeric`, `string`, `password`, and `goto` controls.

| # | Test | Description |
|---|------|-------------|
| 1 | Parses formset | At least 1 `vfrFormset` symbol. |
| 2 | Parses form blocks | Checks for `vfrForm` symbols. Note: the VFR parser does not nest `BlockFormSection` inside `BlockFormsetSection.context`, so `form` blocks inside `formset` may not be parsed. The test validates the parser does not crash. |
| 3 | Parses oneof controls | At least 2 `vfrOneof` symbols (Option1, Option2). |
| 4 | Parses checkbox controls | At least 1 `vfrCheckbox` symbol. |
| 5 | Parses numeric controls | At least 1 `vfrNumeric` symbol. |
| 6 | Parses string controls | At least 1 `vfrString` symbol. |
| 7 | Parses password controls | At least 1 `vfrPassword` symbol. |
| 8 | Parses goto references | At least 2 `vfrGoto` symbols (goto to form IDs). |
| 9 | Parses prompt entries inside controls | At least 2 `vfrString` symbols from `prompt` lines inside controls and the standalone string control. |
| 10 | symbolsTree is not empty | `symbolsTree.length > 0`. |
| 11 | Formset or form has children | At least one `vfrFormset` or `vfrForm` symbol has `children.length > 0`. |
| 12 | symbolsList equals recursive tree count | Flat list count matches recursive tree traversal count. |
| 13 | Comments are not parsed as symbols | No symbol name starts with `//`. |

---

### `edkWorkspace.test.ts`

Tests the workspace index classes from `src/index/edkWorkspace.ts`. These are unit-style tests that construct objects directly without running the full workspace processing pipeline.

#### Suite: SectionProperty

| # | Test | Description |
|---|------|-------------|
| 1 | constructor lowercases all fields | `SectionProperty('LibraryClasses', 'X64', 'DXE_DRIVER')` stores all values in lowercase. |
| 2 | constructor with already lowercase values | Passing already-lowercase strings preserves them unchanged. |

#### Suite: SectionProperties

| # | Test | Description |
|---|------|-------------|
| 1 | starts with empty properties | A new `SectionProperties()` has `properties.length === 0`. |
| 2 | addProperty adds correctly | After `addProperty('LibraryClasses', 'X64', 'DXE_DRIVER')`, length is 1 and sectionType is lowercased. |
| 3 | addProperty multiple | Adding 2 properties results in `properties.length === 2`. |
| 4 | compareArch returns true for matching arch | Two `SectionProperties` sharing `X64` arch return `true`. |
| 5 | compareArch returns false for different archs | `X64` vs `IA32` returns `false`. |
| 6 | compareArchStr returns true for matching arch string | Matches case-insensitively (both `'X64'` and `'x64'` match). |
| 7 | compareArchStr returns false for non-matching arch | `'IA32'` does not match an `X64`-only property set. |
| 8 | compareLibSectionType returns true for matching section type | Two `SectionProperties` both with `LibraryClasses` section type return `true`. |
| 9 | compareLibSectionType returns false for different section types | `LibraryClasses` vs `Components` returns `false`. |
| 10 | compareLibSectionTypeStr case-insensitive match | `'LibraryClasses'`, `'libraryclasses'`, and `'LIBRARYCLASSES'` all match. |
| 11 | compareLibSectionTypeStr returns false for non-matching | `'LibraryClasses'` does not match a `Components`-only property set. |
| 12 | compareModuleType returns true for matching module type | Two properties sharing `DXE_DRIVER` return `true`. |
| 13 | compareModuleType returns false for different module types | `DXE_DRIVER` vs `PEIM` returns `false`. |
| 14 | compareModuleTypeStr case-insensitive | Both `'DXE_DRIVER'` and `'dxe_driver'` match. |
| 15 | compareModuleTypeStr returns false for non-matching | `'PEIM'` does not match a `DXE_DRIVER`-only property set. |
| 16 | toString returns comma-separated properties | With 2 properties added, `toString()` output contains a comma. |
| 17 | compareArch matches any combination | A property set with both `X64` and `IA32` entries matches another set with only `IA32`. |

#### Suite: InfDsc

| # | Test | Description |
|---|------|-------------|
| 1 | constructor with section parent sets sectionProperties | Parent `'Components.X64'` sets `parent = undefined` and populates `sectionProperties` with `components/x64/common`. |
| 2 | constructor with INF parent sets parent path | Parent `'SomeModule/Module.inf'` (ending in `.inf`) sets `parent` to the normalized path and leaves `sectionProperties` empty. |
| 3 | constructor normalizes path separators | Forward slashes in the file path are replaced with `path.sep`. |
| 4 | constructor with multi-section parent | Parent `'LibraryClasses.X64.DXE_DRIVER,LibraryClasses.IA32.PEIM'` creates 2 section properties with correct arch and moduleType. |
| 5 | constructor with section missing arch defaults to common | Parent `'libraryclasses'` defaults both arch and moduleType to `'common'`. |
| 6 | getModuleTypeStr returns comma-separated module types | Multi-property InfDsc returns `'dxe_driver,peim'`. |
| 7 | getModuleTypeStr single property | Single `'Components.X64'` property returns `'common'` (moduleType defaults). |
| 8 | toString includes path and line number | `toString()` of an InfDsc at line 42 contains `'42'`. |
| 9 | text property stores original line | The `text` field preserves the raw DSC line text passed to the constructor. |
| 10 | location is preserved | The `vscode.Location` passed to the constructor is stored as-is (line 99). |

#### Suite: EdkWorkspaces

| # | Test | Description |
|---|------|-------------|
| 1 | isConfigured returns false when no workspaces | A fresh `EdkWorkspaces()` with no workspaces added returns `false`. |
| 2 | isConfigured returns true after adding a workspace | After pushing an `EdkWorkspace` into `workspaces`, returns `true`. |
| 3 | getInstance returns singleton | Two calls to `EdkWorkspaces.getInstance()` return the same reference. |
| 4 | isFileInUse returns undefined when no workspaces | With no workspaces, `isFileInUse()` returns `undefined` (indeterminate). |
| 5 | getWorkspace returns empty array when no workspaces | Returns `[]` when no workspaces are configured. |
| 6 | getDefinition returns undefined when no workspaces | Returns `undefined` for any variable lookup with no workspaces. |
| 7 | replaceDefines returns original text when no workspaces | `'$(MY_VAR)/path'` is returned unchanged when no workspace can resolve it. |
| 8 | getLib returns empty array when no workspaces | Returns `[]` for any location lookup with no workspaces. |

#### Suite: EdkWorkspace

| # | Test | Description |
|---|------|-------------|
| 1 | constructor sets mainDsc from document | `mainDsc.fsPath` ends with `testDscParsing.dsc`. |
| 2 | constructor generates a numeric id | `id` is a `number` and `> 0`. |
| 3 | platformName starts as undefined | Before `proccessWorkspace()`, `platformName` is `undefined`. |
| 4 | flashDefinitionDocument starts as undefined | Before processing, `flashDefinitionDocument` is `undefined`. |
| 5 | filesLibraries starts empty | `filesLibraries.length === 0`. |
| 6 | filesModules starts empty | `filesModules.length === 0`. |
| 7 | dscList is initially empty | `dscList()` returns `[]` before any processing. |
| 8 | fdfList is initially empty | `fdfList()` returns `[]` before any processing. |
| 9 | getFilesList aggregates all file lists | Returns an array combining DSC, FDF, module, and library paths. |
| 10 | includeTree starts empty | `includeTree.length === 0`. |
| 11 | getDefinitions returns a Map | The defines map is a `Map` instance even before processing. |
| 12 | getDefinition returns undefined for unknown key | `getDefinition('NON_EXISTENT')` returns `undefined`. |
| 13 | getDefinitionLocation returns undefined for unknown key | `getDefinitionLocation('NON_EXISTENT')` returns `undefined`. |
| 14 | replaceDefine passes through text with no defines | `'$(UNKNOWN_VAR)/path'` is unchanged when no defines are set. |
| 15 | getPcds returns undefined for unknown namespace | `getPcds('gUnknownPkg')` returns `undefined`. |
| 16 | getAllPcds returns a Map | PCD definitions map is a `Map` instance. |
| 17 | filesLibraries can be set | Setting via the property setter and reading back works correctly. |
| 18 | filesModules can be set | Setting via the property setter and reading back works correctly. |
| 19 | getFilesList includes libraries and modules | After setting both, `getFilesList()` returns at least 2 paths. |
| 20 | filesDsc can be set and read | Setting the `Set<TextDocument>` and reading `dscList()` returns 1 entry. |
| 21 | filesFdf can be set and read | Setting the `Set<TextDocument>` and reading `fdfList()` returns 1 entry. |
| 22 | getLib returns undefined when no matching library | A non-matching location returns `undefined`. |
| 23 | getLib finds matching library by location | An InfDsc with the exact same URI and line is found by `getLib()`. |

#### Suite: EdkWorkspace.evaluateExpression

Tests the Shunting-Yard expression evaluator used for `!if` / `!ifdef` / `!ifndef` conditional processing.

| # | Test | Description |
|---|------|-------------|
| 1 | TRUE evaluates to true | Literal `TRUE` → `true`. |
| 2 | FALSE evaluates to false | Literal `FALSE` → `false`. |
| 3 | true/false case-insensitive | `'true'`, `'True'`, `'false'` all parse correctly. |
| 4 | numeric 1 is truthy | `'1'` → `1`. |
| 5 | numeric 0 is falsy | `'0'` → `0`. |
| 6 | == with matching strings | `'"hello" == "hello"'` → `true`. |
| 7 | == with non-matching strings | `'"hello" == "world"'` → `false`. |
| 8 | != with different strings | `'"hello" != "world"'` → `true`. |
| 9 | != with same strings | `'"hello" != "hello"'` → `false`. |
| 10 | EQ operator | `'"a" EQ "a"'` → `true` (EDK2-style equality). |
| 11 | NE operator | `'"a" NE "b"'` → `true` (EDK2-style inequality). |
| 12 | AND with both true | `'TRUE AND TRUE'` → `true`. |
| 13 | AND with one false | `'TRUE AND FALSE'` → `false`. |
| 14 | OR with one true | `'FALSE OR TRUE'` → `true`. |
| 15 | OR with both false | `'FALSE OR FALSE'` → `false`. |
| 16 | && operator | `'TRUE && TRUE'` → `true` (C-style AND). |
| 17 | \|\| operator | `'FALSE \|\| TRUE'` → `true` (C-style OR). |
| 18 | NOT TRUE evaluates to false | `'NOT TRUE'` → `false` (unary NOT). |
| 19 | NOT FALSE evaluates to true | `'NOT FALSE'` → truthy. |
| 20 | addition | `'3 + 2'` → `5`. |
| 21 | subtraction | `'5 - 2'` → `3`. |
| 22 | multiplication | `'3 * 4'` → `12`. |
| 23 | division | `'10 / 2'` → `5`. |
| 24 | modulus | `'10 % 3'` → `1`. |
| 25 | greater than | `'5 > 3'` → `true`. |
| 26 | less than | `'3 > 5'` → `false`. |
| 27 | greater or equal | `'5 >= 5'` → `true`. |
| 28 | less or equal | `'3 <= 5'` → `true`. |
| 29 | parentheses group expressions | `'(TRUE OR FALSE) AND TRUE'` → `true`. |
| 30 | nested parentheses | `'((1 + 2) * 3)'` → `9`. |
| 31 | unbalanced parentheses throw | `'(TRUE AND FALSE'` throws an error. |
| 32 | IN operator with match | `'"X64" IN "X64 IA32 ARM"'` → `true`. |
| 33 | IN operator without match | `'"AARCH64" IN "X64 IA32 ARM"'` → `false`. |
| 34 | undefined variable evaluates to false | `'"???"'` (the undefined-variable sentinel) → `false`. |
| 35 | bare word is treated as quoted string | `'hello == "hello"'` → `true` (unquoted words auto-quoted). |
| 36 | complex: (1 + 2) > 2 AND TRUE | Mixed arithmetic + comparison + logical → `true`. |
| 37 | complex: FALSE OR (5 == 5) | Logical OR with parenthesised equality → `true`. |

---

### `edkWorkspaceProcess.test.ts`

Integration tests for the core workspace processing pipeline: `proccessWorkspace()`, `_doProccessWorkspace()`, and `_processDocument()`. Uses the `test/testDscProcess.dsc` fixture which includes `[Defines]`, `[LibraryClasses]`, `[Components]`, PCD sections, `[BuildOptions]`, conditional blocks (`!if`/`!ifdef`/`!ifndef`/`!else`/`!endif`), nested conditionals, and comments.

A `ensureProcessingGlobals()` helper stubs all required globals: `gDebugLog`, `gWorkspacePath`, `gConfigAgent`, `gPathFind`, `edkWorkspaceTreeProvider`, `DiagnosticManager`, and `edkStatusBar.myStatusBarItem`.

#### Suite: EdkWorkspace._processDocument

Processes the DSC fixture via the private `_processDocument(doc, 'DSC')` and validates all extracted data.

##### Document Registration

| # | Test | Description |
|---|------|-------------|
| 1 | Adds document to filesDsc | `dscList()` contains at least 1 entry ending with `testDscProcess.dsc`. |
| 2 | isDocumentInIndex returns true after processing | Private `isDocumentInIndex(doc)` returns `true` for the processed document. |
| 3 | Processing same document twice is a no-op | Calling `_processDocument` again does not add a duplicate entry to `dscList()`. |

##### Defines Extraction

| # | Test | Description |
|---|------|-------------|
| 4 | Extracts PLATFORM_NAME from [Defines] | `getDefinition('PLATFORM_NAME')` returns `'TestProcess'`. |
| 5 | Extracts PLATFORM_GUID | `getDefinition('PLATFORM_GUID')` returns `'11111111-2222-3333-4444-555555555555'`. |
| 6 | Extracts DEFINE MY_FLAG | `getDefinition('MY_FLAG')` returns `'TRUE'`. |
| 7 | Extracts DEFINE with empty value | `getDefinition('EMPTY_DEF')` is defined but trims to empty string. |
| 8 | Extracts root-level DEFINE | `getDefinition('ROOT_DEF')` returns `'RootValue'` (defined outside any section). |
| 9 | getDefinitionLocation returns a Location for known define | Location URI ends with `testDscProcess.dsc`. |
| 10 | getDefinitions returns all defines as a Map | Map instance with `size >= 5`. |

##### Define Variable Substitution

| # | Test | Description |
|---|------|-------------|
| 11 | DERIVED define has $(BASE) resolved | `DEFINE DERIVED = $(BASE)World` resolves to `'HelloWorld'`. |
| 12 | replaceDefine substitutes known variables | `replaceDefine('$(MY_FLAG)')` returns `'TRUE'`. |
| 13 | replaceDefine leaves unknown variables untouched | `'$(TOTALLY_UNKNOWN)'` passes through unchanged. |

##### PCD Extraction

| # | Test | Description |
|---|------|-------------|
| 14 | Extracts PCDs in gTestPkg namespace | `getPcds('gTestPkg')` is not `undefined`. |
| 15 | PcdTestMask has correct value | `PcdTestMask.value` is `'0x2F'`. |
| 16 | PcdBootTimeout from DynamicDefault | `PcdBootTimeout.value` is `'5'`. |
| 17 | PCD with L"string" value strips L prefix | `PcdStringVal.value` starts with `'"'` (L prefix removed). |
| 18 | PCD has location information | PCD position URI ends with `testDscProcess.dsc`. |
| 19 | getAllPcds returns all namespaces | Map contains `'gTestPkg'` key. |

##### Conditional Processing

| # | Test | Description |
|---|------|-------------|
| 20 | !if TRUE branch: COND_TAKEN is defined | `getDefinition('COND_TAKEN')` returns `'IfTrueValue'`. |
| 21 | !if TRUE branch: else branch not taken | `COND_TAKEN` is not `'IfFalseValue'`. |
| 22 | !if FALSE: else branch taken, COND_ELSE is defined | `getDefinition('COND_ELSE')` returns `'ElseValue'`. |
| 23 | !if FALSE: if branch not taken, COND_FALSE_IF not defined | `getDefinition('COND_FALSE_IF')` returns `undefined`. |
| 24 | Nested conditionals: outer TRUE inner FALSE -> INNER_ELSE defined | Both `OUTER_TRUE` (`'OuterOk'`) and `INNER_ELSE` (`'InnerElseOk'`) are set. |
| 25 | Nested conditionals: INNER_FALSE not defined | `getDefinition('INNER_FALSE')` returns `undefined`. |
| 26 | !ifdef on existing variable takes the branch | `IFDEF_TAKEN` is `'yes'` (variable `EXISTING_VAR` was defined). |
| 27 | !ifndef on undefined variable takes the branch | `IFNDEF_TAKEN` is `'yes'` (`TOTALLY_UNDEFINED_XYZ` not defined). |
| 28 | COND_A before conditional is still defined | `getDefinition('COND_A')` returns `'BeforeIf'`. |

##### Library and Module References

| # | Test | Description |
|---|------|-------------|
| 29 | Libraries are collected (even if paths unresolved) | `filesLibraries.length >= 2` (BaseLib, DebugLib, TimerLib). |
| 30 | Modules are collected (even if paths unresolved) | `filesModules.length >= 2` (ModuleA, ModuleB, ModuleC). |
| 31 | Library InfDsc has correct section properties | BaseLib's `sectionProperties.properties.length > 0`. |
| 32 | Module InfDsc preserves location | First module's location URI ends with `testDscProcess.dsc`. |

##### Grayout Ranges

| # | Test | Description |
|---|------|-------------|
| 33 | parsedDocuments has entry for processed document | Private `parsedDocuments` map contains an entry for the document's `fsPath`. |
| 34 | Grayout ranges exist for inactive conditional blocks | At least 1 grayout range from `!if FALSE` blocks. |

##### Comment Stripping

| # | Test | Description |
|---|------|-------------|
| 35 | stripComment removes line comments | `'DEFINE X = 1 # comment'` → `'DEFINE X = 1'`. |
| 36 | stripComment preserves hash inside quotes | `'DEFINE X = "value#with#hash"'` → unchanged. |
| 37 | stripComment trims whitespace | `'  some text  '` → `'some text'`. |
| 38 | stripComment returns empty for comment-only line | `'# just a comment'` → `''`. |

#### Suite: EdkWorkspace._doProccessWorkspace

Runs the full private `_doProccessWorkspace()` pipeline (reset state → open main DSC → process → populate `platformName` → find FDF).

##### Workspace Initialization

| # | Test | Description |
|---|------|-------------|
| 1 | platformName is populated from PLATFORM_NAME define | `platformName` is `'TestProcess'` after processing. |
| 2 | workInProgress is false after completion | Private `workInProgress` is `false`. |
| 3 | processComplete is true after completion | Private `processComplete` is `true`. |

##### State Reset

| # | Test | Description |
|---|------|-------------|
| 4 | Running again resets and re-processes | Second call returns `true` and `platformName` is still `'TestProcess'`. |
| 5 | Returns false if already in progress | Setting `workInProgress = true` causes the method to return `false`. |

##### Defines After Full Processing

| # | Test | Description |
|---|------|-------------|
| 6 | All defines from [Defines] section are available | Map has `PLATFORM_NAME`, `MY_FLAG`, `MY_PATH`. |
| 7 | Conditional defines are correctly resolved | `COND_TAKEN` is `'IfTrueValue'`, `COND_ELSE` is `'ElseValue'`. |
| 8 | replaceDefine works after processing | `replaceDefine('$(PLATFORM_NAME)')` returns `'TestProcess'`. |

##### PCDs After Full Processing

| # | Test | Description |
|---|------|-------------|
| 9 | PCDs are available after processing | `getPcds('gTestPkg')` has `size >= 3`. |

##### File Lists After Full Processing

| # | Test | Description |
|---|------|-------------|
| 10 | dscList contains the main document | At least 1 entry ending with `testDscProcess.dsc`. |
| 11 | Libraries are populated | `filesLibraries.length >= 2`. |
| 12 | Modules are populated | `filesModules.length >= 2`. |
| 13 | getFilesList aggregates all lists | Total `length >= 4` (DSC + libraries + modules). |

#### Suite: EdkWorkspace.proccessWorkspace

Tests the public `proccessWorkspace()` API which wraps `_doProccessWorkspace` with `vscode.window.withProgress`.

| # | Test | Description |
|---|------|-------------|
| 1 | proccessWorkspace runs without errors | Returns `true` and `platformName` is `'TestProcess'`. |
| 2 | proccessWorkspace populates defines and PCDs | `getDefinitions().size > 0` and `getAllPcds().size > 0`. |
