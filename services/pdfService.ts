import jsPDF from 'jspdf';
import { Client } from '../types';
import { SiteConfig } from '../config/siteConfigs';
import { formatCurrency, numberToWords } from '../utils/currency';

// Internal function to create the PDF document structure
const createPDFDoc = async (client: Client, siteConfig: SiteConfig, receiptNumber?: string): Promise<jsPDF> => {
  // Configuración para Media Carta (Half Letter): 216mm x 140mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [216, 140]
  });

  // Fonts
  doc.setFont("helvetica", "normal");

  // Layout Constants
  const pageWidth = 216;
  const marginX = 15;
  const contentWidth = 186;
  const centerX = pageWidth / 2;

  // --- Header ---
  // A. Logo (Left)
  try {
    doc.addImage('/logo.png', 'PNG', marginX, 10, 45, 22);
  } catch (e) {
    console.warn("Logo not found", e);
    doc.setTextColor(34, 139, 34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("LA FE", marginX, 22);
  }

  // B. Company Info (Center)
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ORGANIZACIÓN SERVICIOS FUNERARIOS", centerX + 5, 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nit: ${siteConfig.nit} - Régimen Simplificado`, centerX + 5, 17, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 100, 20); // Dark Green
  doc.text(siteConfig.city.toUpperCase(), centerX + 5, 23, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(siteConfig.address.toUpperCase(), centerX + 5, 28, { align: "center" });

  // C. Receipt Number (Right)
  const boxWidth = 42;
  const boxX = (marginX + contentWidth) - boxWidth;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.roundedRect(boxX, 10, boxWidth, 20, 2, 2);

  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE CAJA", boxX + (boxWidth / 2), 15, { align: "center" });

  doc.setFontSize(16);
  doc.setTextColor(220, 20, 60); // Crimson Red
  const displayNum = receiptNumber || "00000";
  doc.text(`No. ${displayNum}`, boxX + (boxWidth / 2), 24, { align: "center" });

  // --- Main Form Body ---
  const startY = 38;
  const rowHeight = 10;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  // Row 1: Fecha | Valor
  doc.rect(marginX, startY, contentWidth, rowHeight);
  doc.line(marginX + 125, startY, marginX + 125, startY + rowHeight);

  doc.setFont("helvetica", "normal");
  doc.text("FECHA:", marginX + 3, startY + 6.5);
  const today = new Date().toLocaleDateString('es-CO');
  doc.setFont("helvetica", "bold");
  doc.text(today, marginX + 22, startY + 6.5);

  doc.setFont("helvetica", "normal");
  doc.text("VALOR: $", marginX + 128, startY + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(formatCurrency(client.valorCompra).replace('$', '').trim(), marginX + 148, startY + 6.5);

  // Row 2: Recibimos de
  doc.setFontSize(10);
  doc.rect(marginX, startY + rowHeight, contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("RECIBIMOS DE:", marginX + 3, startY + rowHeight + 6.5);
  doc.setFont("helvetica", "bold");
  doc.text((client.nombre || "").toUpperCase(), marginX + 35, startY + rowHeight + 6.5);

  // Row 3: La suma de
  doc.rect(marginX, startY + (rowHeight * 2), contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("LA SUMA DE:", marginX + 3, startY + (rowHeight * 2) + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(numberToWords(client.valorCompra).toUpperCase(), marginX + 35, startY + (rowHeight * 2) + 6.5);

  // Row 4: Por concepto de
  doc.setFontSize(10);
  doc.rect(marginX, startY + (rowHeight * 3), contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("POR CONCEPTO:", marginX + 3, startY + (rowHeight * 3) + 6.5);
  doc.setFont("helvetica", "bold");
  const conceptoFinal = client.concepto || "PAGO DE SERVICIOS FUNERARIOS";
  doc.text(conceptoFinal.toUpperCase(), marginX + 35, startY + (rowHeight * 3) + 6.5);

  // Row 5: Contrato Número
  doc.rect(marginX, startY + (rowHeight * 4), contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("CONTRATO / PÓLIZA:", marginX + 3, startY + (rowHeight * 4) + 6.5);
  doc.setFont("helvetica", "bold");
  doc.text(String(client.numeroContrato || ""), marginX + 45, startY + (rowHeight * 4) + 6.5);

  // Row 6: Observaciones
  doc.rect(marginX, startY + (rowHeight * 5), contentWidth, rowHeight * 2);
  doc.setFont("helvetica", "normal");
  doc.text("OBSERVACIONES:", marginX + 3, startY + (rowHeight * 5) + 6.5);

  let obsText = client.observaciones || "";
  if (!obsText) {
    if (client.telefono && client.correo) obsText = `Teléfono: ${client.telefono} - Correo: ${client.correo}`;
    else if (client.telefono) obsText = `Teléfono: ${client.telefono}`;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(obsText, marginX + 40, startY + (rowHeight * 5) + 6.5, { maxWidth: contentWidth - 45 });

  // --- Footer ---
  const footerY = startY + (rowHeight * 7) + 12;

  doc.setLineWidth(0.5);
  doc.setTextColor(0, 0, 0);

  // Left Box: Contact
  doc.roundedRect(marginX, footerY, 110, 20, 2, 2);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("LÍNEAS DE ATENCIÓN:", marginX + 55, footerY + 7, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(siteConfig.phones, marginX + 55, footerY + 14, { align: "center" });

  // Right Box: Signature
  doc.roundedRect(marginX + 115, footerY, contentWidth - 110 - 5, 20, 2, 2);
  doc.line(marginX + 125, footerY + 14, marginX + contentWidth - 10, footerY + 14);
  doc.setFontSize(8);
  doc.text("FIRMA AUTORIZADA", marginX + 115 + (contentWidth - 110 - 5) / 2, footerY + 18, { align: "center" });

  return doc;
};

export const generatePaymentSlip = async (client: Client, siteConfig: SiteConfig, receiptNumber?: string) => {
  const doc = await createPDFDoc(client, siteConfig, receiptNumber);
  const safeName = client.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`Recibo_${safeName}.pdf`);
};

export const getPaymentSlipBase64 = async (client: Client, siteConfig: SiteConfig, receiptNumber?: string): Promise<string> => {
  const doc = await createPDFDoc(client, siteConfig, receiptNumber);
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};