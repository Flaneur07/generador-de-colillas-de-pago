
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qwquqrkjclsecpqoflnf.supabase.co';
const supabaseAnonKey = 'sb_publishable_7zb9azydIDP1ofF2IkTgEg_iTVCiCOT';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSevilla() {
  console.log("Checking Sevilla clients and payments...");
  const { data, error } = await supabase
    .from('clients')
    .select('full_name, contract_number, ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic')
    .eq('site_id', 'sevilla')
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("No clients found for Sevilla.");
    return;
  }

  console.log(`Found ${data.length} clients for Sevilla.`);
  data.forEach(client => {
    const hasPayment = Object.values(client).some(v => typeof v === 'number' && v > 0);
    console.log(`Client: ${client.full_name}, Contract: ${client.contract_number}, Has Payments: ${hasPayment}`);
    if (hasPayment) {
        console.log("Payments:", JSON.stringify(client));
    }
  });
}

checkSevilla();
