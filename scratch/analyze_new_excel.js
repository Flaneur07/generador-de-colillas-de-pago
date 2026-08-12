
import * as XLSX from 'xlsx';

const SHEET_ID = '14xdFb96hNPcrmNvPaVGaQXyxuEkQjGkZ';

async function analyzeNewExcel() {
  console.log("Intentando leer el nuevo Excel de Sevilla...");
  // Intentamos con la URL de exportación de CSV de Google Sheets
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&_cb=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
        console.error("Error al acceder al archivo. Asegúrate de que tenga permiso de 'Cualquier persona con el enlace'. Status:", res.status);
        return;
    }
    const text = await res.text();
    
    if (text.includes("<!doctype html>")) {
        console.error("No se pudo obtener el CSV. El archivo podría ser privado o requerir inicio de sesión.");
        return;
    }

    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log("Estructura detectada:");
    console.log("Encabezados:", JSON.stringify(data[0]));
    console.log("Ejemplo Fila 1:", JSON.stringify(data[1]));
    console.log("Total filas:", data.length);

    // Conteo de pagos en la primera fila de datos
    if (data[1]) {
        const payments = data[1].slice(2);
        console.log("Pagos detectados en fila 1:", JSON.stringify(payments));
    }

  } catch (error) {
    console.error("Error en el análisis:", error);
  }
}

analyzeNewExcel();
