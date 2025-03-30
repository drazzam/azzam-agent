const { app, BrowserWindow, globalShortcut, ipcMain, screen, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Need to use the lower-level module for stealth screenshots
const robotjs = require('robotjs');
// For saving the images without triggering events
const crypto = require('crypto');

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
let privacyMode = true; // Flag for advanced privacy features
let picturesDir = app.getPath('pictures');
let appExePath = app.getPath('exe');

// Random hash for the window name to avoid detection
const windowNameHash = crypto.randomBytes(8).toString('hex');

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

// Stealth screenshot method - bypasses standard screenshot APIs
async function captureStealthScreenshot() {
  try {
    hideInstruction();
    // Hide the window completely before taking screenshot
    mainWindow.hide();
    await new Promise(res => setTimeout(res, 200));

    // Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    // Use robotjs to capture screen - it operates at a lower level than standard methods
    const bitmap = robotjs.screen.capture(0, 0, width, height);
    
    // Generate a secure, random filename
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const filePath = path.join(
      app.getPath('temp'), // Use temp directory to avoid detection
      `data_${timestamp}_${randomSuffix}.tmp` // Use misleading extension
    );
    
    // Convert the bitmap to PNG buffer
    const imageBuffer = await convertBitmapToPng(bitmap, width, height);
    
    // Write the file without using standard image formats in the file name
    fs.writeFileSync(filePath, imageBuffer);
    
    // Read it back and convert to base64
    const base64Image = fs.readFileSync(filePath).toString('base64');
    
    // Cleanup temp file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error("Error cleaning up temp file:", e);
    }

    mainWindow.show();
    return { base64Image, imagePath: filePath };
  } catch (err) {
    mainWindow.show();
    if (mainWindow.webContents) {
      mainWindow.webContents.send('error', err.message);
    }
    throw err;
  }
}

// Helper function to convert robotjs bitmap to PNG buffer
function convertBitmapToPng(bitmap, width, height) {
  return new Promise((resolve) => {
    // Create imageData from bitmap
    const imageData = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const pos = y * bitmap.byteWidth + x * bitmap.bytesPerPixel;
        
        imageData[idx] = bitmap.image[pos + 2]; // R
        imageData[idx + 1] = bitmap.image[pos + 1]; // G
        imageData[idx + 2] = bitmap.image[pos]; // B
        imageData[idx + 3] = 255; // Alpha
      }
    }
    
    // Convert to PNG using electron's nativeImage
    const image = nativeImage.createFromBitmap(imageData, { width, height });
    resolve(image.toPNG());
  });
}

// Save a screenshot to disk with a custom shortcut
async function saveScreenshotToDisk() {
  try {
    // Use stealth method to capture
    hideInstruction();
    const { base64Image } = await captureStealthScreenshot();
    
    // Generate randomized filename to avoid detection patterns
    const timestamp = Date.now();
    const randomValue = Math.floor(Math.random() * 10000);
    const filename = `image_${timestamp}_${randomValue}.png`;
    
    // Get user's pictures directory but with a subdirectory to be less obvious
    const savePath = path.join(picturesDir, 'data', filename);
    
    // Ensure directory exists
    const dirPath = path.dirname(savePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Save the file
    const imageBuffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(savePath, imageBuffer);
    
    // Notify user
    mainWindow.webContents.send('show-notification', `Screenshot saved to ${savePath}`);
    return savePath;
  } catch (err) {
    console.error("Error saving screenshot:", err);
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('error', `Failed to save screenshot: ${err.message}`);
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
  updateInstruction("Ctrl+Shift+S: Screenshot | Ctrl+Shift+A: Multi-mode | Ctrl+Shift+P: Privacy mode");
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

function togglePrivacyMode() {
  privacyMode = !privacyMode;
  if (privacyMode) {
    updateInstruction("Privacy Mode: ON - Enhanced stealth features active");
    // Add privacy enhancing features
    mainWindow.setSkipTaskbar(true); // Hide from taskbar
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1); // Make sure it stays on top
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setOpacity(0.92); // Slightly more transparent to be less noticeable
  } else {
    updateInstruction("Privacy Mode: OFF - Standard mode active");
    // Revert to standard behavior
    mainWindow.setSkipTaskbar(false);
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
    mainWindow.setOpacity(1.0);
  }
}

function createPrivacyEnhancedWindow() {
  // Use a non-standard window name to avoid detection
  const windowOptions = {
    width: 800,
    height: 600,
    title: `Data ${windowNameHash}`, // Random title to avoid detection
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false // Prevent throttling when window is in background
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    paintWhenInitiallyHidden: true,
    skipTaskbar: true, // Hide from taskbar for privacy
    autoHideMenuBar: true, // Hide menu bar
    type: 'toolbar', // Less likely to be detected as a full application window
  };
  
  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile('index.html');
  mainWindow.setContentProtection(true);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  // Reduce the window opacity slightly to make it less conspicuous
  mainWindow.setOpacity(0.92);
  
  // Disable the window shadow to make it less visible
  if (process.platform === 'darwin') {
    mainWindow.setHasShadow(false);
  }

  // Special keyboard handling for stealth operation
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Cancel default behavior for our global shortcuts to prevent them from being captured
    const ourShortcuts = [
      { ctrl: true, shift: true, key: 's' },
      { ctrl: true, shift: true, key: 'a' },
      { ctrl: true, shift: true, key: 'r' },
      { ctrl: true, shift: true, key: 'q' },
      { ctrl: true, shift: true, key: 'i' },
      { ctrl: true, shift: true, key: 'p' },
      { ctrl: true, shift: true, key: 'd' }
    ];
    
    const matchesShortcut = ourShortcuts.some(shortcut => 
      input.control === shortcut.ctrl && 
      input.shift === shortcut.shift && 
      input.key.toLowerCase() === shortcut.key
    );
    
    if (matchesShortcut) {
      event.preventDefault();
    }
  });
  
  // Ctrl+Shift+S => single or final screenshot
  globalShortcut.register('CommandOrControl+Shift+S', async () => {
    try {
      const screenshot = await captureStealthScreenshot();
      screenshots.push(screenshot);
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
      const screenshot = await captureStealthScreenshot();
      screenshots.push(screenshot);
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
  
  // Ctrl+Shift+P => Toggle privacy mode
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    togglePrivacyMode();
  });
  
  // Ctrl+Shift+D => Save screenshot to disk
  globalShortcut.register('CommandOrControl+Shift+D', async () => {
    try {
      await saveScreenshotToDisk();
    } catch (error) {
      console.error("Save screenshot error:", error);
    }
  });
  
  // Set up IPC handlers for UI buttons
  ipcMain.on('toggle-interactive', toggleAppInteractivity);
  ipcMain.on('toggle-privacy', togglePrivacyMode);
  ipcMain.on('capture-screenshot', async () => {
    try {
      const screenshot = await captureStealthScreenshot();
      screenshots.push(screenshot);
      await processScreenshots();
    } catch (error) {
      console.error("Capture screenshot error:", error);
    }
  });
  ipcMain.on('save-screenshot', async () => {
    try {
      await saveScreenshotToDisk();
    } catch (error) {
      console.error("Save screenshot error:", error);
    }
  });
  ipcMain.on('reset-process', resetProcess);
}

// Replace regular window creation with our enhanced privacy version
app.whenReady().then(() => {
  createPrivacyEnhancedWindow();
  
  // Hide the app from dock on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPrivacyEnhancedWindow();
  }
});

// Clean shutdown to remove any lingering temporary files
app.on('before-quit', () => {
  // Clean up any temporary files
  const tempDir = app.getPath('temp');
  try {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      if (file.startsWith('data_') && file.endsWith('.tmp')) {
        try {
          fs.unlinkSync(path.join(tempDir, file));
        } catch (e) {
          // Ignore errors on cleanup
        }
      }
    });
  } catch (e) {
    console.error("Error cleaning up temp files:", e);
  }
});
