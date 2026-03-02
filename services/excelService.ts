
import * as XLSX from 'xlsx';
import { Client } from '../types';

// ID de la nueva hoja de cálculo proporcionada por el usuario
export const DEFAULT_SHEET_ID = "1MULokQ8jhbjK1Fi1HpWv7YQOh-9yuGpoifHRVvAenu0";

// Helper to clean numeric values
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

const getCurrentMonthKey = (): string => {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const currentMonthIdx = new Date().getMonth();
  return months[currentMonthIdx].toLowerCase();
};

const processWorksheet = (sheet: XLSX.WorkSheet): Client[] => {
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (!data || data.length === 0) return [];

  let headerRowIdx = -1;
  const normalize = (s: any) => String(s || "").toLowerCase().trim();

  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const rowStr = data[i].map(normalize).join(" ");
    if (rowStr.includes("pol") && (rowStr.includes("apellido") || rowStr.includes("nombre"))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 0;

  const headers = data[headerRowIdx].map(normalize);
  const idxPoliza = headers.findIndex(h => h.includes("pol") || h.includes("no.") || h.includes("contrato"));
  const idxNombre = headers.findIndex(h => h.includes("apellido") || h.includes("nombre"));

  const monthMap = [
    { key: "Ene", variations: ["ene", "enero"] },
    { key: "Feb", variations: ["feb", "febrero"] },
    { key: "Mar", variations: ["mar", "marzo", "marz"] },
    { key: "Abr", variations: ["abr", "abril"] },
    { key: "May", variations: ["may", "mayo"] },
    { key: "Jun", variations: ["jun", "junio"] },
    { key: "Jul", variations: ["jul", "julio"] },
    { key: "Ago", variations: ["ago", "agosto", "agos"] },
    { key: "Sep", variations: ["sep", "septiembre", "sept"] },
    { key: "Oct", variations: ["oct", "octubre", "octu"] },
    { key: "Nov", variations: ["nov", "noviembre"] },
    { key: "Dic", variations: ["dic", "diciembre"] },
  ];

  const monthIndices: Record<string, number> = {};
  monthMap.forEach(m => {
    const idx = headers.findIndex(h => m.variations.some(v => h.startsWith(v)));
    if (idx !== -1) {
      monthIndices[m.key] = idx;
    }
  });

  const currentMonthKey = getCurrentMonthKey();
  const currentMonthDisplay = monthMap.find(m => m.variations.includes(currentMonthKey))?.key || "Ene";

  const clients: Client[] = [];

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const getVal = (idx: number) => (idx >= 0 && row[idx] !== undefined) ? row[idx] : "";
    const nombre = String(getVal(idxNombre)).trim();
    if (!nombre) continue;

    const poliza = String(getVal(idxPoliza)).trim();
    const payments: Record<string, number> = {};
    monthMap.forEach(m => {
      if (monthIndices[m.key] !== undefined) {
        const raw = getVal(monthIndices[m.key]);
        payments[m.key] = cleanNumber(raw);
      } else {
        payments[m.key] = 0;
      }
    });

    const valor = payments[currentMonthDisplay] || 0;
    const concepto = `Mensualidad ${currentMonthDisplay} 2026`;

    clients.push({
      id: `row-${i}-${Date.now()}`,
      nombre: nombre,
      cedula: poliza,
      telefono: "",
      correo: "",
      valorCompra: valor,
      concepto: concepto,
      numeroContrato: poliza,
      observaciones: "",
      payments: payments
    });
  }

  return clients;
};

export const parseExcelFile = async (file: File | Blob): Promise<Client[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject(new Error("No data read from file"));
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        resolve(processWorksheet(workbook.Sheets[sheetName]));
      } catch (error) { reject(error); }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const syncWithGoogleSheets = async (sheetId: string, targetSheetName: string): Promise<Client[]> => {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(targetSheetName)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error de conexión: ${response.status}`);
    const text = await response.text();

    if (text.includes("<!doctype html>") || text.includes("google.com/accounts")) {
      throw new Error("La hoja de cálculo es privada o no existe.");
    }

    const workbook = XLSX.read(text, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error(`No se pudo leer la hoja.`);

    return processWorksheet(workbook.Sheets[sheetName]);
  } catch (error: any) {
    throw new Error(error.message || "Error al sincronizar con Google Sheets.");
  }
};
