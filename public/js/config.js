// Configurações globais do sistema
// Para produção: configure as variáveis no Vercel e use um build step (Vite)
// Para desenvolvimento local: crie config.local.js (gitignored) ou edite este arquivo

window.CONFIG = {
  // Substitua pelos valores da sua instância Supabase em produção
  SUPABASE_URL: "https://vclqdzvirnafwplivlfc.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbHFkenZpcm5hZndwbGl2bGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODkwMDAsImV4cCI6MjA3MjM2NTAwMH0.anon-key-placeholder",
  PRIVACY_POLICY_VERSION: "2026-07-15",
  APP_REGISTRATION_BASE_URL: window.location.origin
};

// Tenta carregar config.local.js se existir (desenvolvimento)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.info('🔧 Modo desenvolvimento: configure config.local.js ou edite este arquivo com suas credenciais Supabase');
}