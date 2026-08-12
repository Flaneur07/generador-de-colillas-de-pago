
import * as XLSX from 'xlsx';

const SHEET_ID = '14xdFb96hNPcrmNvPaVGaQXyxuEkQjGkZ';

async function verifyPaymentsTab() {
  console.log("Verificando contenido de la pestaña 'Pagos'...");
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
  
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    const sheet = workbook.Sheets['Pagos'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log(`Total filas en 'Pagos': ${data.length}`);
    
    let rowsWithPayments = 0;
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 3) continue;
        const payments = row.slice(2);
        const hasPayment = payments.some(p => p !== null && p !== undefined && String(p).trim() !== "" && String(p).trim() !== "0");
        if (hasPayment) {
            rowsWithPayments++;
            if (rowsWithPayments <= 5) {
                console.log(`Fila ${i} (${row[0]} - ${row[1]}) tiene pagos:`, JSON.stringify(payments));
            }
        }
    }
    
    console.log(`\nResultado: Se encontraron ${rowsWithPayments} filas con pagos reales.`);

  } catch (error) {
    console.error("Error:", error);
  }
}

verifyPaymentsTab();
