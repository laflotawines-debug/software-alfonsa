import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('stock_movements').select('*').eq('type', 'transferencia').limit(10);
    console.log(JSON.stringify(data, null, 2));
}
run();
