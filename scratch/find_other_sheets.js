
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';

async function findOtherSheets() {
  console.log("Searching for other tabs in Sevilla spreadsheet...");
  for (let gid of [0, 1, 2, 3, 4, 5]) {
    const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&_cb=${Date.now()}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text.includes("<!doctype html>") || text.length < 50) continue;
      
      const workbook = XLSX.read(text, { type: 'string', raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      console.log(`GID ${gid} found. Headers:`, JSON.stringify(data[0]));
    } catch (e) {}
  }
}

findOtherSheets();
