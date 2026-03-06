# EDK II Language Parser

This folder implements a recursive-descent, line-oriented parser that transforms EDK II source files (`.dsc`, `.inf`, `.dec`, `.fdf`, `.vfr`, `.asl`) into a tree of `EdkSymbol` objects used for navigation, outline views, and diagnostics throughout the extension.

## Architecture Overview

```
                    ParserFactory
                         |
              selects by languageId
                         |
       ┌─────────┬──────┴──────┬──────────┐
    DscParser  InfParser  DecParser  FdfParser ...
       │
  (extends DocumentParser)
       │
  blockParsers: BlockParser[]   ← top-level parsers
       │
       └─ each BlockParser has
            tag / start / end   ← regex rules
            context: BlockParser[]  ← nested parsers
```

### Key classes

| Class | File | Role |
|---|---|---|
| `BlockParser` | `languageParser.ts` | Abstract block parser — matches, opens, and closes blocks using regex rules |
| `DocumentParser` | `languageParser.ts` | Base class for all language parsers — drives the line-by-line loop and manages the symbol tree/stack |
| `ParserFactory` | `parserFactory.ts` | Instantiates the correct `DocumentParser` subclass by VS Code `languageId` |
| `DscParser`, `InfParser`, etc. | `dscParser.ts`, `infParser.ts`, etc. | Concrete parsers that define `blockParsers`, comment syntax, and language-specific state |

---

## Parsing Lifecycle

### 1. Entry point — `parseFile()`

```
DocumentParser.parseFile()
  ┌─────────────────────────────────────┐
  │ for each line in the document:      │
  │   skip comment lines                │
  │   call parseLine()                  │
  │   increment lineIndex               │
  └─────────────────────────────────────┘
```

`parseFile()` iterates from line 1 to the end of the document. For every non-comment line it calls `parseLine()`.

### 2. Top-level dispatch — `parseLine()`

```typescript
async parseLine() {
    for (parseIndex = 0 .. blockParsers.length) {
        decrementLineIndex();          // rewind so block.parse() can re-read
        result = blockParsers[parseIndex].parse(this);
        if (result) {
            // If the block consumed multiple lines (has start/end), reset
            // parseIndex to -1 so parsing continues from the first parser
            // on the new current line.
            // If the block is root-only or single-line, just continue
            // trying the next parser on the same line.
        }
    }
}
```

Each `BlockParser` in `blockParsers` is tried in order. When a parser matches and it is a multi-line block (has `start`/`end`), `parseIndex` resets to `-1` so the next line is evaluated again from the first parser. Single-line or root-only parsers let the loop continue without resetting.

---

## BlockParser — Start, Content, and End

The core parsing logic lives in `BlockParser.parse()`. A block parser is configured by four regex properties and a list of child parsers:

| Property | Required | Purpose |
|---|---|---|
| `tag` | **yes** | Regex the current line must match for this block to activate |
| `excludeTag` | no | If the line matches this regex, the block is skipped even if `tag` matches |
| `start` | no | Regex marking the beginning of the block's body (e.g. `{`) |
| `end` | no | Regex marking the end of the block (e.g. `}` or `[`) |
| `context` | no | Child `BlockParser[]` that will be tried on every line inside the block body |

### Three block shapes

The combination of `start` and `end` determines how a block behaves:

#### Single-line block (`start = undefined`, `end = undefined`)

```
  tag matches → create symbol → pop immediately → return true
```

The block matches exactly one line. The symbol is created and immediately finalized. Examples: `BlockDefinition`, `BlocklibraryDef`, `BlockPcd`, `BlockBuildOption`.

#### Section block (`start = undefined`, `end = /regex/`)

```
  tag matches → create symbol → push onto stack
  for each subsequent line:
      try context[] child parsers
      if line matches end → pop symbol → return true
  EOF → pop symbol → return true
```

The block begins at the `tag` line and continues until a line matches `end`. Every line inside the block is tested against `context[]` child parsers. Examples: `BlockComponentsSection` (ends at `^\[`), `BlockComponentSubLibraryClasses` (ends at `^<` or `^\}`).

#### Delimited block (`start = /regex/`, `end = /regex/`)

```
  tag matches → create symbol → push onto stack
  scan forward until a line matches start (e.g. "{")
      (if end is hit first, pop and return early)
  then for each subsequent line:
      try context[] child parsers
      if line matches end → pop symbol → return true
  EOF → pop symbol → return true
```

After the tag line matches, the parser scans forward looking for the `start` delimiter before entering the content loop. This handles constructs where the opening brace may appear on the same line as the tag or on a subsequent line. Example: `BlockComponentInf` (tag matches `*.inf`, start matches `{`, end matches `}` or `[`).

### Flowchart

```
parse(docParser)
    │
    ├─ read line, check tag/excludeTag
    │   └─ no match → return false
    │
    ├─ check isRoot constraint
    │
    ├─ create EdkSymbol via SymbolFactory
    │   └─ addSymbol() + pushSymbolStack()
    │
    ├─ if start is defined:
    │   │   scan lines until start matches
    │   │   (if end matches first → popSymbolStack, return true)
    │   │
    │   └─ fall through to content loop ↓
    │
    ├─ else if end is undefined:
    │   └─ single-line: popSymbolStack → return true
    │
    ├─ else: fall through to content loop ↓
    │
    ├─ CONTENT LOOP: while hasPendingLines()
    │   │
    │   ├─ read next line (skip empty)
    │   │
    │   ├─ for each child in context[]:
    │   │   │  decrement lineIndex (rewind)
    │   │   │  child.parse(docParser)  ← recursive
    │   │   │  if matched and exclusive → break
    │   │   │
    │   │
    │   └─ if line matches end → popSymbolStack → return true
    │
    └─ EOF reached → popSymbolStack → return true
```

---

## How Symbols Are Added

### Symbol creation

When a `BlockParser`'s `tag` matches, a symbol is created through this sequence:

1. **Range** — An initial range is created from the matched line's start to the end of the document (a placeholder that gets narrowed later).
2. **SymbolFactory** — `symbolFactory.produceSymbol(type, textLine, location, parser)` instantiates the specific `EdkSymbol` subclass based on the `Edk2SymbolType` enum.
3. **addSymbol()** — The symbol is placed into the tree:
   - If `symbolStack` is empty → pushed to `symbolsTree` (root level).
   - Otherwise → added as a `child` of the current top-of-stack symbol, and `parent` is set.
   - In all cases, also appended to the flat `symbolsList`.
4. **pushSymbolStack()** — The symbol is pushed onto the stack to become the current parent for any nested symbols.

### Symbol finalization

When the block ends (either by matching `end`, reaching EOF, or being a single-line block), `popSymbolStack()` is called:

- The symbol is popped from the stack.
- Its **range is narrowed**: the end position is adjusted from the initial "rest of document" placeholder to the actual last line the block covered.
  - If the symbol has children → end is set to `lineIndex - 2` (the line before the end delimiter).
  - If no children → end is set to `lineIndex - 1` (the tag line itself for single-line blocks).

### Tree structure

After parsing, `DocumentParser` holds two views of the symbols:

| Collection | Type | Description |
|---|---|---|
| `symbolsTree` | `EdkSymbol[]` | Hierarchical tree — only root-level symbols; children are nested via `symbol.children` |
| `symbolsList` | `EdkSymbol[]` | Flat list — every symbol in document order, for fast iteration and filtering |

The tree structure corresponds directly to block nesting. For example, parsing a DSC `[Components]` section produces:

```
EdkSymbolDscSection  "Components.X64"
  ├─ EdkSymbolDscModuleDefinition  "Module.inf"
  │   ├─ EdkSymbolDscComponentSubSection  "<LibraryClasses>"
  │   │   └─ EdkSymbolDscLibraryDefinition  "Lib|Path.inf"
  │   ├─ EdkSymbolDscComponentSubSection  "<PcdsFixedAtBuild>"
  │   │   └─ EdkSymbolDscPcdDefinition  "gPkg.PcdName|value"
  │   └─ EdkSymbolDscComponentSubSection  "<BuildOptions>"
  │       └─ EdkSymbolDscBuildOption  "MSFT:*_*_*_CC_FLAGS = /D FLAG"
  └─ EdkSymbolDscModuleDefinition  "Other.inf"
```

---

## Root-only parsers (`isRoot = true`)

Some parsers are registered twice in `blockParsers`:

```typescript
blockParsers: BlockParser[] = [
    new BlockComponentsSection(),      // normal: matches inside any context
    // ...
    new BlockComponentInf(true),       // isRoot: only matches at the document root
];
```

When `isRoot` is `true`, the parser only activates when `symbolStack` is empty (i.e. no parent block is open). This allows a block to act as a "catch-all" for lines that appear outside any section, ensuring they still get a symbol without interfering with the normal section hierarchy.

---

## `startContext` / `endContext` — alternate end delimiter

Some EDK II constructs use a delimiter that appears *on the same line as the tag* to enter a special sub-block, and that sub-block requires a different `end` pattern than the surrounding block. `startContext` and `endContext` handle this case without needing a separate `BlockParser`.

| Property | Type | Purpose |
|---|---|---|
| `startContext` | `RegExp \| undefined` | If this pattern matches the tag line (or any line scanned while looking for `start`), the block switches to `endContext` as its terminator |
| `endContext` | `RegExp \| undefined` | Alternative `end` regex used only when `startContext` was matched |

### How it works

1. After the `tag` matches and the symbol is created, the parser checks whether the tag line also matches `startContext`. If so, `inContext = true`.
2. While scanning forward looking for `start`, each scanned line is also tested against `startContext`.
3. Once the content loop begins, `activeEnd` is resolved:
   - `inContext && endContext` → `activeEnd = endContext`
   - otherwise → `activeEnd = end`
4. Additionally, after a child context parser consumes a line, the **last consumed line** is peeked and tested against `endContext`. This handles the case where the child parser itself consumed the closing delimiter.

### Example — `BlockComponentInf`

`BlockComponentInf` matches `*.inf` lines. A component entry can optionally have an opening brace `{` on the same (or next) line, introducing a sub-block with scoped overrides. Without `startContext`/`endContext`, both `{...}` and bare entries would need separate parsers.

```typescript
class BlockComponentInf extends BlockParser {
    tag       = /^[\s\.\w\$\(\)_\-\\\/]*\.inf/gi;
    start     = /.*?{/;               // look for the opening brace
    end       = /(^\})|(^\[)|(\.inf)|(^\!include)/gi;  // bare-entry terminators
    startContext = /\{/;              // brace on the tag/start line → enter context mode
    endContext   = /^\s*\}/gi;        // context mode ends only on closing brace
    // ...
}
```

When `{` is found, `inContext` becomes `true` and `endContext` (`^\s*\}`) takes over from `end`, so only a closing brace terminates the sub-block. When `{` is absent, `end` applies as usual and the entry is treated as a single-line construct.

---

## `exclusive` flag

When a child parser in `context[]` matches a line and `exclusive` is `true` (the default), no further child parsers are tried for that line. Setting `exclusive = false` would allow multiple child parsers to process the same line.

---

## Comment handling

Each `DocumentParser` subclass defines its comment syntax:

```typescript
commentStart: string = "/*";   // block comment open
commentEnd: string = "*/";     // block comment close
commentLine: string[] = ["#"]; // line comment prefixes
```

`removeComment()` strips line comments and tracks block comment state via the `inComment` flag. Lines that are entirely comments are skipped by `parseFile()` before calling `parseLine()`.

---

## File Overview

| File | Purpose |
|---|---|
| `languageParser.ts` | `BlockParser` + `DocumentParser` base classes |
| `parserFactory.ts` | Factory that instantiates the correct parser by `languageId` |
| `commonParser.ts` | Shared regex constants used across language parsers |
| `dscParser.ts` | DSC file parser (sections, components, library classes, PCDs, build options) |
| `infParser.ts` | INF module file parser |
| `decParser.ts` | DEC package declaration parser |
| `fdfParser.ts` | FDF flash description parser |
| `vfrParser.ts` | VFR visual forms parser |
| `aslParser.ts` | ASL/ACPI source parser |
