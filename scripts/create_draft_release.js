const { execSync } = require('child_process');
const fs = require('fs');

// Check if gh CLI is installed
try {
    execSync('gh --version', { stdio: 'ignore' });
} catch (error) {
    console.error('gh CLI is not installed. Please install it first.');
    process.exit(1);
}

// Parse the version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Get the latest commit hash
const latestCommit = execSync('git rev-parse HEAD').toString().trim();

// Create a new draft release with the version name
execSync(`gh release create v${version} -t "v${version}" -n "Draft release for commit ${latestCommit}" --draft`, { stdio: 'inherit' });

// Print the URL to open the release page in the browser
const repoUrl = execSync('gh repo view --json url --jq ".url"').toString().trim();
console.log(`Release created. You can view it at: ${repoUrl}/releases/tag/v${version}`);
