/**
 * Supabase Client for Backend Services
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://duhwjqfqbngoexbbpzij.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aHdqcWZxYm5nb2V4YmJwemlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUyOTgzODQsImV4cCI6MjA0MDg3NDM4NH0.WQeUP_5EZNC-qfNfLn0p6HvWfuHbvqBklPqFIkWllLk';

// Create Supabase client for backend use
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabase;