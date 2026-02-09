export const REGEX_DEFINE = /^\s*(?:DEFINE\s+\w+|(?:DSC_SPECIFICATION|PLATFORM_GUID|PLATFORM_VERSION|PLATFORM_NAME|SKUID_IDENTIFIER|SUPPORTED_ARCHITECTURES|BUILD_TARGETS|OUTPUT_DIRECTORY|FLASH_DEFINITION|BUILD_NUMBER|FIX_LOAD_TOP_MEMORY_ADDRESS|TIME_STAMP_FILE|RFC_LANGUAGES|ISO_LANGUAGES|VPD_TOOL_GUID|PCD_INFO_GENERATION|PCD_VAR_CHECK_GENERATION|PREBUILD|POSTBUILD))\s*=.*/gi;
export const REGEX_INCLUDE = /\s*\!include/gi;

export const REGEX_PATH_FILE = /(?<=^.*?\|\s*)[a-zA-Z\/\\0-9\._]+\.([a-z\d])/gi;
export const REGEX_PATH_FOLDER = /^\s*[a-zA-Z\/\\0-9\._]+/gi;

export const REGEX_LIBRARY_PATH = /(?<=^.*?\|\s*)[a-zA-Z\/\\0-9\._]+\.(.*)/gi;
export const REGEX_MODULE_PATH = /^[a-zA-Z\/\\0-9\._]+\.(inf)/gi;
export const REGEX_DSC_SECTION = /(?<=^\[\s*)[a-z\.,\s\d_]+(?=\])/gi;
export const REGEX_ANY_BUT_SECTION = /^(?!.*?\[).*/gi;
export const REGEX_PCD_LINE = /(?:^\w[\w\d\[\]]+\.)+[\w\d\[\]]+/gi;

export const REGEX_VAR_USAGE = /\$\(\s*.*?\s*\)/gi;

export const REGEX_GUID = /^\s*[a-z\d]+\s*=\s*\{\s*0x[a-f\d]{8}\s*,\s*0x[a-f\d]{4}\s*,\s*0x[a-f\d]{4}\s*,\s*\{\s*0x[a-f\d]{2}\s*,\s*0x[a-f\d]{2}\s*,\s*0x[a-f\d]{2}\s*,\s*0x[a-f\d]{2}\s*,\s*0x[a-f\d]{2}\s*,\s*0x[a-f\d]{2}\s*,\s*0x[a-f\d]{2}\s*,\s*0x[a-f\d]{2}\s*\}\s*}/gi;

export const REGEX_PCD = /(?:\w[\w\d\[\]]+\.)+[\w\d\[\]]+/gi;

export const REGEX_INF_SECTION = /(?<sectionType>.*?)(\.(?<arch>.*))?$/m;

