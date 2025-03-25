#!/usr/bin/env node

console.log("\n🔍 Voxerion Calendar Setup Verification 🔍\n");

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check required files
console.log("Checking required files:");
const requiredFiles = [
  '.clasp.json',
  '.claspignore',
  'package.json',
  'README.md',
  'src/appsscript.json',
  'src/calendar.js',
  'src/DatabaseManager.js',
  'src/DatabaseUtilities.js'
];

let allFilesPresent = true;
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`- ${file}: ${exists ? '✅' : '❌'}`);
  if (!exists) allFilesPresent = false;
}

// Check .clasp.json for script ID
let claspConfigOk = false;
try {
  const claspConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.clasp.json'), 'utf8'));
  if (claspConfig.scriptId && claspConfig.rootDir === './src') {
    console.log(`\nClasp configuration: ✅`);
    console.log(`- Script ID: ${claspConfig.scriptId}`);
    console.log(`- Root directory: ${claspConfig.rootDir}`);
    claspConfigOk = true;
  } else {
    console.log(`\nClasp configuration: ❌ (Missing scriptId or incorrect rootDir)`);
  }
} catch (error) {
  console.log(`\nClasp configuration: ❌ (Error reading .clasp.json)`);
}

// Check Git setup
let gitSetupOk = false;
try {
  const gitRemote = execSync('git remote -v', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
  if (gitRemote.includes('github.com/alyssonfranklin/voxerion-calendar')) {
    console.log(`\nGit configuration: ✅`);
    console.log(`- Remote: ${gitRemote.split('\n')[0]}`);
    gitSetupOk = true;
  } else {
    console.log(`\nGit configuration: ❌ (Remote not properly configured)`);
    console.log(`- Current remote: ${gitRemote || 'none'}`);
  }
} catch (error) {
  console.log(`\nGit configuration: ❌ (Error checking Git setup)`);
}

// Overall status
console.log("\n📋 Overall Setup Status:");
if (allFilesPresent && claspConfigOk && gitSetupOk) {
  console.log("✅ Setup complete! Your project is ready for development.");
} else {
  console.log("❌ Setup incomplete. Please address the issues above.");
  
  if (!allFilesPresent) {
    console.log("- Missing required files. Run 'npm run pull' to get the latest code.");
  }
  
  if (!claspConfigOk) {
    console.log("- Clasp configuration issue. Check .clasp.json file.");
  }
  
  if (!gitSetupOk) {
    console.log("- Git setup issue. Run 'npm run github-connect' to connect to GitHub.");
  }
}

console.log("\n🚀 Next steps:");
console.log("1. Run 'npm run pull' to get the latest code from Google Apps Script");
console.log("2. Run 'npm run push' to push any local changes to Google Apps Script");
console.log("3. Run 'npm run dev' to start development mode (auto-push on save)");
console.log("4. Commit and push to GitHub with 'git add . && git commit -m \"your message\" && git push'");