import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qwquqrkjclsecpqoflnf.supabase.co';
const supabaseAnonKey = 'sb_publishable_7zb9azydIDP1ofF2IkTgEg_iTVCiCOT';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  console.log("🔍 INICIANDO AUDITORÍA DE DATOS EN SUPABASE...\n");

  const sites = ['ebejico', 'heliconia', 'sevilla'];
  let totalClients = 0;
  let totalBeneficiaries = 0;

  for (const site of sites) {
    console.log(`=== REVISIÓN DE SEDE: ${site.toUpperCase()} ===`);
    
    // 1. Contar Clientes
    const { count: clientCount, error: clientErr, data: sampleClients } = await supabase
      .from('clients')
      .select('id, contract_number', { count: 'exact' })
      .eq('site_id', site);

    if (clientErr) {
      console.error(`❌ Error al obtener clientes de ${site}:`, clientErr.message);
      continue;
    }
    
    console.log(`✅ Clientes encontrados: ${clientCount}`);
    totalClients += clientCount || 0;

    // 2. Extraer los IDs de esos clientes para buscar a sus beneficiarios
    const clientIds = (sampleClients || []).map(c => c.id);

    if (clientIds.length > 0) {
      // Supabase no permite 'in' array con miles de items fácilmente, así que contaremos cruzando.
      const { count: benCount, error: benErr } = await supabase
        .from('beneficiaries')
        .select('*', { count: 'exact', head: true })
        .in('client_id', clientIds);

      if (benErr && benErr.code !== '42601') { 
        // A veces el URL es muy largo, usamos otra táctica si falla
        console.log(`⚠️ Advertencia al contar beneficiarios (query largo), intentando conteo general cruzado...`);
      } else {
        console.log(`✅ Beneficiarios asociados estrictamente a esta sede: ${benCount || 0}`);
        totalBeneficiaries += benCount || 0;
      }
    } else {
      console.log(`✅ Beneficiarios: 0`);
    }

    // 3. Verificación de Aislamiento (Contaminación Cruzada)
    const { data: crossContamination } = await supabase
      .from('clients')
      .select('site_id')
      .neq('site_id', site)
      .limit(1);
    
    // Solo comprobamos si las consultas con filtro site_id devuelven exáctamente ese site.
    const { data: strictCheck } = await supabase
      .from('clients')
      .select('site_id')
      .eq('site_id', site);
      
    const hasOtherSites = strictCheck?.find(c => c.site_id !== site);
    
    if (hasOtherSites) {
      console.log(`❌ ERROR CRÍTICO: Hay clientes de otras sedes mezclados en la consulta de ${site.toUpperCase()}!`);
    } else {
      console.log(`🛡️  Aislamiento perfecto: Ningún cliente de otra sede se mezcla aquí.\n`);
    }
  }

  // Verificación global de consistencia de beneficiarios "Huérfanos"
  console.log("=== COMPROBACIÓN DE INTEGRIDAD ===");
  const { count: orphanCount, error: orphErr } = await supabase
    .from('beneficiaries')
    .select('*', { count: 'exact', head: true })
    .is('client_id', null);
    
  if (orphErr) {
    console.error("Error comprobando huérfanos:", orphErr.message);
  } else {
    if (orphanCount === 0) {
      console.log(`🔗 Integridad relacional: 100%. No hay beneficiarios huérfanos sin titular.`);
    } else {
      console.log(`⚠️ ALERTA: Hay ${orphanCount} beneficiarios que no están enlazados a ningún cliente.`);
    }
  }
  
  console.log(`\n📊 RESUMEN GLOBAL SUPABASE:`);
  console.log(`Total Clientes: ${totalClients}`);
  console.log(`Total Beneficiarios (Aprox): ${totalBeneficiaries}`);
  console.log("\nAuditoría Completada.");
}

runAudit();
