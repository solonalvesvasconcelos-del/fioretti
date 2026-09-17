// Mantenha "local" somente para demonstração. Depois de aplicar a migração e criar
// os perfis, preencha os dois valores públicos e altere para "supabase".
// Nunca inclua senhas, secret key ou service_role neste arquivo.
export const config = Object.freeze({
  provider: 'supabase',
  supabaseUrl: 'https://gqpacmzyqjxxyccqeqbe.supabase.co',
  supabasePublishableKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcGFjbXp5cWp4eHljY3FlcWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NTM5ODgsImV4cCI6MjEwNTIyOTk4OH0.p4fVDuJOTHqFBPB6WrnH9Qn1afUIjQ2CNlv_h4UunGs',
  refreshIntervalMs: 30000
});
