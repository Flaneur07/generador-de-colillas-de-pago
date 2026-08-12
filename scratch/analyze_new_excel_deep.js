
import * as XLSX from 'xlsx';

const SHEET_ID = '14xdFb96hNPcrmNvPaVGaQXyxuEkQjGkZ';

async function analyzeNewExcelDeep() {
  console.log("Análisis profundo del nuevo Excel...");
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Buscar la fila de encabezados
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(data.length, 20); i++) {
        const row = data[i] || [];
        const rowStr = row.join(" ").toLowerCase();
        if (rowStr.includes("nombre") && (rowStr.includes("pol") || rowStr.includes("contrato"))) {
            headerRowIdx = i;
            break;
        }
    }

    if (headerRowIdx === -1) {
        console.log("No se encontró fila de encabezados clara. Mostrando primeras 5 filas:");
        data.slice(0, 5).forEach((r, i) => console.log(`Fila ${i}:`, JSON.stringify(r)));
        return;
    }

    const headers = data[headerRowIdx];
    console.log("Encabezados encontrados (Fila " + headerRowIdx + "):", JSON.stringify(headers));
    
    // Buscar columnas de meses
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const monthCols = headers.map((h, i) => {
        const sh = String(h || "").toLowerCase();
        if (months.some(m => sh.startsWith(m) || sh.includes(m))) return { name: h, idx: i };
        return null;
    }).filter(x => x);

    console.log("Columnas de meses detectadas:", JSON.stringify(monthCols));

    // Ejemplo de datos con pagos
    console.log("Ejemplo de datos (Fila " + (headerRowIdx + 1) + "):", JSON.stringify(data[headerRowIdx + 1]));

  } catch (error) {
    console.error("Error:", error);
  }
}

analyzeNewExcelDeep();
