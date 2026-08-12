
import * as XLSX from 'xlsx';

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';

async function findDataInSheets() {
  console.log("Searching for data in other tabs...");
  for (let gid of [0, 1, 2, 3, 4, 5]) {
    const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&_cb=${Date.now()}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text.includes("<!doctype html>") || text.length < 50) continue;
      
      const workbook = XLSX.read(text, { type: 'string', raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      let rowsWithPayments = 0;
      for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          const payments = row.slice(2);
          if (payments.some(p => p && String(p).trim() !== "" && String(p).trim() !== "0")) {
              rowsWithPayments++;
          }
      }
      
      console.log(`GID ${gid} - Rows with payments: ${rowsWithPayments}`);
    } catch (e) {}
  }
}

findDataInSheets();
