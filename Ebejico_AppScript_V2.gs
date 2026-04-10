function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action; 
    var targetPoliza = String(data.poliza).trim();
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // PARA EBÉJICO: La hoja principal de pagos se llama "mensualidades 2026"
    var sheet = ss.getSheetByName("mensualidades 2026") || ss.getSheets()[0]; 
    if (!sheet) return response("Error: Hoja 'mensualidades 2026' no encontrada");

    var values = sheet.getDataRange().getDisplayValues();
    var headers = values[0];
    
    var colPolizaIdx = -1;
    var colNombreIdx = -1;
    var colObsIdx = -1;

    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      
      // Identificar columna Contrato (nombre homologado)
      // Prioriza el nombre exacto "contrato"; también soporta nombres anteriores por compatibilidad.
      if (h === "contrato" || h === "no. póliza" || h === "no. poliza" || h === "no póliza" || h === "no poliza" || h === "poliza") {
        colPolizaIdx = i;
      }
      
      // Identificar columna Nombre
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
        var existingPol = String(values[r][colPolizaIdx]).replace(/'/g, "").trim();
        if (existingPol === targetPoliza) {
          return response("Error: El contrato ya existe");
        }
      }

      var newRow = new Array(headers.length).fill("");
      newRow[colPolizaIdx] = targetPoliza;
      if (colNombreIdx != -1) newRow[colNombreIdx] = data.nombre.toUpperCase();
      
      sheet.appendRow(newRow);
      sheet.getRange(sheet.getLastRow(), colPolizaIdx + 1).setNumberFormat("@").setValue(targetPoliza);
      return response("OK: Cliente creado en Ebéjico");

    } else {
      var rowFoundIdx = -1;
      for (var r = 1; r < values.length; r++) {
        var currentPol = String(values[r][colPolizaIdx]).replace(/'/g, "").trim();
        if (currentPol === targetPoliza) {
          rowFoundIdx = r + 1;
          break;
        }
      }

      if (rowFoundIdx === -1) return response("Error: Contrato no encontrado: " + targetPoliza);

      if (action === 'delete') {
        sheet.deleteRow(rowFoundIdx);
        
        // BORRADO EN CASCADA DE BENEFICIARIOS
        var benSheet = ss.getSheetByName("Beneficiarios_Ebéjico");
        if (benSheet) {
          var benValues = benSheet.getDataRange().getDisplayValues();
          var colContratoIdx = -1;
          for (var j = 0; j < benValues[0].length; j++) {
            var bh = String(benValues[0][j]).toLowerCase().trim();
            if (bh.includes("contrato") || bh.includes("póliza") || bh.includes("poliza")) colContratoIdx = j;
          }
          if (colContratoIdx !== -1) {
             // Recorremos de abajo hacia arriba para evitar salto de índices al borrar fila
             for (var r = benValues.length - 1; r >= 1; r--) {
                var c = String(benValues[r][colContratoIdx]).replace(/'/g, "").trim();
                // Si el formato del contrato derivado (ej. "1010-1") empieza exactamente en "1010"
                if (c.split("-")[0] === targetPoliza) {
                   benSheet.deleteRow(r + 1);
                }
             }
          }
        }
        return response("OK: Cliente y beneficiarios eliminados");
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

        return response("OK: Datos actualizados en Ebéjico");
      }

      if (action === 'add_beneficiary' || action === 'delete_beneficiary' || action === 'toggle_beneficiary') {
        var benSheet = ss.getSheetByName("Beneficiarios_Ebéjico");
        if (!benSheet) return response("Error: Hoja 'Beneficiarios_Ebéjico' no encontrada");
        
        var benValues = benSheet.getDataRange().getDisplayValues();
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
          if (bh === "estado" || bh.includes("estado") || bh.includes("estatus")) colBenEstadoIdx = j;
        }
        
        if (colBenContratoIdx == -1) return response("Error: Columna 'contrato' no encontrada en beneficiarios");

        var targetBenContrato = String(data.beneficiarioContrato).trim();

        if (action === 'add_beneficiary') {
          var newRow = new Array(benHeaders.length).fill("");
          // NO incluir contrato aquí: appendRow lo auto-convertiría a fecha.
          // Se setea explícitamente como texto después del appendRow.
          if (colBenNombreIdx != -1) newRow[colBenNombreIdx] = data.nombre.toUpperCase();
          if (colBenFechaIdx != -1) newRow[colBenFechaIdx] = data.fechaNacimiento;
          if (colBenEstadoIdx != -1) newRow[colBenEstadoIdx] = data.estado || "ACTIVO";
          
          benSheet.appendRow(newRow);
          // Setear contrato como texto puro DESPUÉS del appendRow para evitar conversión a fecha
          benSheet.getRange(benSheet.getLastRow(), colBenContratoIdx + 1).setNumberFormat("@").setValue(targetBenContrato);
          return response("OK: Beneficiario agregado");
        }

        var benRowFoundIdx = -1;
        for (var r = 1; r < benValues.length; r++) {
          var currentBenPol = String(benValues[r][colBenContratoIdx]).replace(/'/g, "").trim();
          if (currentBenPol === targetBenContrato) {
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
          } else {
             return response("Error: Columna 'Estado' no encontrada");
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
