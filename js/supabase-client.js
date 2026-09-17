import {config} from './config.js';
let clientPromise;
export function validateConfig(settings) {
  let url;
  try { url = new URL(settings.supabaseUrl); } catch { throw new Error('Configure a URL e a chave publicável do Supabase em js/config.js.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname))
    throw new Error('A URL do Supabase precisa usar HTTPS e conter apenas a origem do projeto.');
  const key=settings.supabasePublishableKey;
  if (!key || key.startsWith('sb_secret_')) throw new Error('Use somente a chave publicável do Supabase.');
  if (!key.startsWith('sb_publishable_')) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role !== 'anon') throw new Error(); }
    catch { throw new Error('Use uma chave publishable ou anon. Nunca use service_role.'); }
  }
  return url.origin;
}
export function getClient() {
  if (!clientPromise) clientPromise=(async()=>{
    const url=validateConfig(config);
    if (!globalThis.supabase) await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      // Carregado apenas quando a integração futura é ativada. A simulação é 100% local.
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js';
      script.onload=resolve;
      script.onerror=()=>{script.remove();reject(new Error('Não foi possível carregar a conexão. Recarregue a página.'));};
      document.head.append(script);
    });
    return globalThis.supabase.createClient(url,config.supabasePublishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'fioretti.auth.v1'}
    });
  })().catch(e=>{clientPromise=undefined;throw e;});
  return clientPromise;
}
