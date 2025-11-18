import { createClient } from '@supabase/supabase-js';

// Supabase project configuration
const supabaseUrl = 'https://qhhkoqnfwfbdfalfqpmn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoaGtvcW5md2ZiZGZhbGZxcG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MDU2MjAsImV4cCI6MjA3ODk4MTYyMH0.cuXR6gGFiHvTNVVoahWT5oYUmlQu__MvWgpXKV0zX7w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
