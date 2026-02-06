export { };

declare global {
    interface Window {
        electron: {
            selectExcelFile: () => Promise<string | null>;
            saveToExcel: (data: { filePath: string; date: string; description: string; km: number }) => Promise<{ success: boolean; row?: number; savedFilePath?: string; error?: string }>;
            saveImage: (data: { filePath: string; dataBase64: string }) => Promise<{ success: boolean; error?: string }>;
            captureMap: (data: { rect: { x: number; y: number; width: number; height: number }; filePath: string }) => Promise<{ success: boolean; error?: string }>;
        };
    }
}
