// Configurações globais do sistema
// As variáveis são injetadas em tempo de build (Vite/Vercel) ou carregadas do .env.local em desenvolvimento
window.CONFIG = {
  SUPABASE_URL: import.meta?.env?.VITE_SUPABASE_URL || "https://vclqdzvirnafwplivlfc.supabase.co",
  SUPABASE_KEY: import.meta?.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoaXhxZ2ttY2phYmJ6aWRhZGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjE1NjAsImV4cCI6MjA5ODg5NzU2MH0.JEiUSKtP5-Gs4y-oo44NEvFnmjnVyoEfRYJhRcwuNkA",
  PRIVACY_POLICY_VERSION: import.meta?.env?.VITE_PRIVACY_POLICY_VERSION || "2026-07-15",
  APP_REGISTRATION_BASE_URL: import.meta?.env?.VITE_APP_REGISTRATION_BASE_URL || window.location.origin
};

// Validação em desenvolvimento
if (typeof window !== 'undefined' && window.location.hostname === 'localhost' &&
    (!import.meta?.env?.VITE_SUPABASE_URL || !import.meta?.env?.VITE_SUPABASE_ANON_KEY)) {
  console.warn('⚠️ Config: Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não definidas. Usando valores padrão (apenas para desenvolvimento).');
}