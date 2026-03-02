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
        
        if (colMonthIdx != -1) {
          sheet.getRange(rowFoundIdx, colMonthIdx).setValue(newValue);
          return response("OK: Pago actualizado en Heliconia");
        }
        return response("Error: Mes '" + targetMonth + "' no encontrado");
      }
    }
  } catch (err) {
    return response("Error Crítico: " + err.toString());
  }
}

function response(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
