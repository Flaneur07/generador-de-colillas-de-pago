
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';
const SEVILLA_SHEET_NAME = 'Planilla Pagos';

async function searchClient() {
  const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SEVILLA_SHEET_NAME)}&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const client5001 = data.find(row => row && row[0] == "5001");
    console.log("Client 5001 in sheet:", JSON.stringify(client5001));

  } catch (error) {
    console.error("Error:", error);
  }
}

searchClient();
