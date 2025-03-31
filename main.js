const { app, BrowserWindow, globalShortcut, ipcMain, screen, nativeImage, dialog, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Use built-in crypto instead of robotjs
const crypto = require('crypto');
// For window layering and advanced stealth
const os = require('os');
const { execSync } = require('child_process');

// App identification
const APP_NAME = "Azzam Agent";
const STEALTH_ID = crypto.randomBytes(16).toString('hex');

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
    config.model = "gemini-2.0-flash";
    console.log("Model not specified in config, using default:", config.model);
  }
} catch (err) {
  console.error("Error reading config:", err);
  app.quit();
}

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(config.apiKey);

let mainWindow;
let overlayWindow;
let ultraStealthWindow = null;
let screenshots = [];
let multiPageMode = false;
let appIsActive = true; // Flag to track if app is actively intercepting input
let privacyMode = true; // Flag for advanced privacy features
let ultraStealthMode = false; // Flag for ultra stealth features (start disabled by default)
let picturesDir = app.getPath('pictures');
let appExePath = app.getPath('exe');

// Random hash for the window name to avoid detection
const windowNameHash = crypto.randomBytes(8).toString('hex');

// Detect if we're being run under suspicious conditions
function detectSuspiciousEnvironment() {
  try {
    const processes = getRunningProcesses();
    const suspiciousProcesses = [
      'obs64.exe', 'obs.exe', 'streamlabs', 'xsplit', 'bandicam', 
      'fraps', 'nvidia shadowplay', 'action!', 'camtasia', 'screen recorder',
      'capture', 'snagit', 'procmon', 'wireshark', 'fiddler', 'charles',
      'procdump', 'process monitor', 'process explorer', 'filemon', 'regmon'
    ];
    
    for (const proc of suspiciousProcesses) {
      if (processes.some(p => p.toLowerCase().includes(proc))) {
        console.log(`Detected potential monitoring software: ${proc}`);
        return true;
      }
    }
    
    return false;
  } catch (e) {
    console.error("Error detecting environment:", e);
    return false; // Assume safe if detection fails
  }
}

// Get a list of running processes
function getRunningProcesses() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('tasklist /fo csv /nh').toString();
      return output.split('\r\n').map(line => {
        const match = /"([^"]+)"/.exec(line);
        return match ? match[1] : '';
      }).filter(Boolean);
    } else if (process.platform === 'darwin') {
      const output = execSync('ps -axo comm').toString();
      return output.split('\n').filter(Boolean);
    } else {
      const output = execSync('ps -A -o comm').toString();
      return output.split('\n').filter(Boolean);
    }
  } catch (e) {
    console.error("Error getting process list:", e);
    return [];
  }
}

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

// Ultra-stealth mode functionality
function toggleUltraStealth() {
  ultraStealthMode = !ultraStealthMode;
  
  if (ultraStealthMode) {
    // Enable ultra stealth by creating a new overlay window
    enableUltraStealth();
    updateInstruction("ULTRA STEALTH: ON - Invisible to screen recording");
  } else {
    // Disable ultra stealth
    disableUltraStealth();
    updateInstruction("ULTRA STEALTH: OFF - Standard window behavior");
  }
}

function enableUltraStealth() {
  try {
    // If there's already an ultra-stealth window, close it
    if (ultraStealthWindow) {
      ultraStealthWindow.close();
      ultraStealthWindow = null;
    }
    
    // Create a new minimally visible window
    ultraStealthWindow = new BrowserWindow({
      width: mainWindow.getBounds().width,
      height: mainWindow.getBounds().height,
      x: mainWindow.getBounds().x,
      y: mainWindow.getBounds().y,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      opacity: 0.01,  // Almost invisible but still functional
      type: 'toolbar'
    });
    
    // Load a minimal HTML file
    ultraStealthWindow.loadFile('stealth.html');
    
    // Make the main window less visible to recorders
    mainWindow.setOpacity(0.92);
    
    // Sync positions
    ultraStealthWindow.on('move', () => {
      const bounds = ultraStealthWindow.getBounds();
      mainWindow.setBounds(bounds);
    });
    
    mainWindow.on('move', () => {
      const bounds = mainWindow.getBounds();
      if (ultraStealthWindow) {
        ultraStealthWindow.setBounds(bounds);
      }
    });
    
    // Sync visibility
    mainWindow.on('hide', () => {
      if (ultraStealthWindow) {
        ultraStealthWindow.hide();
      }
    });
    
    mainWindow.on('show', () => {
      if (ultraStealthWindow) {
        ultraStealthWindow.show();
      }
    });
    
    // Send update to renderer
    mainWindow.webContents.send('ultra-stealth-enabled');
    
    console.log("Ultra-stealth mode enabled successfully");
  } catch (err) {
    console.error("Failed to enable ultra stealth mode:", err);
    ultraStealthMode = false;
    updateInstruction("Failed to enable ultra stealth mode");
  }
}

function disableUltraStealth() {
  try {
    // Remove the ultra-stealth window if it exists
    if (ultraStealthWindow) {
      ultraStealthWindow.close();
      ultraStealthWindow = null;
    }
    
    // Restore main window opacity
    mainWindow.setOpacity(1.0);
    
    // Send update to renderer
    mainWindow.webContents.send('ultra-stealth-disabled');
    
    console.log("Ultra-stealth mode disabled successfully");
  } catch (err) {
    console.error("Failed to disable ultra stealth mode:", err);
  }
}

// Stealth screenshot method using Electron's desktopCapturer instead of robotjs
async function captureStealthScreenshot() {
  try {
    hideInstruction();
    // Hide the window completely before taking screenshot
    setWindowsInvisible(true);
    await new Promise(res => setTimeout(res, 200));

    // Capture the entire screen using desktopCapturer
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().workAreaSize
    });
    
    // Find the primary display source
    const primarySource = sources[0]; // Usually the first one is the primary display
    
    // Convert the thumbnail to PNG buffer
    const imageBuffer = primarySource.thumbnail.toPNG();
    
    // Generate a secure, random filename
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const filePath = path.join(
      app.getPath('temp'), // Use temp directory to avoid detection
      `data_${timestamp}_${randomSuffix}.tmp` // Use misleading extension
    );
    
    // Write the file
    fs.writeFileSync(filePath, imageBuffer);
    
    // Convert to base64 for sending to Gemini API
    const base64Image = imageBuffer.toString('base64');
    
    // Cleanup temp file (optional - can keep it if needed for debugging)
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error("Error cleaning up temp file:", e);
    }

    setWindowsInvisible(false);
    return { base64Image, imagePath: filePath };
  } catch (err) {
    setWindowsInvisible(false);
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('error', err.message);
    }
    throw err;
  }
}

// Helper to make all app windows invisible/visible
function setWindowsInvisible(invisible) {
  if (invisible) {
    if (mainWindow) mainWindow.hide();
    if (overlayWindow) overlayWindow.hide();
    if (ultraStealthWindow) ultraStealthWindow.hide();
  } else {
    if (mainWindow) mainWindow.show();
    if (overlayWindow) overlayWindow.show();
    if (ultraStealthWindow) ultraStealthWindow.show();
  }
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
    const savePath = path.join(picturesDir, 'azzam_data', filename);
    
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
    
    // Prepare a much more specific prompt for accurate question answering
    const prompt = `
    You are a specialized question-answering assistant. Analyze the question(s) in the screenshot and provide ONLY the direct answer. DO NOT repeat the question.

    Different question types require different responses:

    1. Multiple Choice Questions (MCQs):
       - Respond with ONLY the letter/number of the correct option (e.g., "A" or "3")

    2. Medical image analysis (X-rays, ECGs, MRIs, etc.):
       - Provide a direct interpretation of the medical finding
       - Example response: "ST elevation in leads V1-V4 indicating anterior STEMI"
       - NOT: "This is an ECG" - this is too generic

    3. Text-based clinical questions:
       - Give the specific answer to the question
       - Example Q: "What is the only condition where ACE inhibitors are given during pregnancy?"
       - Example A: "Diabetic nephropathy with proteinuria" (NOT just repeating the question)

    4. Essay or written answer questions:
       - Provide the complete answer in paragraph form

    5. Diagram or process questions:
       - List the specific steps/components requested

    IMPORTANT: Never simply identify the image type or repeat the question. Always provide the specific answer to the question being asked.
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
  updateInstruction("Ctrl+Shift+S: Screenshot | Ctrl+Shift+A: Multi-mode | Ctrl+Shift+P: Privacy");
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
  // Check for monitoring software
  const suspicious = detectSuspiciousEnvironment();
  if (suspicious) {
    console.log("Detected suspicious monitoring environment - enabling ultra stealth");
    ultraStealthMode = true;
  }

  // Use a non-standard window name to avoid detection
  const windowOptions = {
    width: 800,
    height: 600,
    title: `${STEALTH_ID}`, // Random title to avoid detection
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false, // Prevent throttling when window is in background
      additionalArguments: [`--window-id=${STEALTH_ID}`] // Pass a unique ID to renderer
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    paintWhenInitiallyHidden: true,
    skipTaskbar: true, // Hide from taskbar for privacy
    autoHideMenuBar: true, // Hide menu bar
    type: 'toolbar', // Less likely to be detected as a full application window
    hasShadow: false, // Disable shadow for better stealth
  };
  
  mainWindow = new BrowserWindow(windowOptions);

  // Create an overlay window for handling displays that might resist the main technique
  createOverlayWindow();

  mainWindow.loadFile('index.html');
  mainWindow.setContentProtection(true);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  // Reduce the window opacity slightly to make it less conspicuous
  mainWindow.setOpacity(0.92);
  
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
      { ctrl: true, shift: true, key: 'd' },
      { ctrl: true, shift: true, key: 'u' }
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
  
  // Apply ultra stealth techniques if enabled
  if (ultraStealthMode) {
    // When the window is ready, apply the stealth modifications
    mainWindow.once('ready-to-show', () => {
      enableUltraStealth();
    });
  }
  
  // Set up global shortcuts
  setupGlobalShortcuts();
  
  // Setup IPC handlers
  setupIpcHandlers();
}

// Creates a secondary overlay window that can be used for stealth techniques
function createOverlayWindow() {
  // This secondary window can be used for alternative rendering methods
  // that bypass standard screen capture
  overlayWindow = new BrowserWindow({
    width: 1,
    height: 1,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      offscreen: true, // Off-screen rendering can help with stealth
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  overlayWindow.loadFile('overlay.html');
}

function setupGlobalShortcuts() {
  // Unregister existing shortcuts first
  globalShortcut.unregisterAll();
  
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
  
  // Ctrl+Shift+U => Toggle ultra stealth mode
  globalShortcut.register('CommandOrControl+Shift+U', () => {
    toggleUltraStealth();
  });
  
  // Ctrl+Shift+D => Save screenshot to disk
  globalShortcut.register('CommandOrControl+Shift+D', async () => {
    try {
      await saveScreenshotToDisk();
    } catch (error) {
      console.error("Save screenshot error:", error);
    }
  });
}

function setupIpcHandlers() {
  // Set up IPC handlers for UI buttons
  ipcMain.on('toggle-interactive', toggleAppInteractivity);
  ipcMain.on('toggle-privacy', togglePrivacyMode);
  ipcMain.on('toggle-ultra-stealth', toggleUltraStealth);
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
  
  // Add diagnostic handler for ultra-stealth mode
  ipcMain.on('ultra-stealth-status', () => {
    mainWindow.webContents.send('stealth-status-update', {
      ultraStealthEnabled: ultraStealthMode,
      privacyEnabled: privacyMode,
      appActive: appIsActive
    });
  });
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
