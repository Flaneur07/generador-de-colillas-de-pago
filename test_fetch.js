const url = "https://script.google.com/macros/s/AKfycbzug7FuyBFty_ODIH3oprm4Pl32yurgJBxZ0ykZCwbk5JAtWm18cmDw-QtFOn4v_fQY/exec";
fetch(url, {
  method: "POST",
  body: JSON.stringify({ action: "create", poliza: "TEST-AI-1234", nombre: "Prueba AI" })
})
.then(res => res.text())
.then(console.log)
.catch(console.error);
