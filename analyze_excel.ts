import * as XLSX from 'xlsx';
import path from 'path';

const filePath = path.join('public', 'Opgørelse+af+møde+og+rejseudgifter+2026.xlsx');
console.log("Reading file:", filePath);

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get headers (first row ideally, or infer from data)
    // range: 0 means start from first row
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });

    console.log("Sheet Name:", sheetName);
    const targetRowIndex = 16;
    console.log(`Checking Row ${targetRowIndex}:`);
    const targetRow = json[targetRowIndex];
    console.log(JSON.stringify(targetRow));

    // Also log surrounding just in case
    console.log(`Row 15:`, JSON.stringify(json[15]));
    console.log(`Row 17:`, JSON.stringify(json[17]));

} catch (e) {
    console.error("Error reading excel:", e);
}
