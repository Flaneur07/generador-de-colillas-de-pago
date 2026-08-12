
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';
const SEVILLA_SHEET_NAME = 'Planilla Pagos';

async function checkData() {
  console.log("Checking Sevilla data for payments...");
  const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SEVILLA_SHEET_NAME)}&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log(`Total rows: ${data.length}`);
    
    let rowsWithPayments = 0;
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const payments = row.slice(2);
        const hasPayment = payments.some(p => p && String(p).trim() !== "" && String(p).trim() !== "0");
        if (hasPayment) {
            rowsWithPayments++;
            if (rowsWithPayments <= 5) {
                console.log(`Row ${i} has payments:`, JSON.stringify(row));
            }
        }
    }
    console.log(`Total rows with payments: ${rowsWithPayments}`);

  } catch (error) {
    console.error("Error:", error);
  }
}

checkData();
