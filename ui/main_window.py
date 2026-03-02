import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from ttkbootstrap.tableview import Tableview
from ttkbootstrap.dialogs import Messagebox
from tkinter import filedialog
import pandas as pd
import os
import platform
import subprocess

from ui.edit_modal import EditClientModal, MONTHS
from services.pdf_service import generate_pdf
from utils.currency import format_currency

class MainWindow(ttk.Window):
    def __init__(self):
        # Usamos 'cerculean' para un look azul profesional
        super().__init__(themename="cerculean")
        self.title("Generador de Colillas - La Fe")
        self.geometry("1100x700")
        
        self.clients = [] # Lista de diccionarios
        self.filtered_clients = []
        self.selected_client = None
        
        self._build_ui()

    def _build_ui(self):
        # --- Header ---
        header = ttk.Frame(self, padding=10, bootstyle="primary")
        header.pack(fill=X)
        # Usamos bootstyle="inverse-primary" para texto blanco sobre fondo azul
        ttk.Label(header, text="Generador de Colillas", font=("Helvetica", 18, "bold"), bootstyle="inverse-primary").pack(side=LEFT)
        ttk.Button(header, text="Cargar Excel", bootstyle="light-outline", command=self._load_excel).pack(side=RIGHT)

        # --- Main Layout (Panedwindow) ---
        # Nota: Panedwindow se escribe con 'w' minúscula en algunas versiones de ttkbootstrap/tkinter
        paned = ttk.Panedwindow(self, orient=HORIZONTAL)
        paned.pack(fill=BOTH, expand=YES, padx=10, pady=10)

        # Left Panel (List)
        left_panel = ttk.Frame(paned)
        paned.add(left_panel, weight=2)
        
        # Search Bar
        search_frame = ttk.Frame(left_panel, padding=(0,0,0,10))
        search_frame.pack(fill=X)
        self.search_var = ttk.StringVar()
        self.search_var.trace("w", self._on_search)
        
        # CORRECCIÓN: Agregamos Label y quitamos 'placeholder' del Entry
        ttk.Label(search_frame, text="Buscar por Nombre o Póliza:", font=("Helvetica", 9)).pack(fill=X, anchor="w")
        ttk.Entry(search_frame, textvariable=self.search_var).pack(fill=X)

        # Treeview (Tabla)
        columns = [
            {"text": "Póliza", "stretch": False, "width": 80},
            {"text": "Nombre", "stretch": True},
            {"text": "Teléfono", "stretch": False, "width": 100},
        ]
        
        self.tree = ttk.Treeview(left_panel, columns=[c["text"] for c in columns], show="headings", selectmode="browse")
        for c in columns:
            self.tree.heading(c["text"], text=c["text"])
            # CORRECCIÓN: Usamos c.get("width", 200) para evitar el error si falta la clave width
            self.tree.column(c["text"], width=c.get("width", 200), stretch=c.get("stretch", True))
        
        self.tree.pack(fill=BOTH, expand=YES)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)
        self.tree.bind("<Double-1>", self._on_double_click)

        # Right Panel (Preview & Action)
        right_panel = ttk.Frame(paned, padding=10)
        paned.add(right_panel, weight=1)
        
        # Preview Container
        self.preview_frame = ttk.Labelframe(right_panel, text="Vista Previa Recibo", padding=15, bootstyle="info")
        self.preview_frame.pack(fill=BOTH, expand=YES)
        
        # Month Selector
        ttk.Label(self.preview_frame, text="Seleccionar Mes de Pago:").pack(fill=X, pady=(0,5))
        
        self.month_combo = ttk.Combobox(self.preview_frame, values=MONTHS, state="readonly")
        self.month_combo.pack(fill=X, pady=(0, 10))
        self.month_combo.current(0)
        self.month_combo.bind("<<ComboboxSelected>>", self._update_preview_text)
        
        # Info Display (Text-based simulation)
        self.info_text = ttk.Text(self.preview_frame, height=15, width=40, state="disabled", wrap="word", font=("Courier", 10))
        self.info_text.pack(fill=BOTH, expand=YES, pady=10)
        
        # Action Buttons
        btn_frame = ttk.Frame(right_panel)
        btn_frame.pack(fill=X, pady=10)
        
        ttk.Button(btn_frame, text="Editar Cliente", bootstyle="warning", command=self._edit_current).pack(side=LEFT, fill=X, expand=YES, padx=(0,5))
        ttk.Button(btn_frame, text="Generar PDF", bootstyle="success", command=self._generate_pdf_action).pack(side=RIGHT, fill=X, expand=YES, padx=(5,0))

    def _load_excel(self):
        file_path = filedialog.askopenfilename(filetypes=[("Excel Files", "*.xlsx *.xls")])
        if not file_path: return

        try:
            # Lógica simple de lectura
            # Asumimos que la primera fila con "Nombre" es el header
            df = pd.read_excel(file_path, header=None)
            
            # Buscar header
            header_idx = -1
            for i, row in df.iterrows():
                row_str = " ".join(row.astype(str).str.lower())
                if "nombre" in row_str and "pol" in row_str:
                    header_idx = i
                    break
            
            if header_idx == -1: header_idx = 0
            
            # Recargar con header correcto
            df = pd.read_excel(file_path, header=header_idx)
            df.columns = df.columns.astype(str).str.lower()
            
            # Mapeo básico de columnas
            cols = df.columns
            col_nombre = next((c for c in cols if 'nombre' in c), None)
            col_poliza = next((c for c in cols if 'pol' in c or 'no.' in c), None)
            col_tel = next((c for c in cols if 'tel' in c), None)
            col_correo = next((c for c in cols if 'cor' in c or 'email' in c), None)
            col_obs = next((c for c in cols if 'obs' in c), None)

            self.clients = []
            
            month_map = {m.lower(): m for m in MONTHS} # ene -> Ene
            
            for idx, row in df.iterrows():
                if pd.isna(row[col_nombre]): continue
                
                payments = {}
                for col in cols:
                    # Detectar columnas de meses (starts with ene, feb...)
                    for m_key, m_val in month_map.items():
                        if col.strip().startswith(m_key):
                            val = row[col]
                            # Limpiar valor
                            try:
                                if isinstance(val, str):
                                    val = int(''.join(filter(str.isdigit, val)))
                                elif pd.notna(val):
                                    val = int(val)
                                else:
                                    val = 0
                            except: val = 0
                            payments[m_val] = val

                client = {
                    'id': idx,
                    'nombre': str(row[col_nombre]).strip(),
                    'numeroContrato': str(row[col_poliza]).strip() if col_poliza else "",
                    'telefono': str(row[col_tel]).strip() if col_tel and pd.notna(row[col_tel]) else "",
                    'correo': str(row[col_correo]).strip() if col_correo and pd.notna(row[col_correo]) else "",
                    'observaciones': str(row[col_obs]).strip() if col_obs and pd.notna(row[col_obs]) else "",
                    'payments': payments
                }
                self.clients.append(client)
            
            self._refresh_table()
            Messagebox.show_info(f"Se cargaron {len(self.clients)} registros.", "Carga Exitosa")
            
        except Exception as e:
            Messagebox.show_error(f"Error leyendo Excel: {str(e)}", "Error")

    def _refresh_table(self):
        # Limpiar
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        term = self.search_var.get().lower()
        self.filtered_clients = [
            c for c in self.clients 
            if term in c['nombre'].lower() or term in str(c['numeroContrato'])
        ]
        
        for c in self.filtered_clients:
            self.tree.insert("", END, iid=c['id'], values=(c['numeroContrato'], c['nombre'], c['telefono']))

    def _on_search(self, *args):
        self._refresh_table()

    def _on_select(self, event):
        sel = self.tree.selection()
        if not sel: return
        
        client_id = int(sel[0])
        self.selected_client = next((c for c in self.clients if c['id'] == client_id), None)
        self._update_preview_text()

    def _on_double_click(self, event):
        if self.selected_client:
            self._edit_current()

    def _update_preview_text(self, *args):
        self.info_text.configure(state="normal")
        self.info_text.delete("1.0", END)
        
        if not self.selected_client:
            self.info_text.insert(END, "Seleccione un cliente...")
            self.info_text.configure(state="disabled")
            return

        month = self.month_combo.get()
        valor = self.selected_client['payments'].get(month, 0)
        
        txt =  f"--- VISTA PREVIA DE DATOS ---\n\n"
        txt += f"CLIENTE: {self.selected_client['nombre']}\n"
        txt += f"PÓLIZA:  {self.selected_client['numeroContrato']}\n\n"
        txt += f"MES A PAGAR: {month}\n"
        txt += f"VALOR:       {format_currency(valor)}\n"
        txt += f"CONCEPTO:    Mensualidad {month} 2026\n\n"
        txt += f"OBSERVACIONES:\n{self.selected_client['observaciones']}"
        
        self.info_text.insert(END, txt)
        self.info_text.configure(state="disabled")

    def _edit_current(self):
        if not self.selected_client: return
        
        def on_save(updated_data):
            # Actualizar en memoria
            idx = next(i for i, c in enumerate(self.clients) if c['id'] == self.selected_client['id'])
            updated_data['id'] = self.selected_client['id'] # Mantener ID
            self.clients[idx] = updated_data
            self.selected_client = updated_data
            
            # Refrescar UI
            self._refresh_table()
            self.tree.selection_set(updated_data['id'])
            self._update_preview_text()

        EditClientModal(self, self.selected_client, on_save)

    def _generate_pdf_action(self):
        if not self.selected_client: return
        
        month = self.month_combo.get()
        valor = self.selected_client['payments'].get(month, 0)
        
        if valor == 0:
            if Messagebox.show_question("El valor del pago es $0. ¿Desea continuar?", "Advertencia") != "Yes":
                return

        try:
            path = generate_pdf(self.selected_client, month)
            
            # Abrir archivo automáticamente
            if platform.system() == 'Darwin':       # macOS
                subprocess.call(('open', path))
            elif platform.system() == 'Windows':    # Windows
                os.startfile(path)
            else:                                   # linux
                subprocess.call(('xdg-open', path))
                
        except Exception as e:
            Messagebox.show_error(f"Error generando PDF: {str(e)}", "Error")

if __name__ == "__main__":
    app = MainWindow()
    app.mainloop()