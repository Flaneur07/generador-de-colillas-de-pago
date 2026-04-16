// CÓDIGO GOOGLE APPS SCRIPT - EBÉJICO 2026
function doPost(e) {
  try {
    // 1. Parsear los datos que envía la web
    var data = JSON.parse(e.postData.contents);
    var action = data.action; 
    var targetContrato = String(data.poliza).trim(); // Mantenemos .poliza porque es como viene de la web
    
    // 2. Conectar a la hoja (En Ebéjico usamos la pestaña 'mensualidades 2026')
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("mensualidades 2026") || ss.getSheets()[0]; 
    if (!sheet) return response("Error: Ninguna hoja disponible.");

    // 3. Obtener todos los datos para encontrar las cabeceras (la fila 1)
    var values = sheet.getDataRange().getDisplayValues();
    // Buscar la fila de encabezados (buscamos en las primeras 5 filas por si hay títulos grandes)
    var headerRowIdx = 0;
    var headers = [];
    
    for (var r = 0; r < Math.min(5, values.length); r++) {
       var rowStr = values[r].join(" ").toLowerCase();
       if (rowStr.includes("contrato")) {
         headerRowIdx = r;
         headers = values[r];
         break;
       }
    }
    
    if (headers.length === 0) headers = values[0]; // Fallback a la fila 1

    var colContratoIdx = -1;
    var colNombreIdx = -1;
    var colObsIdx = -1;

    // Buscar qué columna es el contrato y cuál el nombre
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase().trim();
      
      // Columna Contrato (Búsqueda exacta para mayor precisión)
      if (h === "contrato") {
        colContratoIdx = i;
      }
      
      // Columna Nombre en Ebéjico: "Apellidos y Nombre"
      if (h.includes("nombre") || h.includes("apellido")) {
        colNombreIdx = i;
      }

      // Columna Observaciones
      if (h.includes("obs") || h.includes("nota")) {
        colObsIdx = i;
      }
    }

    if (colContratoIdx == -1) return response("Error: No se encontró la columna 'Contrato' en el Excel.");

    // ==========================================
    // ACCIÓN: CREAR CLIENTE
    // ==========================================
    if (action === 'create') {
      // 1. Evitar duplicados
      for (var r = headerRowIdx + 1; r < values.length; r++) {
        if (String(values[r][colContratoIdx]).trim() === targetContrato) {
          return response("Error: El contrato ya existe en la fila " + (r + 1));
        }
      }

      // 2. Preparar fila vacía respetando el ancho del Excel
      var newRow = new Array(headers.length).fill("");
      
      // 3. Rellenar datos
      newRow[colContratoIdx] = targetContrato;
      if (colNombreIdx != -1 && data.nombre) {
        newRow[colNombreIdx] = String(data.nombre).toUpperCase();
      }
      
      // 4. Insertar al final del archivo
      sheet.appendRow(newRow);
      
      // 5. Formatear la celda como texto plano para evitar que Google Sheets quite ceros a la izquierda y reescribir para GVIZ
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, colContratoIdx + 1).setNumberFormat("@").setValue(targetContrato);
      
      return response("OK: Cliente creado en Ebéjico con éxito.");

    } else {
      // ==========================================
      // BUSCAR AL CLIENTE PARA ACTUALIZAR O ELIMINAR
      // ==========================================
      var rowFoundIdx = -1;
      
      for (var r = headerRowIdx + 1; r < values.length; r++) {
        // En Sheets, las filas empiezan en 1, no en 0. Así que sumamos 1.
        if (String(values[r][colContratoIdx]).trim() === targetContrato) {
          rowFoundIdx = r + 1; 
          break;
        }
      }

      if (rowFoundIdx === -1 && action.indexOf('beneficiary') === -1) {
        return response("Error: Contrato no encontrado: " + targetContrato);
      }

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

      // ==========================================
      // ACCIONES DE BENEFICIARIOS
      // ==========================================
      if (action.indexOf('beneficiary') !== -1) {
        var benSheet = ss.getSheetByName("Beneficiarios_Ebéjico");
        if (!benSheet) return response("Error: No se encontró la pestaña 'Beneficiarios_Ebéjico'.");
        
        var bValues = benSheet.getDataRange().getDisplayValues();
        var bHeaders = bValues[0];
        var bColContratoIdx = -1;
        var bColNombreIdx = -1;
        var bColEstadoIdx = -1;
        var bColFechaIdx = -1;

        for (var j = 0; j < bHeaders.length; j++) {
          var bh = String(bHeaders[j]).toLowerCase().trim();
          if (bh.includes("contrato")) bColContratoIdx = j;
          if (bh.includes("nombre") || bh.includes("apellido")) bColNombreIdx = j;
          if (bh.includes("estado")) bColEstadoIdx = j;
          if (bh === "f.nacimiento") bColFechaIdx = j;
        }

        if (bColContratoIdx === -1) return response("Error: Columna 'Contrato' no hallada en Beneficiarios.");

        //--- AGREGAR BENEFICIARIO ---
        if (action === 'add_beneficiary') {
          var newBenRow = new Array(bHeaders.length).fill("");
          if (bColNombreIdx !== -1) newBenRow[bColNombreIdx] = (data.nombre || "").toUpperCase();
          if (bColEstadoIdx !== -1) newBenRow[bColEstadoIdx] = data.estado || "ACTIVO";
          if (bColFechaIdx !== -1) newBenRow[bColFechaIdx] = data.fechaNacimiento || "";
          
          benSheet.appendRow(newBenRow);
          var bLastRow = benSheet.getLastRow();
          // Guardar el contrato del beneficiario (limpiando comilla si existiera)
          var benContrato = String(data.beneficiarioContrato || targetContrato).replace(/'/g, "");
          benSheet.getRange(bLastRow, bColContratoIdx + 1).setNumberFormat("@").setValue(benContrato);
          return response("OK: Beneficiario agregado.");
        }

        //--- ELIMINAR O TOGGLE BENEFICIARIO (Buscar fila del beneficiario) ---
        var bRowFoundIdx = -1;
        var bTargetID = String(data.beneficiarioContrato).trim();

        for (var k = 1; k < bValues.length; k++) {
          if (String(bValues[k][bColContratoIdx]).trim() === bTargetID) {
            bRowFoundIdx = k + 1;
            break;
          }
        }

        if (bRowFoundIdx === -1) return response("Error: Beneficiario no encontrado.");

        if (action === 'delete_beneficiary') {
          benSheet.deleteRow(bRowFoundIdx);
          return response("OK: Beneficiario eliminado.");
        }

        if (action === 'toggle_beneficiary') {
          if (bColEstadoIdx !== -1) {
            var newStatus = data.estado ? String(data.estado).toUpperCase() : "";
            
            // Si la app no envió un estado específico, hacemos el toggle tradicional como fallback
            if (!newStatus) {
              var currentStatus = String(bValues[bRowFoundIdx-1][bColEstadoIdx]).toUpperCase();
              newStatus = (currentStatus === "ACTIVO") ? "RETIRADA" : "ACTIVO";
            }
            
            benSheet.getRange(bRowFoundIdx, bColEstadoIdx + 1).setValue(newStatus);
            return response("OK: Estado cambiado a " + newStatus);
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
