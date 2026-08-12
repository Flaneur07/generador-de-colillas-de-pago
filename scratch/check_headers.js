
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';
const SEVILLA_SHEET_NAME = 'Planilla Pagos';

async function checkHeaders() {
  console.log("Checking Sevilla sheet headers...");
  const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SEVILLA_SHEET_NAME)}&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
        console.error("Failed to fetch sheet:", res.statusText);
        return;
    }
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log("First 5 rows of data:");
    data.slice(0, 5).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

checkHeaders();
