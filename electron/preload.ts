import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
    saveToExcel: (data: any) => ipcRenderer.invoke('save-to-excel', data),
    saveImage: (data: any) => ipcRenderer.invoke('save-image', data),
    captureMap: (data: any) => ipcRenderer.invoke('capture-map', data),
});
