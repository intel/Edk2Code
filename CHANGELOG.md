# Change Log

## [2.1.0]

### Security
- **MCP server hardening:**
  - The MCP SSE server now binds to `127.0.0.1` instead of all network interfaces, so it is no longer reachable from other hosts on the LAN. 🔒
  - Requests with non-loopback `Host`/`Origin` headers are rejected, defeating DNS rebinding attacks from malicious web pages. 🛡️
  - `/sse` and `/messages` require an `Authorization: Bearer <token>` header. The 32-byte random token is stored in VS Code SecretStorage and compared using `timingSafeEqual`. 🔑
  - A **Copy Access Token** action is offered when the server starts. 📋
  - Auto configuration writes `.vscode/mcp.json` with the loopback URL and an `Authorization` header sourced from a password input, so the token is never written to disk. 🗝️

### Enhancements
- **Build:**
  - Reworked the EDK2 build command and build form for more reliable module and workspace builds. 🛠️
  - Removed the `edk2code.buildToolchain` setting; the toolchain is now resolved from the build configuration. 🧹
  - Updated build command icons to `$(build)`. 🎨
- **Workspace configuration:**
  - Improvements to the workspace settings panel and configuration handling. ⚙️
- **Branding:**
  - Updated extension icon. 🖼️

### Miscellaneous
- **Version Update:**
  - Updated version in `package.json` from `2.0.1` to `2.1.0`. 🚀🆙

## [1.0.8]

### Enhancements
- **JSON Configuration & Syntax:**
  - Added new keyword pairs: `warningif`, `inconsistentif`, `disableif`, `nosubmitif` to `edk2_vfr.conf.json` and `edk2_vfr.tmLanguage.json` for improved syntax highlighting and language support. 🆕✨

### Bug Fixes
- **Typographical Errors:**
  - Corrected misspelled words: `seeting` to `setting` and `Generationg` to `Generating`. 📝🛠️
  - Fixed a typo in the message: "c_cpp_properties.json points to wrong compile_commands.json". 📝🔧

### Features
- **New Commands:**
  - Introduced `edk2code.copyTreeData` command to copy tree data to clipboard in a formatted string. 📋🌳
- **Clangd Support:**
  - Added support for Clang compile commands in the workspace configuration. 🛠️🔧
    - Automatically updates `clangd` configuration with the correct `--compile-commands-dir` argument if `vscode-clangd` extension is installed. 🆕🔄

### Code Quality
- **Refactoring & Cleanup:**
  - Improved code readability by trimming redundant spaces and unifying function behavior. 🧼🛠️
  - Renamed `edksymbol.ts` to `edkSymbols.ts` for consistency. 📂🗂️

### Miscellaneous
- **Version Update:**
  - Updated version in `package.json` from `1.0.7` to `1.0.8`. 🚀🆙


All notable changes to the "edk2code" extension will be documented in this file.
## [1.0.7]

Improvements in error handling, diagnostics, and configuration management, alongside minor updates and bug fixes.
  
### Introduction of diagnostics.ts:
DiagnosticManager class and an enumeration for EDK diagnostic codes. This class manages diagnostic messages (warnings and errors) related to the EDK2 codebase.

## [1.0.1]
- Fixed continues request to re-scan for index changes

## [1.0.0]

Mayor refactor to integrate optimizations
- Created specific `.edkfolder` for workspace settings.html
- Created own configuration page for workspace
- Improved autocomplete on inf files
- Improved EDK parser methods
- Removed unused code
- Added new goto commands


## [0.0.5]
- Fixed pattern on buildDefines configuration. This made some of the configuration options disappear

## [0.0.4]

### Added

- Click on status bar now shows help of current actions
- Just EDK2 files show warnings about not being used in compilation
- Inactive symbols work with goto definition commands

## [0.0.3]

### Fixed

Corrected problems that prevented the extension to run on Linux systems

## [0.0.2]

### Changed

- Hide unusual commands when running in not indexed mode

### Added

- Use ripgrep when running in not indexed mode

## [0.0.1]

- Initial release.
