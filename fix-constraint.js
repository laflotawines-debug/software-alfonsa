
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://krormkbttwsrqsklvdtx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyb3Jta2J0dHdzcnFza2x2ZHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNTY3OTAsImV4cCI6MjA4MTczMjc5MH0.hfAkyRKYLwc9KQkBSAicmubnirGh8vKrmbH0-npqJns';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fix() {
    console.log("Attempting to fix supplier_orders_status_check constraint...");
    const sql = `
        ALTER TABLE public.supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_status_check;
        ALTER TABLE public.supplier_orders ADD CONSTRAINT supplier_orders_status_check CHECK (status = ANY (ARRAY['pendiente'::text, 'enviado'::text, 'confirmado'::text]));
    `;
    const { error } = await supabase.rpc('execute_sql', { sql });
    if (error) {
        console.error("Error fixing constraint:", error.message);
    } else {
        console.log("Constraint fixed successfully!");
    }
}

fix();
