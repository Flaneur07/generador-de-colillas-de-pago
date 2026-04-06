
import * as XLSX from 'xlsx';
import { Client, Beneficiary } from '../types';

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
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: false });
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
  const idxObs = headers.findIndex(h => h.includes("obs") || h.includes("nota"));

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
      observaciones: String(getVal(idxObs)).trim(),
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

export const fetchBeneficiaries = async (sheetId: string): Promise<Beneficiary[]> => {
  // Usamos el GID directo y evitamos la caché
  const hgid = "372521735"; 
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${hgid}&_cb=${Date.now()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const text = await response.text();

    if (text.includes("<!doctype html>") || text.includes("google.com/accounts")) {
      console.warn("[Beneficiaries] Acceso denegado a la hoja de beneficiarios.");
      return [];
    }

    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: false });
    if (!data || data.length === 0) return [];

    // Search for headers
    let headerRowIdx = -1;
    let idxContrato = -1, idxNombre = -1, idxFecha = -1, idxEstado = -1;

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i].map((s: any) => String(s || "").toLowerCase());
      idxContrato = row.findIndex((h: string) => h.includes("contrat") || h.includes("poliza") || h.includes("póliza"));
      idxNombre = row.findIndex((h: string) => h.includes("nombre") || h.includes("apellido") || h.includes("beneficiario"));
      idxFecha = row.findIndex((h: string) => h.includes("nacimien") || h.includes("fecha") || h.includes("f.n"));
      idxEstado = row.findIndex((h: string) => h.includes("estado"));

      if (idxContrato !== -1 && idxNombre !== -1) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
       headerRowIdx = 0;
       const row0 = data[0].map((s: any) => String(s || "").toLowerCase());
       idxContrato = row0.findIndex((h: string) => h.includes("contrato")); 
       idxNombre = row0.findIndex((h: string) => h.includes("nombre") || h.includes("apellido"));
    }

    const beneficiaries: Beneficiary[] = [];
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const contrato = String(row[idxContrato] || "").trim();
      const nombre = String(row[idxNombre] || "").trim();
      if (!nombre || !contrato) continue;

      const rawEstado = idxEstado !== -1 ? String(row[idxEstado] || "").trim() : "";
      
      beneficiaries.push({
        id: `ben-${i}-${Date.now()}`,
        numeroContrato: contrato,
        nombre: nombre,
        fechaNacimiento: String(idxFecha !== -1 ? row[idxFecha] : ""),
        estado: rawEstado || 'ACTIVO'
      });
    }

    return beneficiaries;
  } catch (error) {
    console.error("Error fetching beneficiaries:", error);
    return [];
  }
};

export const syncWithGoogleSheets = async (sheetId: string, targetSheetName: string): Promise<Client[]> => {
  // Evitamos caché en la petición
  let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(targetSheetName)}&_cb=${Date.now()}`;
  
  if (sheetId === "1LclqwFBtLqIW2KOq5pWXYY2EIqR95R6IxIjQJLt4X-k" && targetSheetName.includes("2026")) {
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=1985605679&_cb=${Date.now()}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error de conexión: ${response.status}`);
    const text = await response.text();

    if (text.includes("<!doctype html>") || text.includes("google.com/accounts")) {
      throw new Error("La hoja de cálculo es privada o no existe.");
    }

    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error(`No se pudo leer la hoja.`);

    const clients = processWorksheet(workbook.Sheets[sheetName]);

    // Relacionar beneficiarios para la sede Heliconia
    if (sheetId === "1LclqwFBtLqIW2KOq5pWXYY2EIqR95R6IxIjQJLt4X-k") {
      const beneficiaries = await fetchBeneficiaries(sheetId);
      
      clients.forEach(client => {
        const clientContrato = String(client.numeroContrato).trim().toUpperCase();
        // Extraemos la base: si es "123-A" o "123-0", la base es "123"
        const clientBaseContrato = clientContrato.split(/[-–—_]/)[0].trim();
        
        client.beneficiaries = beneficiaries.filter(b => {
          const benFullContrato = String(b.numeroContrato).trim().toUpperCase();
          const benBaseContrato = benFullContrato.split(/[-–—_]/)[0].trim();
          
          // Un beneficiario coincide si:
          // 1. Tienen la misma base de contrato
          // 2. El contrato completo NO es idéntico (para no ser su propio beneficiario)
          // 3. O el contrato completo del beneficiario contiene el del cliente como base seguido de un guión
          const isSameBase = benBaseContrato === clientBaseContrato;
          const isDifferentFull = benFullContrato !== clientContrato;
          
          return isSameBase && isDifferentFull;
        });
      });
    }

    return clients;
  } catch (error: any) {
    throw new Error(error.message || "Error al sincronizar con Google Sheets.");
  }
};
