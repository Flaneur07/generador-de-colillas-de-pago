
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';

async function listSheets() {
  console.log("Listing sheets for Sevilla spreadsheet...");
  const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    console.log("Sheet names:", workbook.SheetNames);
    
    // Note: GVIZ /tq?tqx=out:csv usually only returns the first sheet unless you specify &sheet= or &gid=
    // But XLSX.read(text) might not be enough to get all sheet names from a CSV export.
    // To get all sheet names, we might need a different approach or just try common names.
  } catch (error) {
    console.error("Error:", error);
  }
}

listSheets();
