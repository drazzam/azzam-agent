# OA Coder (MCQ Solver Edition)

OA Coder is an Electron application that captures screenshots and leverages the Gemini API to analyze them. This version is specialized for solving multiple-choice questions (MCQs) from screenshots. It can identify the question, analyze options, and select the correct answer with explanations. The app supports both single screenshot processing and multi-page mode for capturing multiple images before analysis.

## Features

- **MCQ Solver:** Specialized for identifying and solving multiple-choice questions.
- **Screenshot Capture:** Use global keyboard shortcuts or UI buttons to capture the screen.
- **Gemini AI Integration:** Send captured screenshots to Google's Gemini API for automated analysis.
- **Multi-Page Mode:** Combine multiple screenshots for questions spanning several pages.
- **Click-Through Mode:** Toggle between interactive and click-through modes to interact with content underneath the app.
- **Customizable UI:** Transparent, always-on-top window with an instruction banner and specially formatted MCQ responses.
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
2. **Controls:**

    **Keyboard Shortcuts:**
    - Ctrl+Shift+S: Capture a screenshot and process it immediately. In multi-page mode, this shortcut finalizes the session and sends all captured screenshots for processing.
    - Ctrl+Shift+A: Capture an additional screenshot in multi-page mode. The instruction banner will remind you of the mode and available shortcuts.
    - Ctrl+Shift+R: Reset the current process, clearing all captured screenshots and any displayed results.
    - Ctrl+Shift+I: Toggle click-through mode, allowing you to interact with content underneath the app.
    - Ctrl+Shift+Q: Close the running process, clearing all captured screenshots.
    
    **On-Screen Buttons:**
    - S: Capture screenshot
    - R: Reset the process
    - I: Toggle click-through mode


## Status

This program is still under development. Some features may not be fully implemented, and there might be bugs or incomplete functionality. Your feedback and contributions are welcome as we work towards a more stable release.

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and paste it into your config.json file

## Differences from Original Version

This version has several key differences from the original OA Coder:

1. **Gemini API Integration:** Uses Google's Gemini API instead of OpenAI's API
2. **MCQ Specialization:** Optimized for solving multiple-choice questions rather than coding problems
3. **Click-Through Mode:** Added the ability to toggle between interactive and click-through modes to solve the scrolling/clicking issues
4. **UI Improvements:** 
   - Added on-screen buttons for easier control
   - Enhanced result display with MCQ-specific formatting
   - Fixed scrolling issues in the response overlay
5. **Better Web Page Interaction:** You can now toggle the app to be non-interactive, allowing you to scroll and click on web pages underneath
