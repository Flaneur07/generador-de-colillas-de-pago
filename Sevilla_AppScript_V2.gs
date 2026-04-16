/* 
 * APP SCRIPT V2.3 - SEDE SEVILLA (CORRECCIÓN DE ESTADOS)
 * INCLUYE: Mapeo de F. NACIMIENTO y Selección de Estados Real
 */

function doPost(e) {
  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LOGS_APP");
  if (!logSheet) {
    logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("LOGS_APP");
    logSheet.appendRow(["Fecha", "Acción", "Sede", "Poliza", "Detalle"]);
  }

  function log(action, poliza, detail) {
    logSheet.appendRow([new Date(), action, "Sevilla", "'" + poliza, detail]);
  }

  function response(msg) {
    return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var targetPoliza = String(data.poliza).replace(/'/g, "").trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. CONFIGURACIÓN HOJA PRINCIPAL
    var sheet = ss.getSheetByName("Planilla Pagos") || ss.getSheets()[0]; 
    if (!sheet) return response("Error: Hoja 'Planilla Pagos' no encontrada");

    var allV = sheet.getRange(1, 1, Math.min(20, sheet.getLastRow()), sheet.getLastColumn()).getValues();
    var headerRowIdx = -1, headers = null;
    for (var r = 0; r < allV.length; r++) {
      var rowJoined = allV[r].join("").toLowerCase();
      if ((rowJoined.includes("contrato") || rowJoined.includes("poliza")) && (rowJoined.includes("nombre") || rowJoined.includes("apellido"))) {
        headerRowIdx = r;
        headers = allV[r];
        break;
      }
    }

    if (headerRowIdx === -1) return response("Error: No se detectaron encabezados");

    var colPolizaIdx = -1, colNombreIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      if (colPolizaIdx === -1 && (h === "contrato" || h.includes("contrato") || h.includes("poliza"))) colPolizaIdx = i;
      if (colNombreIdx === -1 && (h.includes("nombre") || h.includes("apellido") || h.includes("cliente"))) colNombreIdx = i;
    }

    // ACCIÓN: CREAR CLIENTE
    if (action === 'create') {
      if (colPolizaIdx === -1) return response("Error: Columna Contrato no encontrada");
      var newRow = new Array(headers.length).fill("");
      if (colNombreIdx != -1) newRow[colNombreIdx] = (data.nombre || "").toUpperCase();
      if (colPolizaIdx != -1) newRow[colPolizaIdx] = targetPoliza;
      sheet.appendRow(newRow);
      var lastR = sheet.getLastRow();
      sheet.getRange(lastR, colPolizaIdx + 1).setNumberFormat("@");
      log(action, targetPoliza, "OK: Creado titular");
      return response("OK");
    }

    // BUSCAR FILA DEL CLIENTE
    var dataRangeValues = sheet.getRange(headerRowIdx + 1, 1, sheet.getLastRow() - headerRowIdx, headers.length).getValues();
    var rowFoundIdx = -1;
    for (var r = 1; r < dataRangeValues.length; r++) {
      var val = String(dataRangeValues[r][colPolizaIdx]).replace(/'/g, "").trim();
      if (val === targetPoliza) {
        rowFoundIdx = headerRowIdx + r + 1;
        break;
      }
    }

    if (rowFoundIdx === -1 && action.indexOf('beneficiary') === -1) {
      return response("Error: Cliente no encontrado");
    }

    // ACCIÓN: ACTUALIZAR PAGO
    if (action === 'update') {
      var targetMonth = String(data.month).toLowerCase().trim().substring(0, 3);
      var colMonthIdx = -1;
      for (var k = 0; k < headers.length; k++) {
        if (String(headers[k]).toLowerCase().trim().startsWith(targetMonth)) {
          colMonthIdx = k + 1;
          break;
        }
      }
      if (colMonthIdx === -1) return response("Error: Mes '" + targetMonth + "' no detectado");
      sheet.getRange(rowFoundIdx, colMonthIdx).setValue(data.value);
      return response("OK");
    }

    // ACCIÓN: ELIMINAR TITULAR
    if (action === 'delete') {
      sheet.deleteRow(rowFoundIdx);
      var bSheet = ss.getSheetByName("Planilla beneficiarios Sevilla");
      if (bSheet) {
        var bV = bSheet.getDataRange().getDisplayValues();
        var bColContIdx = -1;
        for (var j = 0; j < bV[0].length; j++) {
           var bh = String(bV[0][j]).toLowerCase().trim();
           if (bh.includes("contrato") || bh.includes("poliza")) bColContIdx = j;
        }
        if (bColContIdx !== -1) {
           for (var br = bV.length - 1; br >= 1; br--) {
              var c = String(bV[br][bColContIdx]).replace(/'/g, "").trim();
              if (c === targetPoliza || c.split("-")[0] === targetPoliza) {
                 bSheet.deleteRow(br + 1);
              }
           }
        }
      }
      return response("OK");
    }

    // ACCIÓN: BENEFICIARIOS
    if (action.indexOf('beneficiary') !== -1) {
      var bSheet = ss.getSheetByName("Planilla beneficiarios Sevilla");
      if (!bSheet) return response("Error: Hoja beneficiarios no encontrada");
      
      var bValues = bSheet.getDataRange().getDisplayValues();
      var bHeaders = bValues[0];
      var bColContIdx = -1, bColEstIdx = -1, bColNomIdx = -1, bColFecIdx = -1;
      
      for (var j = 0; j < bHeaders.length; j++) {
        var bh = String(bHeaders[j]).toLowerCase().trim();
        if (bh.includes("contrato") || bh.includes("poliza")) bColContIdx = j;
        if (bh.includes("estado")) bColEstIdx = j;
        if (bh.includes("nombre") || bh.includes("apellido")) bColNomIdx = j;
        if (bh.includes("nacimiento") || bh.includes("f.n") || bh === "f. nacimiento") bColFecIdx = j;
      }

      if (action === 'add_beneficiary') {
        var newBRow = new Array(bHeaders.length).fill("");
        if (bColNomIdx != -1) newBRow[bColNomIdx] = (data.nombre || "").toUpperCase();
        if (bColContIdx != -1) newBRow[bColContIdx] = data.beneficiarioContrato;
        if (bColEstIdx != -1) newBRow[bColEstIdx] = (data.estado || "ACTIVO").toUpperCase();
        if (bColFecIdx != -1) newBRow[bColFecIdx] = data.fechaNacimiento || "";
        
        bSheet.appendRow(newBRow);
        bSheet.getRange(bSheet.getLastRow(), bColContIdx + 1).setNumberFormat("@");
        log(action, targetPoliza, "OK: Beneficiario añadido");
        return response("OK");
      }

      var subPoliza = String(data.beneficiarioContrato).replace(/'/g, "").trim();
      var bRowIdx = -1;
      for (var r = 1; r < bValues.length; r++) {
        if (String(bValues[r][bColContIdx]).replace(/'/g, "").trim() === subPoliza) {
          bRowIdx = r + 1;
          break;
        }
      }

      if (bRowIdx === -1) return response("Error: Beneficiario no encontrado");

      // MODIFICACIÓN CRÍTICA: Ahora usa el estado que viene de la App
      if (action === 'toggle_beneficiary') {
        var newStatus = data.estado ? data.estado.toUpperCase() : "ACTIVO";
        
        // Si no se envía estado (fallback), hace el toggle clásico
        if (!data.estado) {
          var currentS = String(bValues[bRowIdx-1][bColEstIdx]).toUpperCase();
          newStatus = (currentS === "ACTIVO") ? "RETIRADO" : "ACTIVO";
        }
        
        bSheet.getRange(bRowIdx, bColEstIdx + 1).setValue(newStatus);
        log(action, subPoliza, "Nuevo Estado: " + newStatus);
        return response("OK");
      }
      
      if (action === 'delete_beneficiary') {
        bSheet.deleteRow(bRowIdx);
        return response("OK");
      }
    }

    return response("Error: Acción desconocida");

  } catch (err) {
    return response("Error Crítico: " + err.toString());
  }
}
