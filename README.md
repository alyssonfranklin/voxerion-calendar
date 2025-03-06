# Voxerion Calendar Insights

A Google Apps Script application that integrates with Google Calendar to provide AI-powered meeting insights using OpenAI's API.

## Features

- Integrates with Google Calendar to provide context for meetings
- Generates AI-powered insights using OpenAI Assistants API
- Manages user access and company data
- Provides an intuitive add-on interface in Google Calendar

## Project Structure

```
voxerion-calendar/
├── src/                        # Source code for Google Apps Script
│   ├── appsscript.json         # Apps Script manifest
│   ├── calendar.js             # Main calendar and AI interaction logic
│   ├── DatabaseManager.js      # Database management functions
│   └── DatabaseUtilities.js    # Database utility functions
├── .clasp.json                 # Clasp configuration with scriptId
├── .gitignore                  # Git ignore file
├── README.md                   # Project documentation
└── package.json                # NPM package configuration
```

## Setup

### Prerequisites

1. [Node.js](https://nodejs.org/) installed
2. [Google Clasp](https://github.com/google/clasp) installed globally:

```bash
npm install -g @google/clasp
```

3. Enable the Google Apps Script API in your Google account:
   - Visit [Google Apps Script API settings](https://script.google.com/home/usersettings)
   - Set "Google Apps Script API" to "ON"

### Connection to Existing Project

This repository is connected to the "Voxerion" Google Apps Script project. To work with it:

1. Clone this repository:

```bash
git clone https://github.com/yourusername/voxerion-calendar.git
cd voxerion-calendar
```

2. Install dependencies:

```bash
npm install
```

3. Log in to Google with Clasp:

```bash
npm run login
```

4. Pull the latest changes from Google Apps Script:

```bash
npm run pull
```

## Development Workflow

### Synchronizing with Google Apps Script

#### Pulling changes from Google Apps Script:

```bash
npm run pull
```

#### Pushing changes to Google Apps Script:

```bash
npm run push
```

#### Watch for local changes and automatically push:

```bash
npm run watch
```

#### Open the project in the Google Apps Script editor:

```bash
npm run open
```

### Git and Google Apps Script Integration

To maintain both Git and Google Apps Script in sync:

1. Pull changes from Google Apps Script:
```bash
npm run pull
```

2. Make your changes locally

3. Push changes to Google Apps Script:
```bash
npm run push
```

4. Commit and push to Git:
```bash
git add .
git commit -m "Your descriptive commit message"
git push
```

For a simplified workflow that pulls from Google Apps Script and stages changes for Git:
```bash
npm run sync
```

## Deployment

To create a versioned deployment:

```bash
npm run deploy
```

To check the status of your Google Apps Script project:

```bash
npm run status
```

To see all versions:

```bash
npm run versions
```

## License

MIT License