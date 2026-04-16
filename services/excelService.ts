
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
  const normalizeText = (s: any) => 
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.]/g, "")
      .trim();

  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const rowStr = data[i].map(normalizeText).join(" ");
    if ((rowStr.includes("pol") || rowStr.includes("contrat")) && (rowStr.includes("apellido") || rowStr.includes("nombre"))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 0;

  const headers = data[headerRowIdx].map(normalizeText);

  // Diagnóstico de columnas detectadas
  console.log(`[processWorksheet] HeaderRow=${headerRowIdx}, Headers:`, headers);

  const idxPoliza = headers.findIndex(h => 
    h === "no poliza" || 
    h === "contrato" ||
    h.includes("pol") || 
    h.includes("contrato")
  );
  const idxNombre = headers.findIndex(h => h.includes("apellido") || h.includes("nombre") || h.includes("cliente"));
  const idxObs = headers.findIndex(h => h.includes("obs") || h.includes("nota"));

  console.log(`[processWorksheet] idxPoliza=${idxPoliza}, idxNombre=${idxNombre}`);

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

    const poliza = String(getVal(idxPoliza)).replace(/'/g, "").trim();
    // No incluir registros sin número de contrato
    if (!poliza) {
      console.warn(`[processWorksheet] Fila ${i} omitida: nombre='${nombre}' pero sin contrato (idxPoliza=${idxPoliza}). Contenido de la fila:`, row);
      continue;
    }
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
  let url = "";
  
  if (sheetId === "1LclqwFBtLqIW2KOq5pWXYY2EIqR95R6IxIjQJLt4X-k") {
    // Heliconia
    const hgid = "372521735"; 
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${hgid}&_cb=${Date.now()}`;
  } else if (sheetId === "1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8") {
    // Sevilla
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Planilla beneficiarios Sevilla")}&_cb=${Date.now()}`;
  } else if (sheetId === "1MULokQ8jhbjK1Fi1HpWv7YQOh-9yuGpoifHRVvAenu0") {
    // Ebejico: Intentar por nombre primero, si falla usamos GID exacto
    const ebejicoSheetName = encodeURIComponent("Beneficiarios_Ebéjico");
    const ebejicoBenGid = "521965387";
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${ebejicoSheetName}&_cb=${Date.now()}`;
    // Fallback URL con GID en caso de que el nombre falle (se usará si la primera petición falla o devuelve vacío)
  } else {
    return [];
  }

  try {
    let response = await fetch(url);
    let text = await response.text();

    // FALLBACK para Ebéjico: Si el nombre de la hoja no funciona, intentar con GID
    if (sheetId === "1MULokQ8jhbjK1Fi1HpWv7YQOh-9yuGpoifHRVvAenu0" && 
       (text.includes("<!doctype html>") || text.includes("google.com/accounts") || text.length < 50)) {
      console.log("[Beneficiaries] Reintentando Ebéjico con GID...");
      const gidUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=521965387&_cb=${Date.now()}`;
      response = await fetch(gidUrl);
      text = await response.text();
    }

    if (text.includes("<!doctype html>") || text.includes("google.com/accounts")) {
      console.warn("[Beneficiaries] Acceso denegado o error de GID.");
      return [];
    }

    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: false });
    console.log(`[Beneficiaries] Filas encontradas en ${sheetId}: ${data.length}`);
    if (!data || data.length === 0) return [];

    // Search for headers
    let headerRowIdx = -1;
    let idxContrato = -1, idxNombre = -1, idxFecha = -1, idxEstado = -1;

    const normalizeText = (s: any) => 
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.]/g, "")
        .trim();

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i].map(normalizeText);
      idxContrato = row.findIndex((h: string) => 
        h === "no poliza" || 
        h.includes("contrat") || 
        h.includes("poliza") || 
        h.includes("no.") || 
        h.includes("n.")
      );
      idxNombre = row.findIndex((h: string) => h.includes("nombre") || h.includes("apellido") || h.includes("beneficiario") || h.includes("cliente"));
      idxFecha = row.findIndex((h: string) => h.includes("nacimien") || h.includes("fecha") || h.includes("f.n"));
      idxEstado = row.findIndex((h: string) => h.includes("estado"));

      if (idxContrato !== -1 && idxNombre !== -1) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
       headerRowIdx = 0;
       const row0 = data[0].map(normalizeText);
       idxContrato = row0.findIndex((h: string) => h === "no poliza" || h.includes("contrato") || h.includes("poliza")); 
       idxNombre = row0.findIndex((h: string) => h.includes("nombre") || h.includes("apellido") || h.includes("cliente"));
    }

    const beneficiaries: Beneficiary[] = [];
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const contrato = (idxContrato !== -1 && row[idxContrato]) ? String(row[idxContrato]).replace(/'/g, "").trim() : "";
      const nombre = (idxNombre !== -1 && row[idxNombre]) ? String(row[idxNombre]).trim() : "";
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
  const CACHE_KEY = `cached_clients_${sheetId}`;
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(targetSheetName)}&_cb=${Date.now()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo conectar con Google.");
    
    const text = await response.text();
    if (text.includes("<!doctype html>") || text.includes("google.com/accounts")) {
      throw new Error("La hoja de cálculo es privada o no existe.");
    }

    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error(`No se pudo leer la hoja.`);

    const clients = processWorksheet(workbook.Sheets[sheetName]);

    // Relacionar beneficiarios para las sedes que lo soportan
    if (["1LclqwFBtLqIW2KOq5pWXYY2EIqR95R6IxIjQJLt4X-k", "1OFb8M6XawHArv8KyyxaeYUfpj1gS5vakdvCVrtgY2e8", "1MULokQ8jhbjK1Fi1HpWv7YQOh-9yuGpoifHRVvAenu0"].includes(sheetId)) {
      try {
        const beneficiaries = await fetchBeneficiaries(sheetId);
        clients.forEach(client => {
          const cleanForMatch = (s: any) => {
            if (!s) return "";
            return String(s).replace(/[^a-zA-Z0-9]/g, "").trim().toUpperCase();
          };
          
          const clientContrato = String(client.numeroContrato).replace(/'/g, "").trim().toUpperCase();
          const clientBaseContrato = clientContrato.split(/[-–—_]/)[0].trim();
          const clientMatch = cleanForMatch(clientBaseContrato);
          
          client.beneficiaries = beneficiaries.filter(b => {
             const benFullContrato = String(b.numeroContrato).replace(/'/g, "").trim().toUpperCase();
             const benBaseContrato = benFullContrato.split(/[-–—_]/)[0].trim();
             const benMatch = cleanForMatch(benBaseContrato);
             return benMatch === clientMatch && benFullContrato !== clientContrato;
          });
        });
      } catch (benErr) {
        console.warn("[Sync] No se pudieron cargar beneficiarios (posiblemente offline)", benErr);
      }
    }

    // Guardar en caché local para uso offline
    localStorage.setItem(CACHE_KEY, JSON.stringify(clients));
    return clients;
  } catch (err: any) {
    console.warn(`[Sync] Fallo de red. Intentando cargar caché local para ${sheetId}`);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    throw new Error(err.message || "Error al sincronizar con Google Sheets.");
  }
};
