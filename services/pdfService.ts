import jsPDF from 'jspdf';
import { Client } from '../types';
import { SiteConfig } from '../config/siteConfigs';
import { formatCurrency, numberToWords } from '../utils/currency';
import { LOGO_BASE64 } from '../assets/logo';

// Internal function to create the PDF document structure
const createPDFDoc = async (client: Client, siteConfig: SiteConfig, receiptNumber?: string): Promise<jsPDF> => {
  // Configuración para Media Carta (Half Letter): 216mm x 140mm
  // Layout vertical: header(7→30) + form(34→98) + gap(5) + footer(17) = ~120mm → ~20mm bottom margin
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [216, 140]
  });

  doc.setFont("helvetica", "normal");

  // Layout Constants
  const pageWidth = 216;
  const marginX = 12;
  const contentWidth = 192; // pageWidth - 2*marginX
  const centerX = pageWidth / 2;

  // ─── HEADER ────────────────────────────────────────────────────────────────
  // A. Logo (Left)
  try {
    doc.addImage(LOGO_BASE64, 'PNG', marginX, 7, 40, 20);
  } catch (e) {
    console.warn("Logo not found", e);
    doc.setTextColor(34, 139, 34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("LA FE", marginX, 19);
  }

  // B. Company Info (Center)
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(siteConfig.orgName, centerX + 5, 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Nit: ${siteConfig.nit} - Régimen Simplificado`, centerX + 5, 16, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 100, 20);
  doc.text(siteConfig.city.toUpperCase(), centerX + 5, 21, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(siteConfig.address.toUpperCase(), centerX + 5, 26, { align: "center" });

  // C. Receipt Number Box (Right)
  const boxWidth = 40;
  const boxX = marginX + contentWidth - boxWidth;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.roundedRect(boxX, 7, boxWidth, 19, 2, 2);

  doc.setFontSize(6.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE CAJA", boxX + boxWidth / 2, 12, { align: "center" });

  doc.setFontSize(15);
  doc.setTextColor(220, 20, 60);
  const displayNum = receiptNumber || "00000";
  doc.text(`No. ${displayNum}`, boxX + boxWidth / 2, 21, { align: "center" });

  // ─── FORM BODY ─────────────────────────────────────────────────────────────
  const startY = 32;
  const rowHeight = 8;
  const textOffset = 5.4; // vertical center within each row

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  // Row 1: Fecha | Valor
  doc.rect(marginX, startY, contentWidth, rowHeight);
  doc.line(marginX + 125, startY, marginX + 125, startY + rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("FECHA:", marginX + 2, startY + textOffset);
  const today = new Date().toLocaleDateString('es-CO');
  doc.setFont("helvetica", "bold");
  doc.text(today, marginX + 19, startY + textOffset);
  doc.setFont("helvetica", "normal");
  doc.text("VALOR: $", marginX + 128, startY + textOffset);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(formatCurrency(client.valorCompra).replace('$', '').trim(), marginX + 148, startY + textOffset);

  // Row 2: Recibimos de
  doc.setFontSize(9);
  doc.rect(marginX, startY + rowHeight, contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("RECIBIMOS DE:", marginX + 2, startY + rowHeight + textOffset);
  doc.setFont("helvetica", "bold");
  doc.text((client.nombre || "").toUpperCase(), marginX + 32, startY + rowHeight + textOffset);

  // Row 3: La suma de
  doc.rect(marginX, startY + rowHeight * 2, contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("LA SUMA DE:", marginX + 2, startY + rowHeight * 2 + textOffset);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(numberToWords(client.valorCompra).toUpperCase(), marginX + 30, startY + rowHeight * 2 + textOffset);

  // Row 4: Por concepto de
  doc.setFontSize(9);
  doc.rect(marginX, startY + rowHeight * 3, contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("POR CONCEPTO:", marginX + 2, startY + rowHeight * 3 + textOffset);
  doc.setFont("helvetica", "bold");
  const conceptoFinal = client.concepto || "PAGO DE SERVICIOS FUNERARIOS";
  doc.text(conceptoFinal.toUpperCase(), marginX + 32, startY + rowHeight * 3 + textOffset);

  // Row 5: Contrato / Póliza
  doc.rect(marginX, startY + rowHeight * 4, contentWidth, rowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("CONTRATO / PÓLIZA:", marginX + 2, startY + rowHeight * 4 + textOffset);
  doc.setFont("helvetica", "bold");
  doc.text(String(client.numeroContrato || ""), marginX + 42, startY + rowHeight * 4 + textOffset);

  // Rows 6-7: Observaciones (double height = 16mm)
  doc.rect(marginX, startY + rowHeight * 5, contentWidth, rowHeight * 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("OBSERVACIONES:", marginX + 2, startY + rowHeight * 5 + textOffset);

  let obsText = client.observaciones || "";
  if (!obsText) {
    if (client.telefono && client.correo) obsText = `Teléfono: ${client.telefono} - Correo: ${client.correo}`;
    else if (client.telefono) obsText = `Teléfono: ${client.telefono}`;
  }
  if (obsText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const wrappedObs = doc.splitTextToSize(obsText, contentWidth - 42);
    doc.text(wrappedObs, marginX + 36, startY + rowHeight * 5 + textOffset);
  }

  // Row 8: Grupo Familiar (optional)
  let extraRows = 0;
  if (client.beneficiaries && client.beneficiaries.length > 0) {
    extraRows = 1;
    doc.setTextColor(0, 0, 0);
    doc.rect(marginX, startY + rowHeight * 7, contentWidth, rowHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("GRUPO FAMILIAR:", marginX + 2, startY + rowHeight * 7 + textOffset);
    const benText = `ESTE CONTRATO CUENTA CON ${client.beneficiaries.length} ${client.beneficiaries.length === 1 ? 'BENEFICIARIO ASOCIADO' : 'BENEFICIARIOS ASOCIADOS'}.`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(benText, marginX + 30, startY + rowHeight * 7 + textOffset);
  }

  // ─── FOOTER ────────────────────────────────────────────────────────────────
  // footerY after 8 rows (or 9 with grupo familiar) + 5mm gap
  const footerY = startY + rowHeight * 7 + extraRows * rowHeight + 5;
  const footerH = 17;

  doc.setLineWidth(0.5);
  doc.setTextColor(0, 0, 0);

  // Left Box: Contact info
  doc.roundedRect(marginX, footerY, 112, footerH, 2, 2);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("LÍNEAS DE ATENCIÓN:", marginX + 56, footerY + 6, { align: "center" });
  doc.setFontSize(9);
  doc.text(siteConfig.phones, marginX + 56, footerY + 12.5, { align: "center" });

  // Right Box: Signature
  const sigBoxX = marginX + 116;
  const sigBoxW = contentWidth - 116;
  doc.roundedRect(sigBoxX, footerY, sigBoxW, footerH, 2, 2);
  doc.line(sigBoxX + 5, footerY + 12, sigBoxX + sigBoxW - 5, footerY + 12);
  doc.setFontSize(7.5);
  doc.text("FIRMA AUTORIZADA", sigBoxX + sigBoxW / 2, footerY + 15.5, { align: "center" });

  return doc;
};

export const generatePaymentSlip = async (client: Client, siteConfig: SiteConfig, receiptNumber?: string) => {
  const doc = await createPDFDoc(client, siteConfig, receiptNumber);
  const safeName = client.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`Recibo_${safeName}.pdf`);
};

export const printPaymentSlip = async (client: Client, siteConfig: SiteConfig, receiptNumber?: string) => {
  const doc = await createPDFDoc(client, siteConfig, receiptNumber);

  // Use blob URL for best print dialog compatibility
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
};

export const getPaymentSlipBase64 = async (client: Client, siteConfig: SiteConfig, receiptNumber?: string): Promise<string> => {
  const doc = await createPDFDoc(client, siteConfig, receiptNumber);
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};