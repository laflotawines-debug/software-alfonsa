
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://krormkbttwsrqsklvdtx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyb3Jta2J0dHdzcnFza2x2ZHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNTY3OTAsImV4cCI6MjA4MTczMjc5MH0.hfAkyRKYLwc9KQkBSAicmubnirGh8vKrmbH0-npqJns';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const isSupabaseConfigured = () => {
  return !supabaseUrl.includes('your-project-url') && !supabaseAnonKey.includes('your-anon-key');
};
