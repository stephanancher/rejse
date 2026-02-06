import * as XLSX from 'xlsx';
import path from 'path';

const filePath = path.join('public', 'Opgørelse+af+møde+og+rejseudgifter+2026.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 }) as any[][];

    const rowIndex = 18;
    const row = json[rowIndex] || [];
    console.log(`\nheader_row:${rowIndex}`);
    const colIndices = [2, 3, 4, 5, 6, 7]; // C, D, E, F, G, H
    colIndices.forEach(i => {
        console.log(`Col ${i} (${String.fromCharCode(65 + i)}): "${row[i]}"`);
    });

} catch (e) {
    console.error(e);
}
