import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Credenciales
const supabaseUrl = 'https://qwquqrkjclsecpqoflnf.supabase.co';
const supabaseAnonKey = 'sb_publishable_7zb9azydIDP1ofF2IkTgEg_iTVCiCOT';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuración de sedes
const SITES = [
  {
    id: 'ebejico',
    spreadsheetId: '1MULokQ8jhbjK1Fi1HpWv7YQOh-9yuGpoifHRVvAenu0',
    sheetName: 'mensualidades 2026',
    benGid: '521965387'
  },
  {
    id: 'heliconia',
    spreadsheetId: '1LclqwFBtLqIW2KOq5pWXYY2EIqR95R6IxIjQJLt4X-k',
    sheetName: '2026',
    benGid: '372521735'
  },
  {
    id: 'sevilla',
    spreadsheetId: '1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8',
    sheetName: 'Planilla Pagos',
    benSheetName: 'Planilla beneficiarios sevilla'
  }
];

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

async function migrate() {
  console.log("🚀 Iniciando migración masiva...");

  for (const site of SITES) {
    console.log(`\n--- Sede: ${site.id.toUpperCase()} ---`);
    
    // 1. Obtener Clientes
    const url = `https://docs.google.com/spreadsheets/d/${site.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(site.sheetName)}&_cb=${Date.now()}`;
    const res = await fetch(url);
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

    // Buscar encabezados
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(data.length, 20); i++) {
        const rowStr = data[i].map(normalizeText).join(" ");
        if ((rowStr.includes("pol") || rowStr.includes("contrat")) && (rowStr.includes("apellido") || rowStr.includes("nombre"))) {
            headerRowIdx = i;
            break;
        }
    }
    if (headerRowIdx === -1) headerRowIdx = 0;
    const headers = data[headerRowIdx].map(normalizeText);

    const idxPoliza = headers.findIndex(h => h === "no poliza" || h === "contrato" || h.includes("pol") || h.includes("contrato"));
    const idxNombre = headers.findIndex(h => h.includes("apellido") || h.includes("nombre") || h.includes("cliente"));
    const idxObs = headers.findIndex(h => h.includes("obs") || h.includes("nota"));
    
    const monthMap = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const monthIndices: Record<string, number> = {};
    monthMap.forEach(m => {
        monthIndices[m] = headers.findIndex(h => h.startsWith(m));
    });

    console.log(`Cargando ${data.length - headerRowIdx - 1} clientes de Sheets...`);
    
    // 2. Obtener Beneficiarios
    let benUrl = `https://docs.google.com/spreadsheets/d/${site.spreadsheetId}/gviz/tq?tqx=out:csv&_cb=${Date.now()}`;
    if (site.benGid) benUrl += `&gid=${site.benGid}`;
    if (site.benSheetName) benUrl += `&sheet=${encodeURIComponent(site.benSheetName)}`;
    
    const benRes = await fetch(benUrl);
    const benText = await benRes.text();
    const benWorkbook = XLSX.read(benText, { type: 'string', raw: true });
    const benSheet = benWorkbook.Sheets[benWorkbook.SheetNames[0]];
    const benData = XLSX.utils.sheet_to_json<any[]>(benSheet, { header: 1, defval: "" });

    let bHeaderRowIdx = -1;
    let bIdxContrato = -1, bIdxNombre = -1, bIdxFecha = -1, bIdxEstado = -1;
    for (let i = 0; i < Math.min(benData.length, 15); i++) {
        const row = benData[i].map(normalizeText);
        bIdxContrato = row.findIndex((h: string) => h === "no poliza" || h.includes("contrato") || h.includes("poliza"));
        bIdxNombre = row.findIndex((h: string) => h.includes("nombre") || h.includes("apellido") || h.includes("cliente"));
        bIdxFecha = row.findIndex((h: string) => h.includes("nacimien") || h.includes("fecha") || h.includes("f.n"));
        bIdxEstado = row.findIndex((h: string) => h.includes("estado"));
        if (bIdxContrato !== -1 && bIdxNombre !== -1) { bHeaderRowIdx = i; break; }
    }

    console.log(`Cargando ${benData.length - Math.max(0, bHeaderRowIdx) - 1} beneficiarios de Sheets...`);

    // 3. Procesar e Insertar
    for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[idxNombre]) continue;
        
        const contrato = String(row[idxPoliza] || "").replace(/'/g, "").trim();
        if (!contrato) continue;

        const clientObj = {
            site_id: site.id,
            contract_number: contrato,
            full_name: String(row[idxNombre]).trim().toUpperCase(),
            observaciones: idxObs !== -1 ? String(row[idxObs]).trim() : "",
            ene: monthIndices['ene'] !== -1 ? cleanNumber(row[monthIndices['ene']]) : 0,
            feb: monthIndices['feb'] !== -1 ? cleanNumber(row[monthIndices['feb']]) : 0,
            mar: monthIndices['mar'] !== -1 ? cleanNumber(row[monthIndices['mar']]) : 0,
            abr: monthIndices['abr'] !== -1 ? cleanNumber(row[monthIndices['abr']]) : 0,
            may: monthIndices['may'] !== -1 ? cleanNumber(row[monthIndices['may']]) : 0,
            jun: monthIndices['jun'] !== -1 ? cleanNumber(row[monthIndices['jun']]) : 0,
            jul: monthIndices['jul'] !== -1 ? cleanNumber(row[monthIndices['jul']]) : 0,
            ago: monthIndices['ago'] !== -1 ? cleanNumber(row[monthIndices['ago']]) : 0,
            sep: monthIndices['sep'] !== -1 ? cleanNumber(row[monthIndices['sep']]) : 0,
            oct: monthIndices['oct'] !== -1 ? cleanNumber(row[monthIndices['oct']]) : 0,
            nov: monthIndices['nov'] !== -1 ? cleanNumber(row[monthIndices['nov']]) : 0,
            dic: monthIndices['dic'] !== -1 ? cleanNumber(row[monthIndices['dic']]) : 0
        };

        // Insertar Cliente
        const { data: newClient, error: clientErr } = await supabase
            .from('clients')
            .upsert(clientObj, { onConflict: 'site_id, contract_number' })
            .select()
            .single();

        if (clientErr) {
            console.error(`Error insertando cliente ${contrato}:`, clientErr.message);
            continue;
        }

        // Buscar y vincular beneficiarios
        let relatedBens = [];
        const baseContrato = contrato.toUpperCase();
        
        for (let j = Math.max(0, bHeaderRowIdx) + 1; j < benData.length; j++) {
            const bRow = benData[j];
            const bContratoFull = String(bRow[bIdxContrato] || "").replace(/'/g, "").trim().toUpperCase();
            const bBase = bContratoFull.split(/[-–—_]/)[0].trim();
            
            if (bBase === baseContrato && bContratoFull !== baseContrato) {
                relatedBens.push({
                    client_id: newClient.id,
                    contract_number: bContratoFull,
                    full_name: String(bRow[bIdxNombre]).trim().toUpperCase(),
                    birth_date: bIdxFecha !== -1 ? String(bRow[bIdxFecha]) : "",
                    status: bIdxEstado !== -1 ? String(bRow[bIdxEstado]).toUpperCase() || "ACTIVO" : "ACTIVO"
                });
            }
        }

        // Eliminar duplicados internos de este lote para evitar errores de ON CONFLICT
        relatedBens = relatedBens.filter((v, index, self) =>
          index === self.findIndex((t) => t.contract_number === v.contract_number)
        );

        if (relatedBens.length > 0) {
            const { error: benErr } = await supabase
                .from('beneficiaries')
                .upsert(relatedBens, { onConflict: 'contract_number' });
            if (benErr) console.error(`Error beneficiarios de ${contrato}:`, benErr.message);
        }
        
        if (i % 100 === 0) console.log(`Progreso: ${i - headerRowIdx} filas procesadas...`);
    }
  }

  console.log("\n✅ ¡MIGRACIÓN COMPLETADA CON ÉXITO!");
}

migrate().catch(err => console.error("Error crítico en migración:", err));
