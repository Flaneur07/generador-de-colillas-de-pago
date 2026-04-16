import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Credenciales Reales
const supabaseUrl = 'https://qwquqrkjclsecpqoflnf.supabase.co';
const supabaseAnonKey = 'sb_publishable_7zb9azydIDP1ofF2IkTgEg_iTVCiCOT';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SEVILLA_SHEET_ID = '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8';
const SEVILLA_SHEET_NAME = 'Planilla Pagos';

const normalizeText = (s: any) => 
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.]/g, "")
    .trim();

const cleanNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let strVal = String(val).trim();
  if (!strVal || strVal === '-') return 0;
  strVal = strVal.replace(/[$\sA-Za-z]/g, '');
  if (strVal.includes('.') && strVal.includes(',')) {
    strVal = strVal.replace(/\./g, '').replace(',', '.');
  } else if (strVal.includes('.') && !strVal.includes(',')) {
    strVal = strVal.replace(/\./g, '');
  }
  const cleanStr = strVal.replace(/[^\d.]/g, '');
  return Math.floor(Number(cleanStr)) || 0;
};

async function fixSevilla() {
  console.log("🚀 Iniciando Parche de Pagos para Sevilla...");
  
  const url = `https://docs.google.com/spreadsheets/d/${SEVILLA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SEVILLA_SHEET_NAME)}&_cb=${Date.now()}`;
  const res = await fetch(url);
  const text = await res.text();
  const workbook = XLSX.read(text, { type: 'string', raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(data.length, 20); i++) {
      const rowStr = data[i].map(normalizeText).join(" ");
      if ((rowStr.includes("pol") || rowStr.includes("contrat")) && (rowStr.includes("apellido") || rowStr.includes("nombre"))) {
          headerRowIdx = i;
          break;
      }
  }

  if (headerRowIdx === -1) {
    console.error("No se encontró la fila de encabezados");
    return;
  }

  const rawHeaders = data[headerRowIdx];
  const headers = rawHeaders.map(normalizeText);
  
  console.log("Encabezados detectados:", rawHeaders);

  const idxPoliza = headers.findIndex(h => h === "no poliza" || h === "contrato" || h.includes("pol") || h.includes("contrato"));
  
  // Sevilla suele poner los meses como 1, 2, 3 o Ene, Feb... Vamos a mapearlos flexiblemente
  const monthMap = [
    { key: "ene", aliases: ["ene", "enero", "1", "01"] },
    { key: "feb", aliases: ["feb", "febrero", "2", "02"] },
    { key: "mar", aliases: ["mar", "marzo", "3", "03"] },
    { key: "abr", aliases: ["abr", "abril", "4", "04"] },
    { key: "may", aliases: ["may", "mayo", "5", "05"] },
    { key: "jun", aliases: ["jun", "junio", "6", "06"] },
    { key: "jul", aliases: ["jul", "julio", "7", "07"] },
    { key: "ago", aliases: ["ago", "agosto", "8", "08"] },
    { key: "sep", aliases: ["sep", "septiembre", "9", "09"] },
    { key: "oct", aliases: ["oct", "octubre", "10"] },
    { key: "nov", aliases: ["nov", "noviembre", "11"] },
    { key: "dic", aliases: ["dic", "diciembre", "12"] }
  ];

  const monthIndices: Record<string, number> = {};
  
  // Encontrar el índice de cada mes basándonos en los alias
  monthMap.forEach(m => {
    // Buscar si algún header coincide con alguno de los alias del mes actual
    const index = headers.findIndex(h => m.aliases.some(alias => h === alias || h.startsWith(alias)));
    monthIndices[m.key] = index;
  });

  console.log("Mapeo de meses encontrado:", monthIndices);

  let updatedCount = 0;

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    const contrato = String(row[idxPoliza] || "").replace(/'/g, "").trim();
    if (!contrato) continue;

    // Solo extraemos los pagos
    const updateObj: any = {};
    let hasPayments = false;

    monthMap.forEach(m => {
      const colIdx = monthIndices[m.key];
      if (colIdx !== -1) {
        const value = cleanNumber(row[colIdx]);
        updateObj[m.key] = value;
        if (value > 0) hasPayments = true;
      }
    });

    if (hasPayments) {
      const { data, error } = await supabase
        .from('clients')
        .update(updateObj)
        .eq('site_id', 'sevilla')
        .eq('contract_number', contrato)
        .select();

      if (error) {
         console.error(`Error actualizando pagos de ${contrato}:`, error.message);
      } else if (data && data.length > 0) {
         updatedCount++;
      } else {
         console.warn(`No se encontró cliente Sevilla con contrato: ${contrato}`);
      }
    }
    
    if (i % 50 === 0) console.log(`Revisadas ${i - headerRowIdx} filas...`);
  }

  console.log(`\n✅ Pagos de Sevilla parcheados con éxito: ${updatedCount} clientes actualizados.`);
}

fixSevilla().catch(console.error);
