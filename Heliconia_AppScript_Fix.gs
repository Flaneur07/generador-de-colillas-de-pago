function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action; 
    var targetPoliza = String(data.poliza).trim();
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // PARA HELICONIA:
    var sheet = ss.getSheetByName("2026") || ss.getSheets()[0]; 
    if (!sheet) return response("Error: Hoja '2026' no encontrada");

    var values = sheet.getDataRange().getDisplayValues();
    var headers = values[0];
    var headerRowIdx = 0;
    
    for (var r = 0; r < Math.min(15, values.length); r++) {
      var rowStr = values[r].join(" ").toLowerCase();
      if ((rowStr.includes("contrato") || rowStr.includes("poliza")) && (rowStr.includes("nombre") || rowStr.includes("apellido"))) {
        headers = values[r];
        headerRowIdx = r;
        break;
      }
    }
    
    var colPolizaIdx = -1;
    var colNombreIdx = -1;
    var colObsIdx = -1;

    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      if (h === "contrato" || h === "n° contrato" || h === "no. contrato" || h === "poliza") {
        colPolizaIdx = i;
      } else if (colPolizaIdx == -1 && (h.includes("pol") || h.includes("no."))) {
        colPolizaIdx = i;
      }
      if (h.includes("nombre") || h.includes("apellido") || h.includes("cliente")) {
        colNombreIdx = i;
      }
      if (h.includes("obs") || h.includes("nota")) {
        colObsIdx = i;
      }
    }

    if (colPolizaIdx == -1) return response("Error: Columna 'contrato' no encontrada. Revisa los títulos en Excel.");

    if (action === 'create') {
      for (var r = headerRowIdx + 1; r < values.length; r++) {
        if (String(values[r][colPolizaIdx]).trim() === targetPoliza) {
          return response("Error: El contrato ya existe");
        }
      }

      var newRow = new Array(headers.length).fill("");
      // Eliminada la comilla que corrompía la celda.
      newRow[colPolizaIdx] = targetPoliza; 
      if (colNombreIdx != -1) newRow[colNombreIdx] = (data.nombre || "").toUpperCase();
      
      sheet.appendRow(newRow);
      // Forzar formato de texto plano para evitar conversión a fecha
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, colPolizaIdx + 1).setNumberFormat("@").setValue(targetPoliza);

      return response("OK: Cliente creado");

    } else {
      var rowFoundIdx = -1;
      for (var r = headerRowIdx + 1; r < values.length; r++) {
        if (String(values[r][colPolizaIdx]).trim() === targetPoliza) {
          rowFoundIdx = r + 1; 
          break;
        }
      }

      if (rowFoundIdx === -1) return response("Error: Contrato no encontrado: " + targetPoliza);

      if (action === 'delete') {
        sheet.deleteRow(rowFoundIdx);
        return response("OK: Cliente eliminado");
      } 
      
      if (action === 'update') {
        var targetMonth = data.month;
        var newValue = data.value;
        var colMonthIdx = -1;
        
        if (targetMonth) {
          for (var k = 0; k < headers.length; k++) {
            var hMonth = String(headers[k]).toLowerCase().trim();
            if (hMonth.startsWith(targetMonth.toLowerCase()) || 
                (targetMonth.toLowerCase() === "jun" && hMonth === "junio") ||
                (targetMonth.toLowerCase() === "jul" && hMonth === "julio")) {
              colMonthIdx = k + 1;
              break;
            }
          }
        }
        
        if (colMonthIdx != -1 && newValue !== undefined) {
          sheet.getRange(rowFoundIdx, colMonthIdx).setValue(newValue);
        }

        if (colObsIdx != -1 && data.observaciones !== undefined) {
          sheet.getRange(rowFoundIdx, colObsIdx + 1).setValue(data.observaciones);
        }

        return response("OK: Datos actualizados");
      }

      // -- BENEFICIARIOS --
      if (action === 'add_beneficiary' || action === 'delete_beneficiary' || action === 'toggle_beneficiary') {
        var benSheet = ss.getSheetByName("Beneficiarios_Heliconia");
        if (!benSheet) return response("Error: Hoja 'Beneficiarios_Heliconia' no encontrada");
        
        var benValues = benSheet.getDataRange().getDisplayValues(); // Fundamental para no leer fechas
        var benHeaders = benValues[0];
        var benHeaderRowIdx = 0;
        
        for (var br = 0; br < Math.min(15, benValues.length); br++) {
          var bRowStr = benValues[br].join(" ").toLowerCase();
          if ((bRowStr.includes("contrato") || bRowStr.includes("poliza")) && (bRowStr.includes("nombre") || bRowStr.includes("apellido"))) {
            benHeaders = benValues[br];
            benHeaderRowIdx = br;
            break;
          }
        }
        
        var colBenContratoIdx = -1;
        var colBenNombreIdx = -1;
        var colBenFechaIdx = -1;
        var colBenEstadoIdx = -1;
        
        for (var j = 0; j < benHeaders.length; j++) {
          var bh = String(benHeaders[j]).toLowerCase().trim();
          if (bh.includes("contrato") || bh.includes("póliza") || bh.includes("poliza")) colBenContratoIdx = j;
          if (bh.includes("nombre") || bh.includes("apellido")) colBenNombreIdx = j;
          if (bh.includes("nacimiento") || bh.includes("fecha") || bh === "f. nacimiento") colBenFechaIdx = j;
          if (bh === "estado" || bh.includes("estado")) colBenEstadoIdx = j;
        }
        
        if (colBenContratoIdx == -1) return response("Error: Columna 'contrato' no encontrada en pestaña de beneficiarios");

        var targetBenContrato = String(data.beneficiarioContrato).trim();

        if (action === 'add_beneficiary') {
          var benNewRow = new Array(benHeaders.length > 0 ? benHeaders.length : 4).fill("");
          // Sin la comilla para que appendRow no falle de manera callada.
          benNewRow[colBenContratoIdx] = targetBenContrato; 
          if (colBenNombreIdx != -1) benNewRow[colBenNombreIdx] = (data.nombre || "").toUpperCase();
          if (colBenFechaIdx != -1) benNewRow[colBenFechaIdx] = data.fechaNacimiento || "";
          if (colBenEstadoIdx != -1) benNewRow[colBenEstadoIdx] = data.estado || "ACTIVO";
          
          benSheet.appendRow(benNewRow);
          
          // Magia: Forzar el formato a Texto (@) y re-escribir el valor de forma literal.
          var bLastRow = benSheet.getLastRow();
          benSheet.getRange(bLastRow, colBenContratoIdx + 1).setNumberFormat("@").setValue(targetBenContrato);

          return response("OK: Beneficiario agregado");
        }

        var benRowFoundIdx = -1;
        for (var r = benHeaderRowIdx + 1; r < benValues.length; r++) {
          if (String(benValues[r][colBenContratoIdx]).trim() === targetBenContrato) {
            benRowFoundIdx = r + 1;
            break;
          }
        }

        if (benRowFoundIdx === -1) return response("Error: Beneficiario no encontrado: " + targetBenContrato);

        if (action === 'delete_beneficiary') {
          benSheet.deleteRow(benRowFoundIdx);
          return response("OK: Beneficiario eliminado");
        }

        if (action === 'toggle_beneficiary') {
          if (colBenEstadoIdx != -1) {
            benSheet.getRange(benRowFoundIdx, colBenEstadoIdx + 1).setValue(data.estado);
            return response("OK: Estado actualizado");
          } else {
             return response("Error: Columna 'ESTADO' no encontrada. Créala en Excel.");
          }
        }
      }
    }
  } catch (err) {
    return response("Error Crítico: " + err.toString());
  }
}

function response(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
