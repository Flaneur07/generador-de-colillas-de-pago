
import * as XLSX from 'xlsx';

const SHEET_ID = '14xdFb96hNPcrmNvPaVGaQXyxuEkQjGkZ';

async function listTabs() {
  console.log("Buscando todas las pestañas del nuevo Excel...");
  // Intentamos descargar como XLSX para obtener todas las pestañas
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
  
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    console.log("Pestañas encontradas:", workbook.SheetNames);
    
    workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\n--- Pestaña: ${name} ---`);
        console.log("Primeras 2 filas:", JSON.stringify(data.slice(0, 2)));
    });

  } catch (error) {
    console.error("Error al leer XLSX:", error);
  }
}

listTabs();
