# Historial de Cambios (Changelog) - Generador de Colillas

## [1.1.8] - 2026-08-12 - Implementación de Autenticación y Seguridad
- **Agregado:** Nuevo sistema de inicio de sesión (`AuthScreen`) con validación de credenciales.
- **Agregado:** Soporte para cuentas funcionales (ej. `operador@lafe.com`).
- **Seguridad:** Implementado Row Level Security (RLS) en Supabase para proteger todos los datos contra accesos anónimos y resolver alerta crítica.
- **Mejorado:** Botones de "Cambiar Sede" y "Cerrar Sesión" independientes en la cabecera.
- **Mejorado:** Integración offline-first del token de sesión para trabajo sin conexión.
## [2026-07-28] - Funcionalidad de Fechas de Nacimiento
- **Agregado:** Campo fecha_nacimiento (DB: birth_date) al perfil del Titular (Cliente).
- **Agregado:** Input con máscara de formato automático DD/MM/AÑO en Nuevo Registro.
- **Agregado:** Edición rápida (en línea) para la fecha de nacimiento de los Beneficiarios.
- **Actualizado:** Sincronización offline en supabaseService.ts.