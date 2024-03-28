# Change Log


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
