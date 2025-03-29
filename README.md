# OA Coder (Gemini Version)

OA Coder is an Electron application that captures screenshots and leverages the Gemini API to analyze them. It can solve questions, generate code, or provide detailed answers based on screenshots. The app supports both single screenshot processing and multi-page mode for capturing multiple images before analysis.

## Features

- **Screenshot Capture:** Use global keyboard shortcuts to capture the screen.
- **Gemini AI Integration:** Send captured screenshots to Google's Gemini API for automated analysis.
- **Multi-Page Mode:** Combine multiple screenshots for questions spanning several pages.
- **Customizable UI:** Transparent, always-on-top window with an instruction banner and markdown-rendered responses.
- **Global Shortcuts:** Easily control the application using keyboard shortcuts.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A Google AI Studio API key for Gemini

## Installation

1. **Clone the repository:**

   ```
   git clone https://github.com/drazzam/oa-coder.git
   cd oa-coder
   ```
2. **Install the dependencies:**
   ```
   npm install
   ```
3. **Configure the application:**
   Create a config.json file in the project root with your Gemini API key and (optionally) your desired model. For example:
    ```
    {
      "apiKey": "YOUR_GEMINI_API_KEY",
      "model": "gemini-1.5-pro"
    }
    ```
  - Note: If the model field is omitted, the application defaults to "gemini-1.5-pro".


## Usage

1. **Start the Application:**
    Run the following command to launch OA Coder:
    ```
    npm start
    ```
2. **Global Keyboard Shortcuts:**

    - Ctrl+Shift+S: Capture a screenshot and process it immediately. In multi-page mode, this shortcut finalizes the session and sends all captured screenshots for processing.
    - Ctrl+Shift+A: Capture an additional screenshot in multi-page mode. The instruction banner will remind you of the mode and available shortcuts.
    - Ctrl+Shift+R: Reset the current process, clearing all captured screenshots and any displayed results.
    - Ctrl+Shift+Q: Close the running process, clearing all captured screenshot.


## Status

This program is still under development. Some features may not be fully implemented, and there might be bugs or incomplete functionality. Your feedback and contributions are welcome as we work towards a more stable release.

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and paste it into your config.json file

## Differences from OpenAI Version

This version uses Google's Gemini API instead of OpenAI's API. The functionality remains similar, but there might be slight differences in response formatting or capabilities based on the underlying model.
