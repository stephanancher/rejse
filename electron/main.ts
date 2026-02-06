import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// (Not used with NSIS usually, keeping simple)


function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Check if we are in development mode (via helper or env var)
    // For simplicity, we check if we can connect to the dev server or use NODE_ENV
    const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the index.html from the dist folder
        // The dist folder is at the root of the app bundled by Electron
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle('select-excel-file', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });

    ipcMain.handle('save-to-excel', async (event, { filePath, date, description, km }) => {
        try {
            console.log("Template path:", filePath);
            if (!fs.existsSync(filePath)) {
                throw new Error('Template-filen findes ikke');
            }

            // 1. Determine Target Path: Koerplan.xlsx (Fixed name for accumulating dates)
            const dir = path.dirname(filePath);
            const targetFilename = 'Koerplan.xlsx';
            const targetPath = path.join(dir, targetFilename);

            console.log("Target path:", targetPath);

            // 2. If target doesn't exist, create it from template
            if (!fs.existsSync(targetPath)) {
                console.log("Creating new file from template...");
                try {
                    fs.copyFileSync(filePath, targetPath);
                } catch (copyErr: any) {
                    throw new Error(`Kunne ikke oprette ny fil fra skabelon: ${copyErr.message}`);
                }
            } else {
                console.log("Appending to existing file...");
            }

            // 3. Open TARGET file
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            try {
                await workbook.xlsx.readFile(targetPath);
            } catch (readErr: any) {
                console.error("Read error:", readErr);
                if (readErr.message.includes('End of data reached') || readErr.code === 'EBUSY') {
                    throw new Error(`Filen "${targetFilename}" er åben i Excel. Luk den venligst ned og prøv igen.`);
                }
                throw readErr;
            }

            // Force Excel to recalculate formulas when opening the file
            workbook.calcProperties.fullCalcOnLoad = true;

            const sheet = workbook.worksheets[0]; // First sheet

            // Start checking from Row 23
            let targetRow = 23;
            const maxRows = 1000;

            while (targetRow < maxRows) {
                const row = sheet.getRow(targetRow);
                const valA = row.getCell(1).value; // A
                const valB = row.getCell(2).value; // B

                // If both A and B are effectively empty
                if (!valA && !valB) {
                    break;
                }
                targetRow++;
            }

            console.log("Found empty row at:", targetRow);
            const row = sheet.getRow(targetRow);

            // A: Dato
            row.getCell(1).value = date;
            // B: Beskrivelse
            row.getCell(2).value = description;
            // C: Km
            const cellC = row.getCell(3);
            const kmValue = Math.round(Number(km) * 100) / 100; // Round to 2 decimals as pure number
            cellC.value = kmValue;
            cellC.numFmt = '0.00'; // Simple 2 decimal format

            // Explicitly try to modify the cell's underlying model if needed (ExcelJS usually handles value assignment correctly)
            // But let's log to be sure
            console.log("Writing numeric value:", kmValue, typeof kmValue);

            row.commit(); // Commit changes to row

            await workbook.xlsx.writeFile(targetPath);
            return { success: true, row: targetRow, savedFilePath: targetPath };

        } catch (error: any) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-image', async (event, { filePath, dataBase64 }) => {
        try {
            console.log("Saving image:", filePath);
            // Remove header "data:image/jpeg;base64,"
            const base64Data = dataBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');

            await fs.promises.writeFile(filePath, buffer);
            return { success: true };
        } catch (error: any) {
            console.error("Failed to save image:", error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('capture-map', async (event, { rect, filePath }) => {
        try {
            console.log("Capturing map area:", rect, "to file:", filePath);
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) throw new Error('Could not find browser window');

            // Capture the specific rectangle
            // Note: capturePage takes x, y, width, height.
            // These must be integers.
            const captureRect = {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };

            console.log("Rounded Capture Rect:", captureRect);

            const image = await win.webContents.capturePage(captureRect);

            if (image.isEmpty()) {
                console.error("Captured image is empty!");
                return { success: false, error: "Captured image is empty" };
            }

            const buffer = image.toJPEG(80); // quality 80
            console.log("Buffer size:", buffer.length);

            await fs.promises.writeFile(filePath, buffer);
            return { success: true };
        } catch (error: any) {
            console.error("Failed to capture map:", error);
            return { success: false, error: error.message };
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
