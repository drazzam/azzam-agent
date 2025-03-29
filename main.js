const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let config;
try {
  const configPath = path.join(__dirname, 'config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
  
  if (!config.apiKey) {
    throw new Error("API key is missing in config.json");
  }
  
  // Set default model if not specified
  if (!config.model) {
    config.model = "gemini-1.5-pro";
    console.log("Model not specified in config, using default:", config.model);
  }
} catch (err) {
  console.error("Error reading config:", err);
  app.quit();
}

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(config.apiKey);

let mainWindow;
let screenshots = [];
let multiPageMode = false;
let appIsActive = true; // Flag to track if app is actively intercepting input

function updateInstruction(instruction) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('update-instruction', instruction);
  }
}

function hideInstruction() {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('hide-instruction');
  }
}

async function captureScreenshot() {
  try {
    hideInstruction();
    mainWindow.hide();
    await new Promise(res => setTimeout(res, 200));

    const timestamp = Date.now();
    const imagePath = path.join(app.getPath('pictures'), `screenshot_${timestamp}.png`);
    await screenshot({ filename: imagePath });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    mainWindow.show();
    return { base64Image, imagePath };
  } catch (err) {
    mainWindow.show();
    if (mainWindow.webContents) {
      mainWindow.webContents.send('error', err.message);
    }
    throw err;
  }
}

async function processScreenshots() {
  try {
    // Get the Gemini model
    const model = genAI.getGenerativeModel({ model: config.model });
    
    // Create a new chat session
    const chat = model.startChat();
    
    // Prepare the prompt with text and images specifically for MCQ questions
    const prompt = `
    This is a multiple-choice question. Please:
    1. Identify the question being asked
    2. Analyze all available options
    3. Select the correct answer with high confidence
    4. Explain why this is the correct answer
    5. Format your response as:
       **Question:** [the question]
       **Correct Answer:** [option letter/number] - [the answer text]
       **Explanation:** [your explanation]
    `;
    
    // Create the content parts array with the initial text
    const parts = [{ text: prompt }];
    
    // Add all screenshots as inline images
    for (const screenshot of screenshots) {
      parts.push({
        inlineData: {
          data: screenshot.base64Image,
          mimeType: "image/png"
        }
      });
    }
    
    // Send the request to Gemini
    const result = await chat.sendMessage(parts);
    const response = await result.response;
    
    // Send the text to the renderer
    mainWindow.webContents.send('analysis-result', response.text());
  } catch (err) {
    console.error("Error in processScreenshots:", err);
    if (mainWindow.webContents) {
      mainWindow.webContents.send('error', err.message);
    }
  }
}

// Reset everything
function resetProcess() {
  screenshots = [];
  multiPageMode = false;
  mainWindow.webContents.send('clear-result');
  updateInstruction("Ctrl+Shift+S: Screenshot | Ctrl+Shift+A: Multi-mode");
}

function toggleAppInteractivity() {
  appIsActive = !appIsActive;
  if (appIsActive) {
    // Make app interactive
    mainWindow.setIgnoreMouseEvents(false);
    updateInstruction("App active: Ctrl+Shift+S: Screenshot | Ctrl+Shift+A: Multi-mode | Ctrl+Shift+I: Toggle interactivity");
  } else {
    // Make app pass-through (ignore mouse events)
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    updateInstruction("App inactive (click-through mode) | Ctrl+Shift+I: Toggle interactivity");
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    paintWhenInitiallyHidden: true,
    contentProtection: true,
    type: 'toolbar',
  });

  mainWindow.loadFile('index.html');
  mainWindow.setContentProtection(true);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  // Ctrl+Shift+S => single or final screenshot
  globalShortcut.register('CommandOrControl+Shift+S', async () => {
    try {
      const { base64Image, imagePath } = await captureScreenshot();
      screenshots.push({ base64Image, imagePath });
      await processScreenshots();
    } catch (error) {
      console.error("Ctrl+Shift+S error:", error);
    }
  });

  // Ctrl+Shift+A => multi-page mode
  globalShortcut.register('CommandOrControl+Shift+A', async () => {
    try {
      if (!multiPageMode) {
        multiPageMode = true;
        updateInstruction("Multi-mode: Ctrl+Shift+A to add, Ctrl+Shift+S to finalize");
      }
      const { base64Image, imagePath } = await captureScreenshot();
      screenshots.push({ base64Image, imagePath });
      updateInstruction("Multi-mode: Ctrl+Shift+A to add, Ctrl+Shift+S to finalize");
    } catch (error) {
      console.error("Ctrl+Shift+A error:", error);
    }
  });

  // Ctrl+Shift+R => reset
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    resetProcess();
  });
     
  // Ctrl+Shift+Q => Quit the application
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    console.log("Quitting application...");
    app.quit();
  });
  
  // Ctrl+Shift+I => Toggle interactivity (click-through mode)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    toggleAppInteractivity();
  });
  
  // Initialize app with click-through mode disabled by default (fully interactive)
  toggleAppInteractivity();
  
  // Set up IPC handlers for UI buttons
  ipcMain.on('toggle-interactive', toggleAppInteractivity);
  ipcMain.on('capture-screenshot', async () => {
    try {
      const { base64Image, imagePath } = await captureScreenshot();
      screenshots.push({ base64Image, imagePath });
      await processScreenshots();
    } catch (error) {
      console.error("Capture screenshot error:", error);
    }
  });
  ipcMain.on('reset-process', resetProcess);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
