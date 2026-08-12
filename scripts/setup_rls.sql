-- ====================================================================
-- SCRIPT DE SEGURIDAD PARA SUPABASE: ROW LEVEL SECURITY (RLS)
-- Proyecto: Generador de Colillas (Organización La Fe)
-- ====================================================================

-- 1. ACTIVAR ROW LEVEL SECURITY (RLS) EN LAS TABLAS
-- Esto asegura que, por defecto, NADIE pueda consultar ni modificar datos.
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- 2. ELIMINAR POLÍTICAS EXISTENTES (Si las hay) PARA EVITAR CONFLICTOS
DROP POLICY IF EXISTS "Allow anon all" ON clients;
DROP POLICY IF EXISTS "Allow anon all" ON beneficiaries;
DROP POLICY IF EXISTS "Allow anon all" ON payment_history;
DROP POLICY IF EXISTS "Allow authenticated access to clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated access to beneficiaries" ON beneficiaries;
DROP POLICY IF EXISTS "Allow authenticated access to payment_history" ON payment_history;

-- 3. CREAR POLÍTICAS DE ACCESO PARA USUARIOS AUTENTICADOS
-- Estas políticas permiten leer, crear, actualizar y borrar SOLO a usuarios que hayan iniciado sesión.

-- Tabla: clients
CREATE POLICY "Allow authenticated access to clients" 
ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla: beneficiaries
CREATE POLICY "Allow authenticated access to beneficiaries" 
ON beneficiaries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla: payment_history
CREATE POLICY "Allow authenticated access to payment_history" 
ON payment_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ====================================================================
-- NOTA: Con esto, la alerta "rls_disabled_in_public" desaparecerá y 
-- cualquier intento de acceso anónimo (sin credenciales) será bloqueado.
-- ====================================================================
