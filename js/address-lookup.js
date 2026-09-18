export function normalizeCep(value) { return String(value??'').replace(/\D/g,''); }

export function formatCep(value) {
  const cep=normalizeCep(value).slice(0,8);
  return cep.length>5?`${cep.slice(0,5)}-${cep.slice(5)}`:cep;
}

export function addressReference({bairro='',localidade='',uf=''}) {
  return [bairro.trim(),[localidade.trim(),uf.trim()].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
}

export async function lookupCep(value,{fetchFn=fetch,signal}={}) {
  const cep=normalizeCep(value);
  if (cep.length!==8) throw new Error('Informe um CEP com 8 dígitos.');
  let response;
  try { response=await fetchFn(`https://viacep.com.br/ws/${cep}/json/`,{headers:{accept:'application/json'},signal}); }
  catch(error) {
    if(error?.name==='AbortError') throw new Error('A busca do CEP demorou demais. Tente novamente.');
    throw new Error('Não foi possível consultar o CEP. Verifique a conexão e tente novamente.');
  }
  if (!response.ok) throw new Error('Não foi possível consultar o CEP. Tente novamente.');
  const data=await response.json();
  if (data?.erro || !data?.logradouro || !data?.localidade || !data?.uf) throw new Error('CEP não encontrado ou sem endereço suficiente. Confirme o número informado.');
  return {cep,logradouro:data.logradouro.trim(),referencia:addressReference(data)};
}
