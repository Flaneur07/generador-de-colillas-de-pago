
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Configuración
const SUPABASE_URL = 'https://qwquqrkjclsecpqoflnf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7zb9azydIDP1ofF2IkTgEg_iTVCiCOT';
const SHEET_ID = '14xdFb96hNPcrmNvPaVGaQXyxuEkQjGkZ';
const SITE_ID = 'sevilla';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MONTH_MAPPING = {
  "enero": "ene", "febrero": "feb", "marzo": "mar", "abril": "abr",
  "mayo": "may", "junio": "jun", "julio": "jul", "agosto": "ago",
  "septiembre": "sep", "octubre": "oct", "noviembre": "nov", "diciembre": "dic"
};

const cleanText = (s) => String(s || "").trim();
const cleanContract = (s) => String(s || "").replace(/'/g, "").trim();
const cleanNumber = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let strVal = String(val).trim();
  if (!strVal || strVal === '-') return 0;
  strVal = strVal.replace(/[$\sA-Za-z]/g, '');
  return Math.floor(Number(strVal.replace(/[^\d.]/g, ''))) || 0;
};

async function runMigration() {
  console.log("🚀 Iniciando migración final de Sevilla...");
  
  const stats = {
    totalExcel: 0,
    updated: 0,
    created: 0,
    errors: 0
  };

  try {
    // 1. Descargar Excel
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    // 2. Procesar Pestaña TITULARES (para datos extendidos)
    const titularesSheet = workbook.Sheets['TITULARES'];
    const titularesRaw = XLSX.utils.sheet_to_json(titularesSheet, { header: 1 });
    const titularesMap = new Map();
    
    // Identificar columnas en Titulares
    const tHeaders = titularesRaw[1] || []; // La fila 1 tiene los nombres en este archivo
    const idxTPol = tHeaders.findIndex(h => String(h).includes("POL NUE"));
    const idxTNombre = tHeaders.findIndex(h => String(h).includes("NOMBRE"));
    const idxTCC = tHeaders.findIndex(h => String(h).includes("C.C"));
    const idxTObs = tHeaders.findIndex(h => String(h).includes("VEREDA"));

    for (let i = 2; i < titularesRaw.length; i++) {
        const row = titularesRaw[i];
        const contract = cleanContract(row[idxTPol]);
        if (contract) {
            titularesMap.set(contract, {
                nombre: cleanText(row[idxTNombre]).toUpperCase(),
                cedula: cleanText(row[idxTCC]),
                observaciones: cleanText(row[idxTObs])
            });
        }
    }

    // 3. Procesar Pestaña Pagos
    const pagosSheet = workbook.Sheets['Pagos'];
    const pagosRaw = XLSX.utils.sheet_to_json(pagosSheet, { header: 1 });
    const pHeaders = (pagosRaw[1] || []).map(h => cleanText(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    
    const idxPContrato = pHeaders.findIndex(h => h.includes("contrato"));
    const monthCols = {};
    Object.keys(MONTH_MAPPING).forEach(m => {
        monthCols[m] = pHeaders.findIndex(h => h.startsWith(m));
    });

    console.log(`Procesando ${pagosRaw.length - 2} filas de la pestaña Pagos...`);

    for (let i = 2; i < pagosRaw.length; i++) {
        const row = pagosRaw[i];
        const contrato = cleanContract(row[idxPContrato]);
        if (!contrato) continue;

        stats.totalExcel++;

        // Construir objeto de pagos
        const paymentData = {};
        let hasAnyPayment = false;
        Object.entries(MONTH_MAPPING).forEach(([esp, eng]) => {
            const colIdx = monthCols[esp];
            if (colIdx !== -1) {
                const val = cleanNumber(row[colIdx]);
                paymentData[eng] = val;
                if (val > 0) hasAnyPayment = true;
            }
        });

        // Buscar datos del titular
        const info = titularesMap.get(contrato) || {
            nombre: cleanText(row[1]).toUpperCase(),
            cedula: contrato,
            observaciones: ""
        };

        // UPSERT en Supabase
        // Primero intentamos buscar si existe para saber si es creación o actualización en el reporte
        const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('site_id', SITE_ID)
            .eq('contract_number', contrato)
            .maybeSingle();

        const clientPayload = {
            site_id: SITE_ID,
            contract_number: contrato,
            full_name: info.nombre,
            observaciones: info.observaciones,
            ...paymentData
        };

        const { error: upsertError } = await supabase
            .from('clients')
            .upsert(clientPayload, { onConflict: 'site_id, contract_number' });

        if (upsertError) {
            console.error(`Error con contrato ${contrato}:`, upsertError.message);
            stats.errors++;
        } else {
            if (existingClient) stats.updated++;
            else stats.created++;
        }

        if (stats.totalExcel % 50 === 0) console.log(`Progreso: ${stats.totalExcel} procesados...`);
    }

    console.log("\n--- RESULTADOS DE LA MIGRACIÓN ---");
    console.log(`Total Excel: ${stats.totalExcel}`);
    console.log(`Actualizados: ${stats.updated}`);
    console.log(`Nuevos creados: ${stats.created}`);
    console.log(`Errores: ${stats.errors}`);

  } catch (err) {
    console.error("Error crítico durante la migración:", err);
  }
}

runMigration();
