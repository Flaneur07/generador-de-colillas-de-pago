export interface Beneficiary {
  id: string; // Internal id for tracking
  numeroContrato: string;
  nombre: string;
  fechaNacimiento: string;
  estado: string;
}

export interface Client {
  id: string; // Generated unique ID for internal tracking
  nombre: string;
  cedula: string | number;
  telefono: string | number;
  correo: string;
  valorCompra: number; // Represents the default or current month value
  concepto: string;
  numeroContrato: string | number;
  observaciones: string;
  payments: Record<string, number>; // Stores values for 'ene', 'feb', etc.
  beneficiaries?: Beneficiary[];
}

export interface RawExcelRow {
  Nombre?: string;
  nombre?: string;
  "Recibimos de"?: string;
  
  Cedula?: string | number;
  cedula?: string | number;
  "Cédula"?: string | number;
  
  Telefono?: string | number;
  telefono?: string | number;
  "Teléfono"?: string | number;
  
  Correo?: string;
  correo?: string;
  Email?: string;
  email?: string;
  
  Valor?: number | string;
  valor?: number | string;
  "Valor Compra"?: number | string;
  "Valor de la compra"?: number | string;
  
  Concepto?: string;
  concepto?: string;
  "Por concepto de"?: string;
  
  Contrato?: string | number;
  contrato?: string | number;
  "Contrato Número"?: string | number;
  "Numero Contrato"?: string | number;
  
  Observaciones?: string;
  observaciones?: string;
}