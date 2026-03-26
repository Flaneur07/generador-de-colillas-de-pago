function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action; 
    var targetPoliza = String(data.poliza).trim();
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // PARA HELICONIA: La hoja se llama "2026"
    var sheet = ss.getSheetByName("2026") || ss.getSheets()[0]; 
    if (!sheet) return response("Error: Hoja '2026' no encontrada");

    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    
    var colPolizaIdx = -1;
    var colNombreIdx = -1;
    var colObsIdx = -1;

    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      
      // Identificar columna Contrato
      if (h === "contrato" || h === "n° contrato" || h === "no. contrato" || h === "poliza") {
        colPolizaIdx = i;
      } else if (colPolizaIdx == -1 && (h.includes("pol") || h.includes("no."))) {
        colPolizaIdx = i;
      }
      
      // Identificar columna Nombre (Heliconia usa 'nombre y apellido')
      if (h.includes("nombre") || h.includes("apellido") || h.includes("cliente")) {
        colNombreIdx = i;
      }

      // Identificar columna Observaciones
      if (h.includes("obs") || h.includes("nota")) {
        colObsIdx = i;
      }
    }

    if (colPolizaIdx == -1) return response("Error: Columna 'contrato' no encontrada");

    if (action === 'create') {
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][colPolizaIdx]).trim() === targetPoliza) {
          return response("Error: El contrato ya existe");
        }
      }

      var newRow = new Array(headers.length).fill("");
      newRow[colPolizaIdx] = targetPoliza;
      if (colNombreIdx != -1) newRow[colNombreIdx] = data.nombre.toUpperCase();
      
      sheet.appendRow(newRow);
      return response("OK: Cliente creado en Heliconia");

    } else {
      var rowFoundIdx = -1;
      for (var r = 1; r < values.length; r++) {
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
            // Soporte para variaciones como 'junio'/'jun' o 'julio'/'jul'
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

        // Actualizar observaciones si vienen en el payload
        if (colObsIdx != -1 && data.observaciones !== undefined) {
          sheet.getRange(rowFoundIdx, colObsIdx + 1).setValue(data.observaciones);
        }

        return response("OK: Datos actualizados en Heliconia");
      }

      if (action === 'add_beneficiary' || action === 'delete_beneficiary' || action === 'toggle_beneficiary') {
        var benSheet = ss.getSheetByName("Beneficiarios_Heliconia");
        if (!benSheet) return response("Error: Hoja 'Beneficiarios_Heliconia' no encontrada");
        
        var benValues = benSheet.getDataRange().getValues();
        var benHeaders = benValues[0];
        
        var colBenContratoIdx = -1;
        var colBenNombreIdx = -1;
        var colBenFechaIdx = -1;
        var colBenEstadoIdx = -1;
        
        for (var j = 0; j < benHeaders.length; j++) {
          var bh = String(benHeaders[j]).toLowerCase().trim();
          if (bh.includes("contrato") || bh.includes("póliza") || bh.includes("poliza")) colBenContratoIdx = j;
          if (bh.includes("nombre") || bh.includes("apellido")) colBenNombreIdx = j;
          if (bh.includes("nacimiento") || bh.includes("fecha")) colBenFechaIdx = j;
          if (bh.includes("estado")) colBenEstadoIdx = j;
        }
        
        if (colBenContratoIdx == -1) return response("Error: Columna 'contrato' no encontrada en beneficiarios");

        var targetBenContrato = String(data.beneficiarioContrato).trim();

        if (action === 'add_beneficiary') {
          var newRow = new Array(benHeaders.length).fill("");
          newRow[colBenContratoIdx] = targetBenContrato;
          if (colBenNombreIdx != -1) newRow[colBenNombreIdx] = data.nombre.toUpperCase();
          if (colBenFechaIdx != -1) newRow[colBenFechaIdx] = data.fechaNacimiento;
          if (colBenEstadoIdx != -1) newRow[colBenEstadoIdx] = data.estado || "Activo";
          
          benSheet.appendRow(newRow);
          return response("OK: Beneficiario agregado");
        }

        // Buscar fila del beneficiario para delete o toggle
        var benRowFoundIdx = -1;
        for (var r = 1; r < benValues.length; r++) {
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
            return response("OK: Estado del beneficiario actualizado");
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
