import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qwquqrkjclsecpqoflnf.supabase.co';
const supabaseAnonKey = 'sb_publishable_7zb9azydIDP1ofF2IkTgEg_iTVCiCOT';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Testing Supabase connectivity...");
  const { data, error } = await supabase.from('clients').select('*').limit(1);
  if (error) {
    console.error("Connection error:", error.message);
  } else {
    console.log("Connection successful! Tables are ready.");
  }
}

test();
