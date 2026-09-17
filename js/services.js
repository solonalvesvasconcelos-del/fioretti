import { config } from './config.js';
import {createSupabaseServices} from './supabase-service.js';
import {getClient} from './supabase-client.js';
import {localPhotos} from './local-photos.js';
const KEY = 'reboque.chamados.v1';
const SESSION = 'reboque.sessao.v1';
export const statuses = ['Aguardando', 'Em atendimento', 'Concluído', 'Cancelado'];
export const drivers = ['Ana Costa', 'Carlos Silva', 'Marcos Lima'];
export function validate(input, {remote=false}={}) {
  const fields=['cliente','telefone','placa','veiculo','origem','destino','servico','prioridade','motorista','observacoes'];
  const d = Object.fromEntries(fields.map(k => [k, String(input[k]??'').trim()]));
  d.placa = (d.placa || '').toUpperCase().replace(/[-\s]/g, '');
  if (!d.cliente || d.cliente.length < 3) throw new Error('Informe o nome do cliente com pelo menos 3 caracteres.');
  if (!/^\d{10,11}$/.test((d.telefone || '').replace(/\D/g, ''))) throw new Error('Informe um telefone com DDD e 10 ou 11 dígitos.');
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(d.placa)) throw new Error('Informe uma placa válida, como ABC1D23 ou ABC1234.');
  for (const k of ['veiculo','origem','destino']) if (!d[k] || d[k].length < 3) throw new Error('Preencha veículo, origem e destino com pelo menos 3 caracteres.');
  if (!['Reboque','Pane mecânica','Pane elétrica','Pneu furado'].includes(d.servico)) throw new Error('Selecione o serviço.');
  if (!['Normal','Urgente'].includes(d.prioridade)) throw new Error('Selecione a prioridade.');
  if (d.motorista && (remote ? !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.motorista) : !drivers.includes(d.motorista))) throw new Error('Motorista inválido.');
  const limits={cliente:120,telefone:20,placa:7,veiculo:120,origem:250,destino:250,observacoes:1000};
  for (const [key,max] of Object.entries(limits)) if(d[key].length>max) throw new Error(`O campo ${key} excede o limite de ${max} caracteres.`);
  return d;
}
function write(rows) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); }
  catch { throw new Error('Não foi possível salvar no navegador. Verifique o espaço e as permissões de armazenamento.'); }
}
function read() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { throw new Error('O armazenamento do navegador está indisponível.'); }
  if (raw === null) {
    const rows = ['Aguardando','Em atendimento','Concluído','Aguardando','Em atendimento','Concluído'].map((status,i) => ({
      id: `demo-${i+1}`, protocolo: `RB-${1001+i}`, cliente: ['Cliente Exemplo A','Cliente Exemplo B','Cliente Exemplo C'][i%3],
      telefone: '99999990000', placa: ['ABC1D23','DEF4G56','HIJ7K89'][i%3], veiculo: ['Fiat Argo • Prata','VW Polo • Branco','Chevrolet Onix • Preto'][i%3],
      origem: ['Av. Exemplo, 100 — Imperatriz','Rua de Teste, 200 — Imperatriz','Av. Demonstração, 300 — Imperatriz'][i%3], destino: 'Oficina Exemplo — Imperatriz',
      servico:'Reboque', prioridade:i===0?'Urgente':'Normal', motorista:i===0?'':drivers[i%3], observacoes:'Atendimento fictício para demonstração.',
      status, createdAt:new Date(Date.now()-i*3600000).toISOString()
    }));
    write(rows); return rows;
  }
  try {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.some(r => !r || typeof r.id !== 'string' || !statuses.includes(r.status) || !Number.isFinite(Date.parse(r.createdAt)))) throw new Error();
    return rows;
  } catch { throw new Error('Os dados locais estão inválidos. Exporte ou remova a chave reboque.chamados.v1 nas ferramentas do navegador para reiniciar a demonstração.'); }
}
function demoUser() {
  let user;
  try { user=JSON.parse(sessionStorage.getItem(SESSION)||'null'); } catch {}
  if(!user || !['central','motorista'].includes(user.role) || (user.role==='motorista'&&!drivers.includes(user.name)))
    throw new Error('Entre na demonstração para continuar.');
  return user;
}
function demoCentral() { if(demoUser().role!=='central')throw new Error('Esta ação está disponível apenas para a central.'); }
function visibleRows() { const user=demoUser();return read().filter(r=>user.role==='central'||r.motorista===user.name); }
export const localServices = {
  mode:'local',
  auth: {
    async current() { try { return demoUser(); } catch { return null; } },
    async signIn(role, name) {
      if (!['central','motorista'].includes(role) || (role==='motorista' && !drivers.includes(name))) throw new Error('Perfil inválido.');
      const user = {id:role==='central'?'demo-central':name,role, name:role==='central'?'Operador da central':name};
      sessionStorage.setItem(SESSION, JSON.stringify(user)); return user;
    },
    async signOut() { sessionStorage.removeItem(SESSION); },
    async watch() { return ()=>{}; }
  },
  // A seleção do login é demonstrativa; as telas já autenticadas filtram os chamados.
  drivers:{async list(){return drivers.map(name=>({id:name,name}));}},
  chamados: {
    async list({search='',status='',driver='',offset=0}={}) {
      return visibleRows().filter(r=>(!status||r.status===status)&&(!driver||r.motorista===driver)&&
        (!search||[r.cliente,r.placa,r.protocolo].join(' ').toLowerCase().includes(search.toLowerCase())))
        .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(offset,offset+50);
    },
    async summary(){const rows=visibleRows();return Object.fromEntries(statuses.map(s=>[s,rows.filter(r=>r.status===s).length]));},
    async get(id){const row=visibleRows().find(r=>r.id===id);if(!row)throw new Error('Chamado não encontrado.');return row;},
    async assign(id,driver,expected){demoCentral();if(driver&&!drivers.includes(driver))throw new Error('Motorista inválido.');const rows=read(),r=rows.find(r=>r.id===id);if(!r||r.status!=='Aguardando')throw new Error('Atribua o motorista antes de iniciar.');if(expected&&r.updatedAt!==expected)throw new Error('Chamado atualizado por outra aba. Reabra os detalhes.');r.motorista=driver;r.updatedAt=new Date().toISOString();write(rows);return r;},
    async create(input,id=crypto.randomUUID()) {
      demoCentral();
      const data = validate(input), rows = read();
      const existing=rows.find(r=>r.id===id);if(existing){if(existing.requestPayload!==JSON.stringify(data))throw new Error('Este envio já foi salvo com outros dados. Recarregue o formulário.');return existing;}
      const seq = Math.max(1000,...rows.map(r=>Number(r.protocolo?.split('-')[1])||1000))+1;
      const row = {...data, id, protocolo:`RB-${seq}`,status:'Aguardando',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),requestPayload:JSON.stringify(data)};
      write([row,...rows]); return row;
    },
    async updateStatus(id, status, expected) {
      const user=demoUser();
      const rows = read(), row = rows.find(r=>r.id===id);
      if (!row) throw new Error('Chamado não encontrado.');
      if(user.role==='motorista'&&(row.motorista!==user.name||status==='Cancelado'))throw new Error('Esta alteração não está disponível para este motorista.');
      if(expected && row.status!==expected)throw new Error('Este chamado foi atualizado. Recarregue os detalhes.');
      if(status==='Em atendimento'&&!row.motorista)throw new Error('Atribua um motorista antes de iniciar.');
      const allowed = {'Aguardando':['Em atendimento','Cancelado'],'Em atendimento':['Concluído','Cancelado']};
      if (!allowed[row.status]?.includes(status)) throw new Error('Esta alteração de status não é permitida.');
      row.status=status; row.updatedAt=new Date().toISOString(); write(rows); return row;
    }
  },
  storage: {
    async upload(id,file){const row=await localServices.chamados.get(id);if(!['Aguardando','Em atendimento'].includes(row.status))throw new Error('Este chamado já foi encerrado.');return localPhotos.upload(id,file);},
    async list(id){await localServices.chamados.get(id);return localPhotos.list(id);}
  }
};
// Falha fechada: Supabase indisponível nunca retorna silenciosamente aos dados de demonstração.
const unavailable=new Proxy({}, {get(){throw new Error('Provedor inválido em js/config.js.');}});
export const services = config.provider==='local' ? localServices : config.provider==='supabase' ? createSupabaseServices(getClient,validate) : unavailable;
