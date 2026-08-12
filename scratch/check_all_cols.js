
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';
const SEVILLA_SHEET_NAME = 'Planilla Pagos';

async function checkAllColumns() {
  console.log("Checking all month columns for Sevilla...");
  const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SEVILLA_SHEET_NAME)}&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const payments = row.slice(2);
        const nonZeroPayments = payments.filter(p => p && String(p).trim() !== "" && String(p).trim() !== "0");
        if (nonZeroPayments.length > 0) {
            console.log(`Row ${i} (${row[0]} - ${row[1]}) has values:`, JSON.stringify(payments));
        }
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

checkAllColumns();
