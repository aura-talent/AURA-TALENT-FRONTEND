/**
 * Default Supabase config, mirrored from the web app's NEXT_PUBLIC_* env vars.
 * These are the anon (publishable) credentials the web app already ships to
 * every browser — safe to embed. Used only to refresh an expired access token
 * via Supabase's token endpoint when no app tab is open to do it for us.
 *
 * Options can override these (lib/storage.js → supabaseUrl / supabaseAnonKey);
 * the service worker falls back here when those are blank. If you point the
 * extension at a different Supabase project, update these or set them in Options.
 */
export const SUPABASE_URL = "https://vvwfstrtkjlcxyeslgwn.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2d2ZzdHJ0a2psY3h5ZXNsZ3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzY4MTYsImV4cCI6MjA5Njc1MjgxNn0.42vqFhx2ylxoSf-6pD6rWN8U0AxGwjQRNPhMdLaNGcU";
