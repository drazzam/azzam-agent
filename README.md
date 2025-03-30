# Azzam Agent

Azzam Agent is an advanced desktop application that captures screenshots and uses AI to provide intelligent analysis of any content. The app features cutting-edge privacy and stealth technology to ensure your activities remain completely private.

## Features

- **Intelligent Content Analysis:** Captures screenshots and uses Gemini AI to analyze any type of content
- **Universal Assistance:** Unlike MCQ-specific solvers, Azzam Agent can help with any type of question or task
- **Ultra Stealth Mode:** Makes the application invisible to screen recording software
- **Keyboard Protection:** Prevents keystroke logging of shortcuts used within the app
- **Screen Capture Privacy:** Takes screenshots without triggering standard OS screenshot events
- **Anti-Detection:** Hidden from other applications using advanced techniques
- **Click-Through Mode:** Interact with content underneath the app without interference
- **Private Screenshot Saving:** Capture and save images discreetly with specialized shortcuts

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A Google AI Studio API key for Gemini
- Windows, macOS, or Linux operating system

## Installation

1. **Clone the repository:**

   ```
   git clone https://github.com/drazzam/azzam-agent.git
   cd azzam-agent
   ```

2. **Install the dependencies:**
   ```
   npm install
   ```
   
   This will also run the electron-rebuild process to compile native modules.

3. **Configure the application:**
   Create a config.json file in the project root with your Gemini API key:
    ```json
    {
      "apiKey": "YOUR_GEMINI_API_KEY",
      "model": "gemini-1.5-pro",
      "security": {
        "ultraStealthMode": true,
        "privacyMode": true,
        "preventKeyLogging": true,
        "hideFromScreenCapture": true
      }
    }
    ```

## Usage

1. **Start the Application:**
    Run the following command to launch Azzam Agent:
    ```
    npm start
    ```

2. **Controls:**

    **Keyboard Shortcuts:**
    - `Ctrl+Shift+S`: Capture a screenshot and analyze it immediately
    - `Ctrl+Shift+A`: Capture an additional screenshot in multi-page mode
    - `Ctrl+Shift+R`: Reset the current process, clearing all captured screenshots and results
    - `Ctrl+Shift+I`: Toggle click-through mode (interact with content underneath)
    - `Ctrl+Shift+P`: Toggle privacy mode
    - `Ctrl+Shift+U`: Toggle ultra stealth mode (invisible to screen recording)
    - `Ctrl+Shift+D`: Save the current screenshot to disk privately
    - `Ctrl+Shift+Q`: Close the application
    
    **On-Screen Buttons:**
    - `U`: Toggle ultra stealth mode
    - `P`: Toggle privacy mode
    - `I`: Toggle click-through mode
    - `S`: Capture screenshot
    - `D`: Save screenshot to disk
    - `R`: Reset the process

## Understanding the Stealth Technology

Azzam Agent employs several advanced techniques to maximize privacy:

### 1. Ultra Stealth Mode

When ultra stealth mode is active, the application:
- Uses specialized window rendering techniques that bypass standard screen recording
- On Windows, uses `SetWindowDisplayAffinity` API (when available) to prevent capture
- Manipulates window layering to remain invisible to recording software
- Creates a secondary overlay window for handling displays that might resist the main technique

### 2. Advanced Privacy Mode

When privacy mode is active, the app:
- Hides itself from the Windows taskbar
- Uses a randomized window title that changes each session
- Prevents keystroke logging by intercepting keyboard events
- Uses temporary storage with random names for processing images
- Cleans up all temporary files on exit
- Maintains a slightly transparent window to be less noticeable

### 3. Anti-Detection Features

Azzam Agent uses several methods to avoid detection:
- Monitors for screen recording or analysis software and enhances stealth automatically
- Uses low-level screen capture that bypasses standard OS events
- Implements window techniques that make it difficult to detect the application's presence
- Prevents normal detection methods like task list enumeration

## Notes on Technology Limitations

- The stealth techniques work best on Windows systems due to the availability of certain APIs
- Some anti-virus software might flag the low-level screen capture techniques
- Ultra stealth mode may not be 100% effective against all recording software, especially those with kernel-level access
- Performance may vary depending on your system hardware

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and paste it into your config.json file
