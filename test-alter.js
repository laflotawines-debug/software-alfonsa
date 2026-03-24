import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://krormkbttwsrqsklvdtx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyb3Jta2J0dHdzcnFza2x2ZHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNTY3OTAsImV4cCI6MjA4MTczMjc5MH0.hfAkyRKYLwc9KQkBSAicmubnirGh8vKrmbH0-npqJns';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    const { error } = await supabase.rpc('execute_sql', { sql: "ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'anulacion';" });
    console.log("Error:", error?.message);
}
test();
