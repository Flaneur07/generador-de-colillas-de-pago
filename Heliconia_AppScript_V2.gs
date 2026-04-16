/* 
 * APP SCRIPT V2 - SEDE HELICONIA 
 * TABLAS: "2026" y "Beneficiarios_Heliconia"
 * LOGS: Pestaña "LOGS_APP"
 */

function doPost(e) {
  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LOGS_APP");
  if (!logSheet) {
    logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("LOGS_APP");
    logSheet.appendRow(["Fecha", "Acción", "Sede", "Poliza", "Detalle"]);
  }

  function log(action, poliza, detail) {
    logSheet.appendRow([new Date(), action, "Heliconia", "'" + poliza, detail]);
  }

  function response(msg) {
    return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var targetPoliza = String(data.poliza).replace(/'/g, "").trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // TABLA PRINCIPAL HELICONIA
    var sheet = ss.getSheetByName("2026") || ss.getSheets()[0]; 
    if (!sheet) return response("Error: Hoja '2026' no encontrada");

    // Detección dinámica de filas y columnas (Heliconia)
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

    // Mapeo dinámico de columnas
    var colPolizaIdx = -1, colNombreIdx = -1, colObsIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      if (colPolizaIdx === -1 && (h === "contrato" || h.includes("contrato") || h.includes("poliza"))) colPolizaIdx = i;
      if (colNombreIdx === -1 && (h.includes("nombre") || h.includes("apellido") || h.includes("cliente"))) colNombreIdx = i;
      if (colObsIdx === -1 && (h.includes("obs") || h.includes("nota"))) colObsIdx = i;
    }

    // ACCIÓN: CREAR CLIENTE
    if (action === 'create') {
      if (colPolizaIdx === -1) return response("Error: Columna Contrato no encontrada");
      var newRow = new Array(headers.length).fill("");
      if (colNombreIdx != -1) newRow[colNombreIdx] = (data.nombre || "").toUpperCase();
      sheet.appendRow(newRow);
      var lastR = sheet.getLastRow();
      sheet.getRange(lastR, colPolizaIdx + 1).setNumberFormat("@").setValue(targetPoliza);
      log(action, targetPoliza, "OK: Creado en fila " + lastR);
      return response("OK");
    }

    // BUSCAR FILA DEL CLIENTE (Heliconia)
    var dataRangeValues = sheet.getRange(headerRowIdx + 1, 1, sheet.getLastRow() - headerRowIdx, headers.length).getValues();
    var rowFoundIdx = -1;
    for (var r = 1; r < dataRangeValues.length; r++) {
      var val = String(dataRangeValues[r][colPolizaIdx]).replace(/'/g, "").trim();
      if (val === targetPoliza) {
        rowFoundIdx = headerRowIdx + r + 1;
        break;
      }
    }

    if (rowFoundIdx === -1 && action !== 'add_beneficiary') {
      log(action, targetPoliza, "Error: Cliente no encontrado en '2026'");
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
      log(action, targetPoliza, "OK: Pago " + targetMonth + " =" + data.value);
      return response("OK");
    }

    // ACCIÓN: ELIMINAR TITULAR (+ CASCADA BENEFICIARIOS)
    if (action === 'delete') {
      sheet.deleteRow(rowFoundIdx);
      
      // Borrado en cascada (Heliconia)
      var bSheet = ss.getSheetByName("Beneficiarios_Heliconia");
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
      log(action, targetPoliza, "OK: Titular y beneficiarios eliminados");
      return response("OK");
    }

    // --- SECCIÓN BENEFICIARIOS HELICONIA ---
    if (action.indexOf('beneficiary') !== -1) {
      var bSheet = ss.getSheetByName("Beneficiarios_Heliconia");
      if (!bSheet) return response("Error: Pestaña Beneficiarios_Heliconia no encontrada");
      
      var bValues = bSheet.getDataRange().getDisplayValues();
      var bHeaders = bValues[0];
      var bColContratoIdx = -1, bColEstadoIdx = -1, bColNombreIdx = -1;
      
      for (var j = 0; j < bHeaders.length; j++) {
        var bh = String(bHeaders[j]).toLowerCase().trim();
        if (bh.includes("contrato") || bh.includes("poliza")) bColContratoIdx = j;
        if (bh.includes("estado")) bColEstadoIdx = j;
        if (bh.includes("nombre") || bh.includes("apellido")) bColNombreIdx = j;
      }

      if (action === 'add_beneficiary') {
        var newBRow = new Array(bHeaders.length).fill("");
        if (bColNombreIdx != -1) newBRow[bColNombreIdx] = (data.nombre || "").toUpperCase();
        if (bColEstadoIdx != -1) newBRow[bColEstadoIdx] = "ACTIVO";
        bSheet.appendRow(newBRow);
        bSheet.getRange(bSheet.getLastRow(), bColContratoIdx + 1).setNumberFormat("@").setValue(data.beneficiarioContrato);
        log(action, targetPoliza, "OK: Ben añadido: " + data.beneficiarioContrato);
        return response("OK");
      }

      var targetBenPol = String(data.beneficiarioContrato).replace(/'/g, "").trim();
      var bRowFound = -1;
      for (var r = 1; r < bValues.length; r++) {
        if (String(bValues[r][bColContratoIdx]).replace(/'/g, "").trim() === targetBenPol) {
          bRowFound = r + 1;
          break;
        }
      }

      if (bRowFound === -1) return response("Error: Beneficiario no encontrado");

      if (action === 'toggle_beneficiary') {
        var currentS = String(bValues[bRowFound-1][bColEstadoIdx]).toUpperCase();
        var newS = (currentS === "ACTIVO") ? "RETIRADO" : "ACTIVO";
        bSheet.getRange(bRowFound, bColEstadoIdx + 1).setValue(newS);
        log(action, targetBenPol, "OK: Estado -> " + newS);
        return response("OK");
      }

      if (action === 'delete_beneficiary') {
        bSheet.deleteRow(bRowFound);
        log(action, targetBenPol, "OK: Beneficiario eliminado");
        return response("OK");
      }
    }

    return response("Error: Acción no reconocida");

  } catch (error) {
    var errSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LOGS_APP");
    if (errSheet) errSheet.appendRow([new Date(), "CRITICAL_ERROR", "Heliconia", "SYSTEM", error.toString()]);
    return response("Error: " + error.toString());
  }
}
