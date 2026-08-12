
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';
const BEN_SHEET_NAME = 'Planilla beneficiarios sevilla';

async function checkBenSheet() {
  console.log("Checking Sevilla beneficiaries sheet for payments...");
  const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(BEN_SHEET_NAME)}&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log("Headers:", JSON.stringify(data[0]));
    data.slice(0, 10).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

checkBenSheet();
