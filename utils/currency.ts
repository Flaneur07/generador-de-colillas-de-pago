export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const convertToText = (value: number): string => {
  const unidades = ["", "UN ", "DOS ", "TRES ", "CUATRO ", "CINCO ", "SEIS ", "SIETE ", "OCHO ", "NUEVE "];
  const decenas = ["DIEZ ", "ONCE ", "DOCE ", "TRECE ", "CATORCE ", "QUINCE ", "DIECISEIS ", "DIECISIETE ", "DIECIOCHO ", "DIECINUEVE ", "VEINTE ", "TREINTA ", "CUARENTA ", "CINCUENTA ", "SESENTA ", "SETENTA ", "OCHENTA ", "NOVENTA "];
  const centenas = ["", "CIENTO ", "DOSCIENTOS ", "TRESCIENTOS ", "CUATROCIENTOS ", "QUINIENTOS ", "SEISCIENTOS ", "SETECIENTOS ", "OCHOCIENTOS ", "NOVECIENTOS "];

  if (value === 0) return "";

  let text = "";

  if (value >= 1000000) {
    const millions = Math.floor(value / 1000000);
    text += (millions === 1 ? "UN MILLÓN " : convertToText(millions).trim() + " MILLONES ");
    value %= 1000000;
  }

  if (value >= 1000) {
    const thousands = Math.floor(value / 1000);
    if (thousands === 1) text += "MIL ";
    else text += convertToText(thousands).trim() + " MIL ";
    value %= 1000;
  }

  if (value >= 100) {
    if (value === 100) text += "CIEN ";
    else text += centenas[Math.floor(value / 100)];
    value %= 100;
  }

  if (value >= 20) {
    const dec = Math.floor(value / 10);
    // decenas array mapping: 0->10...9->19, 10->20, 11->30...
    // logic used: dec + 8.
    // 20 -> dec=2. 2+8=10. decenas[10]="VEINTE ". Correct.
    // 30 -> dec=3. 3+8=11. decenas[11]="TREINTA ". Correct.
    
    if (value % 10 === 0) {
       text += decenas[dec + 8];
    } else {
       if (dec === 2) text += "VEINTI" + unidades[value % 10]; // e.g. VEINTIUNO
       else text += decenas[dec + 8] + "Y " + unidades[value % 10];
    }
  } else if (value >= 10) {
    text += decenas[value - 10];
  } else if (value > 0) {
    text += unidades[value];
  }
  
  return text;
};

// Basic function to convert numbers to text (Spanish)
export const numberToWords = (value: number): string => {
  if (value === 0) return "CERO PESOS";
  
  const text = convertToText(value);
  // Remove multiple spaces and ensure uppercase. Append standard currency name without abbreviation.
  return text.replace(/\s+/g, ' ').trim().toUpperCase() + " PESOS";
};