#!/usr/bin/env node

console.log("\n📅 Voxerion Calendar Project Setup 📅\n");
console.log("This script will help you set up the Voxerion Calendar project.\n");

// Check Node.js version
const nodeVersion = process.version;
console.log(`Node.js version: ${nodeVersion}`);

// List required steps
console.log("\n📋 Setup checklist:");
console.log("1. Enable Google Apps Script API at https://script.google.com/home/usersettings");
console.log("2. Install project dependencies with 'npm install'");
console.log("3. Log in to Google with 'npm run login'");
console.log("4. Pull the latest code with 'npm run pull'");
console.log("5. Make changes to the code locally");
console.log("6. Push changes to Google Apps Script with 'npm run push'");
console.log("7. Initialize Git repository with 'npm run git-init'");
console.log("8. Connect to GitHub with 'npm run github-connect'");
console.log("9. Push to GitHub with 'npm run github-push'");

console.log("\n⚠️ Troubleshooting common issues:");
console.log("- If 'npm run pull' fails, make sure you've enabled the Google Apps Script API");
console.log("- If 'clasp' command not found, install it globally with 'npm install -g @google/clasp'");
console.log("- If you get authentication errors, run 'clasp login' again");
console.log("- If files aren't being pushed/pulled correctly, check your .clasp.json and .claspignore files");

console.log("\n🚀 For active development, use 'npm run dev' to automatically push changes\n");