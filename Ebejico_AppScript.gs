// CÓDIGO GOOGLE APPS SCRIPT - EBÉJICO 2026
function doPost(e) {
  try {
    // 1. Parsear los datos que envía la web
    var data = JSON.parse(e.postData.contents);
    var action = data.action; 
    var targetPoliza = String(data.poliza).trim();
    
    // 2. Conectar a la hoja (En Ebéjico usamos la pestaña 'mensualidades 2026')
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("mensualidades 2026") || ss.getSheets()[0]; 
    if (!sheet) return response("Error: Ninguna hoja disponible.");

    // 3. Obtener todos los datos para encontrar las cabeceras (la fila 1)
    var values = sheet.getDataRange().getValues();
    // Buscar la fila de encabezados (buscamos en las primeras 5 filas por si hay títulos grandes)
    var headerRowIdx = 0;
    var headers = [];
    
    for (var r = 0; r < Math.min(5, values.length); r++) {
       var rowStr = values[r].join(" ").toLowerCase();
       if (rowStr.includes("poliza") || rowStr.includes("póliza")) {
         headerRowIdx = r;
         headers = values[r];
         break;
       }
    }
    
    if (headers.length === 0) headers = values[0]; // Fallback a la fila 1

    var colPolizaIdx = -1;
    var colNombreIdx = -1;
    var colObsIdx = -1;

    // Buscar qué columna es la póliza y cuál el nombre
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      
      // Columna Contrato/Póliza en Ebéjico: "No. Póliza"
      if (h.includes("póliza") || h.includes("poliza") || h === "no. póliza" || h === "no. poliza") {
        colPolizaIdx = i;
      }
      
      // Columna Nombre en Ebéjico: "Apellidos y Nombre"
      if (h.includes("nombre") || h.includes("apellido") || h === "apellidos y nombre") {
        colNombreIdx = i;
      }

      // Columna Observaciones
      if (h.includes("obs") || h.includes("nota")) {
        colObsIdx = i;
      }
    }

    if (colPolizaIdx == -1) return response("Error: No se encontró la columna de Póliza en el Excel.");

    // ==========================================
    // ACCIÓN: CREAR CLIENTE
    // ==========================================
    if (action === 'create') {
      // 1. Evitar duplicados
      for (var r = headerRowIdx + 1; r < values.length; r++) {
        if (String(values[r][colPolizaIdx]).trim() === targetPoliza) {
          return response("Error: La póliza ya existe en la fila " + (r + 1));
        }
      }

      // 2. Preparar fila vacía respetando el ancho del Excel
      var newRow = new Array(headers.length).fill("");
      
      // 3. Rellenar datos
      newRow[colPolizaIdx] = targetPoliza;
      if (colNombreIdx != -1 && data.nombre) {
        newRow[colNombreIdx] = String(data.nombre).toUpperCase();
      }
      
      // 4. Insertar al final del archivo
      sheet.appendRow(newRow);
      return response("OK: Cliente creado en Ebéjico con éxito.");

    } else {
      // ==========================================
      // BUSCAR AL CLIENTE PARA ACTUALIZAR O ELIMINAR
      // ==========================================
      var rowFoundIdx = -1;
      
      for (var r = headerRowIdx + 1; r < values.length; r++) {
        // En Sheets, las filas empiezan en 1, no en 0. Así que sumamos 1.
        if (String(values[r][colPolizaIdx]).trim() === targetPoliza) {
          rowFoundIdx = r + 1; 
          break;
        }
      }

      if (rowFoundIdx === -1) return response("Error: Cliente no encontrado: " + targetPoliza);

      // ACCIÓN: ELIMINAR CLIENTE
      if (action === 'delete') {
        sheet.deleteRow(rowFoundIdx);
        return response("OK: Cliente eliminado de Ebéjico.");
      } 
      
      // ACCIÓN: ACTUALIZAR PAGO
      if (action === 'update') {
        var targetMonth = data.month;
        var newValue = data.value;
        var colMonthIdx = -1;
        
        for (var k = 0; k < headers.length; k++) {
          var hMonth = String(headers[k]).toLowerCase().trim();
          
          if (hMonth.startsWith(targetMonth.toLowerCase()) || 
              (targetMonth.toLowerCase() === "jun" && hMonth === "junio") ||
              (targetMonth.toLowerCase() === "jul" && hMonth === "julio")) {
            // Rango de columna real (+1) porque App Script es 1-indexed
            colMonthIdx = k + 1; 
            break;
          }
        }
        
        if (colMonthIdx != -1 && newValue !== undefined) {
          // Actualizar la celda exacta del mes
          sheet.getRange(rowFoundIdx, colMonthIdx).setValue(newValue);
        }

        // Actualizar observaciones si vienen en el payload
        if (colObsIdx != -1 && data.observaciones !== undefined) {
          sheet.getRange(rowFoundIdx, colObsIdx + 1).setValue(data.observaciones);
        }

        return response("OK: Datos del cliente actualizados en Ebéjico.");
      }
    }
  } catch (err) {
    return response("Error Crítico: " + err.toString());
  }
}

function response(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
