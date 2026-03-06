# Symbols

This folder contains the symbol type system used by the EDK II parser. Each language (DSC, INF, DEC, FDF, ASL, VFR) has its own symbol file, plus shared infrastructure.

## File Overview

| File | Purpose |
|---|---|
| `symbolsType.ts` | Enum of all symbol types + string mapping |
| `edkSymbols.ts` | Abstract base class `EdkSymbol` |
| `symbolFactory.ts` | Factory that instantiates the correct symbol class from a type |
| `dscSymbols.ts` | DSC-specific symbol classes |
| `infSymbols.ts` | INF-specific symbol classes |
| `decSymbols.ts` | DEC-specific symbol classes |
| `fdfSymbols.ts` | FDF-specific symbol classes |
| `aslSymbols.ts` | ASL-specific symbol classes |
| `vfrSymbols.ts` | VFR-specific symbol classes |
| `commonSymbols.ts` | Shared symbol classes (conditions, unknown) |

---

## How to Add a New Symbol Type

Adding a new symbol requires changes in **four places**. The example below follows the addition of `dscComponentSubSection` and `dscBuildOption` for DSC component scoped sub-elements (`<LibraryClasses>`, `<Pcd*>`, `<BuildOptions>`).

### 1. Add the type to `symbolsType.ts`

Add the new enum value to `Edk2SymbolType` and a corresponding entry in `typeToStr`:

```typescript
// symbolsType.ts
export enum Edk2SymbolType {
    // ...
    dscSection,
    dscComponentSubSection,   // <-- new
    dscPcdDefinition,
    dscBuildOption,           // <-- new
    // ...
}

export var typeToStr: Map<Edk2SymbolType, string> = new Map([
    // ...
    [Edk2SymbolType.dscComponentSubSection, "dscComponentSubSection"],
    [Edk2SymbolType.dscBuildOption, "dscBuildOption"],
    // ...
]);
```

### 2. Create the symbol class in the appropriate `*Symbols.ts` file

Extend `EdkSymbol` and set at minimum `type` and `kind`. Implement `onDefinition`, `onCompletion`, etc. if the symbol needs navigation or hover support.

```typescript
// dscSymbols.ts
export class EdkSymbolDscComponentSubSection extends EdkSymbol {
    type = Edk2SymbolType.dscComponentSubSection;
    kind = vscode.SymbolKind.Namespace;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolDscBuildOption extends EdkSymbol {
    type = Edk2SymbolType.dscBuildOption;
    kind = vscode.SymbolKind.Property;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
```

Optionally override `nameRegex` (defined on the base `EdkSymbol`) to extract a cleaner display name from the raw text line:

```typescript
// Example from EdkSymbolDscModuleDefinition
protected get nameRegex(): RegExp { return /^\s*([\w/.\\-]+\.inf)/i; }
```

When `nameRegex` is set, the constructor uses the first capture group (or the full match) as `this.name` instead of the raw text line.

### 3. Register the type in `symbolFactory.ts`

Import the new class and add a `case` to `produceSymbol()`:

```typescript
// symbolFactory.ts
import { /* existing */, EdkSymbolDscComponentSubSection, EdkSymbolDscBuildOption } from "./dscSymbols";

produceSymbol(type: Edk2SymbolType, textLine: string, location: vscode.Location, parser: DocumentParser) {
    switch (type) {
        // ...
        case Edk2SymbolType.dscComponentSubSection:
            return new EdkSymbolDscComponentSubSection(textLine, location, true, true, parser);
        case Edk2SymbolType.dscBuildOption:
            return new EdkSymbolDscBuildOption(textLine, location, true, true, parser);
        // ...
    }
}
```

### 4. Add a `BlockParser` in the relevant parser file

In `src/edkParser/`, create a `BlockParser` subclass that sets `type` to the new enum value and define `tag` / `end` / `context` as needed. Then add it to the `context` array of the parent block.

```typescript
// dscParser.ts
class BlockBuildOption extends BlockParser {
    name = "BuildOption";
    tag = /^[\w\*\:\|]+\s*=\s*.*/gi;
    start = undefined;
    end = undefined;
    type = Edk2SymbolType.dscBuildOption;
    visible: boolean = true;
}

class BlockComponentSubBuildOptions extends BlockParser {
    name = "ComponentBuildOptions";
    tag = /^<\s*BuildOptions\s*>/gi;
    start = undefined;
    end = /(^<)|(^\})/gi;
    type = Edk2SymbolType.dscComponentSubSection;
    visible: boolean = true;
    context: BlockParser[] = [
        new BlockBuildOption(),
        new BlockIncludes(),
    ];
}

// Wire into the parent block's context:
class BlockComponentInf extends BlockParser {
    // ...
    context: BlockParser[] = [
        new BlockComponentSubBuildOptions(),
        // ...
    ];
}
```

---

## `EdkSymbol` base class

All symbol classes extend `EdkSymbol` (defined in `edkSymbols.ts`), which itself extends `vscode.DocumentSymbol`. Key members:

| Member | Description |
|---|---|
| `type` | The `Edk2SymbolType` enum value |
| `kind` | The `vscode.SymbolKind` used for the outline/breadcrumb icon |
| `textLine` | The raw source line (with defines resolved via `parser.defines`) |
| `location` | `vscode.Location` (URI + range) |
| `sectionProperties` | Inherited from the parent symbol's section context |
| `nameRegex` | Optional getter; when set, extracts the symbol's display name from `textLine` |
| `onDefinition` | Async function returning locations for go-to-definition |
| `onCompletion` | Async function returning completion items |
| `onHover` | Async function returning hover content |
| `onDeclaration` | Async function returning declaration locations |
