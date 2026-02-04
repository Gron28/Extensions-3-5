const { app, Tray, Menu, BrowserWindow, screen, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Optimize memory usage for lightweight taskbar app
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Ensure single instance only
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

let bodyTray = null;
let workTray = null;
let menuWindow = null;
let progressWindow = null;

const DATA_DIR = app.getPath('userData');
const BODY_DATA_PATH = path.join(DATA_DIR, 'body_data.json');
const WORK_DATA_PATH = path.join(DATA_DIR, 'work_data.json');

// Config matching menu.js
const CONFIG = {
    body: { duration: 10 * 60 * 1000 },
    work: { duration: 3 * 60 * 60 * 1000 }
};

// PNG icons will be loaded from src/assets/

function loadData(p) {
    try {
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p));
    } catch (e) {}
    return { startTime: null, history: [] };
}

function saveData(p, data) {
    try {
        fs.writeFileSync(p, JSON.stringify(data));
    } catch (e) {}
}

function createWindows() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.bounds; // Use full screen width, not work area

    progressWindow = new BrowserWindow({
        width: width,
        height: 8,
        x: 0,
        y: 0,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    progressWindow.setIgnoreMouseEvents(true);
    progressWindow.setAlwaysOnTop(true, 'screen-saver'); // Ensure it stays on top
    progressWindow.loadFile('src/progress.html');
    
    // Wait for progress window to be ready before hiding
    progressWindow.webContents.on('did-finish-load', () => {
        progressWindow.hide();
    });

    menuWindow = new BrowserWindow({
        width: 300,
        height: 480,
        show: false,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    menuWindow.loadFile('src/menu.html');
    // Close menu when clicking outside - but with a delay to prevent instant close
    menuWindow.on('blur', () => {
        setTimeout(() => {
            if (!menuWindow.isFocused()) {
                menuWindow.hide();
            }
        }, 100);
    });
}

function toggleMenu(type, tray) {
    if (menuWindow.isVisible() && menuWindow.currentType === type) {
        menuWindow.hide();
    } else {
        menuWindow.currentType = type;
        menuWindow.webContents.send('set-type', type);
        
        const trayBounds = tray.getBounds();
        const windowBounds = menuWindow.getBounds();
        const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
        const y = Math.round(trayBounds.y - windowBounds.height);

        menuWindow.setPosition(x, y, false);
        menuWindow.show();
        menuWindow.focus();
    }
}

app.whenReady().then(() => {
    createWindows();

    // Load PNG icons from assets folder
    const bodyIconPath = path.join(__dirname, 'assets', 'icon_body.png');
    const workIconPath = path.join(__dirname, 'assets', 'icon_work.png');

    bodyTray = new Tray(bodyIconPath);
    bodyTray.setToolTip('Body Activation');
    bodyTray.on('click', () => toggleMenu('body', bodyTray));

    workTray = new Tray(workIconPath);
    workTray.setToolTip('Work Cycles');
    workTray.on('click', () => toggleMenu('work', workTray));

    ipcMain.handle('get-data', (e, type) => loadData(type === 'body' ? BODY_DATA_PATH : WORK_DATA_PATH));
    ipcMain.on('save-data', (e, type, data) => saveData(type === 'body' ? BODY_DATA_PATH : WORK_DATA_PATH, data));
    ipcMain.on('close-menu', () => {
        if (menuWindow) menuWindow.hide();
    });

    // Main process timer to check for cycle completion and show/hide progress bar
    setInterval(() => {
        if (!progressWindow || progressWindow.isDestroyed()) return;
        
        let shouldShow = false;
        ['body', 'work'].forEach(type => {
            const dataPath = type === 'body' ? BODY_DATA_PATH : WORK_DATA_PATH;
            const d = loadData(dataPath);
            if (d.startTime) {
                const elapsed = Date.now() - d.startTime;
                const progress = elapsed / CONFIG[type].duration;
                
                if (progress >= 1) {
                    // Cycle completed - send 0 to reset the bar
                    progressWindow.webContents.send('set-progress', { type, progress: 0 });
                } else if (progress > 0) {
                    // Show progress
                    shouldShow = true;
                    progressWindow.webContents.send('set-progress', { type, progress });
                }
            }
        });
        
        if (shouldShow) {
            if (!progressWindow.isVisible()) progressWindow.show();
        } else {
            if (progressWindow.isVisible()) progressWindow.hide();
        }
    }, 1000);
});