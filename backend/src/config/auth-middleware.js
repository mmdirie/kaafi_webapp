import { createUserSupabaseClient } from './supabase.js';
import { createRequireAuth } from '../middleware/auth.js';

export const requireAuth = createRequireAuth({
  createClient: createUserSupabaseClient
});
