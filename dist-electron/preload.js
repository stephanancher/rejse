"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    selectExcelFile: () => electron_1.ipcRenderer.invoke('select-excel-file'),
    saveToExcel: (data) => electron_1.ipcRenderer.invoke('save-to-excel', data),
    saveImage: (data) => electron_1.ipcRenderer.invoke('save-image', data),
    captureMap: (data) => electron_1.ipcRenderer.invoke('capture-map', data),
});
//# sourceMappingURL=preload.js.map