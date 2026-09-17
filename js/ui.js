import {services, statuses} from './services.js';
import {config} from './config.js';
const $ = selector => document.querySelector(selector);
const page = document.body.dataset.page;
const base = page === 'motorista' ? '../' : './';
const remote = config.provider === 'supabase';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const badge = status => `<span class="badge status-${statuses.indexOf(status)}">${esc(status)}</span>`;
const svg = path => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const icons = {
  grid: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  route: svg('<path d="M7 17 17 7M9 7h8v8"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  check: svg('<path d="M5 13l4 4L19 7"/>'),
  cancel: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  users: svg('<circle cx="9" cy="7" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="17" cy="8" r="2.5"/><path d="M23 20c0-2.6-2-4.7-4.5-5.4"/>'),
};
const statIcons = [icons.clock, icons.route, icons.check, icons.cancel];
const toneColors = ['#e6a417','#2f8f6f','#3ea363','#e32230'];
const toneStyle = status => `style="--tone:${toneColors[statuses.indexOf(status)]}"`;
const logo = `<img src="${base}assets/fioretti-logo.jpeg" alt="" width="64" height="64"><span>FIORETTI<small>AUTO SOCORRO</small></span>`;
function message(text, bad=false, target='#message') {
  const el=$(target); if (!el) return;
  el.textContent=text; el.className=`notice${bad?' error':''}`; el.hidden=false;
  if (bad) el.focus();
}
function error(e) { message(e.message || 'Não foi possível concluir a operação.',true); }
function redirect(user) { location.href=base+(user.role==='central'?'dashboard.html':'motorista/index.html'); }
function requireConnection() {
  if (remote && !navigator.onLine) throw new Error('Sem conexão. Nenhuma alteração foi enviada. Conecte-se e tente novamente.');
}
async function init() {
  document.querySelectorAll('[data-mode-note]').forEach(el=>el.textContent=remote?'Acesso restrito à equipe Fioretti.':'Demonstração local · Use somente dados fictícios.');
  if (page==='home') { $('#home-access').textContent=remote?'Acessar minha operação':'Explorar demonstração'; return; }
  if (page==='login') {
    $('#demo-fields').hidden=remote; $('#real-fields').hidden=!remote;
    $('#email').required=remote; $('#password').required=remote;
    $('#login-help').textContent=remote?'Entre com o e-mail e a senha liberados pela central.':'Escolha um perfil para conhecer o sistema com dados fictícios.';
    $('#login-button').textContent=remote?'Entrar':'Entrar na demonstração';
    if (!remote) {
      $('#driver').innerHTML=(await services.drivers.list()).map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
      $('#role').onchange=()=>{$('#driver-field').hidden=$('#role').value!=='motorista';};
    }
    $('#login-form').onsubmit=async event=>{
      event.preventDefault(); const button=$('#login-button'); button.disabled=true;
      try {
        requireConnection();
        const user=remote ? await services.auth.signIn($('#email').value,$('#password').value)
          : await services.auth.signIn($('#role').value,$('#driver').value);
        $('#password').value=''; redirect(user);
      } catch(e) { error(e); button.disabled=false; }
    };
    return;
  }
  const user=await services.auth.current();
  if (!user) { location.replace(base+'login.html'); return; }
  if (user.role==='motorista' && page!=='motorista') { redirect(user); return; }
  const drivers=await services.drivers.list();
  const driverName=id=>drivers.find(d=>d.id===id)?.name || (id ? 'Motorista indisponível' : 'Não atribuído');
  const driverOptions=selected=>drivers.map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(d.name)}</option>`).join('');
  $('#shell').innerHTML=`<aside class="sidebar"><a class="brand" href="${base}index.html" aria-label="Fioretti — início">${logo}</a><div class="nav-label">CENTRAL DE OPERAÇÕES</div><nav aria-label="Menu principal">${user.role==='central'?`<a class="${page==='dashboard'?'active':''}" href="${base}dashboard.html">${icons.grid} <span>Visão geral</span></a><a class="${page==='novo'?'active':''}" href="${base}novo-chamado.html">${icons.plus} <span>Novo chamado</span></a>${remote?`<a class="${page==='usuarios'?'active':''}" href="${base}usuarios.html">${icons.users} <span>Usuários</span></a>`:''}`:''}<a class="${page==='motorista'?'active':''}" href="${base}motorista/index.html">${icons.route} <span>Área do motorista</span></a></nav><div class="sidebar-bottom">${remote?'Operação conectada':'Ambiente de demonstração'}<small>${remote?'Auto Socorro Fioretti':'Dados apenas neste navegador'}</small></div></aside><header class="topbar"><span>Operação <span class="muted">/ ${page==='novo'?'Novo chamado':page==='motorista'?'Motorista':page==='usuarios'?'Usuários':'Visão geral'}</span></span><div class="account"><span class="avatar">${esc(user.name.charAt(0))}</span><span>${esc(user.name)}</span><button class="link-button" id="logout">Sair</button></div></header>`;
  function leave() { $('#detail')?.close(); $('#main').replaceChildren(); location.replace(base+'login.html'); }
  $('#logout').onclick=async()=>{try { await services.auth.signOut(); leave(); } catch(e) { error(e); }};
  await services.auth.watch(leave);
  const network=document.createElement('div'); network.className='notice error'; network.setAttribute('role','status'); $('#main').prepend(network);
  function connectionState() {
    network.hidden=!remote || navigator.onLine;
    network.textContent='Sem conexão. Os dados exibidos podem estar desatualizados. Conecte-se antes de salvar.';
  }
  connectionState(); window.addEventListener('offline',connectionState); window.addEventListener('online',connectionState);
  if (page==='novo') {
    $('#motorista').innerHTML='<option value="">Atribuir depois</option>'+driverOptions();
    const requestId=crypto.randomUUID();
    $('#call-form').onsubmit=async event=>{
      event.preventDefault(); const form=event.currentTarget;
      if (!form.reportValidity()) return;
      const button=$('#save'); button.disabled=true; button.textContent='Salvando…';
      try {
        requireConnection();
        const row=await services.chamados.create(Object.fromEntries(new FormData(form)),requestId);
        location.href=`dashboard.html?criado=${encodeURIComponent(row.protocolo)}`;
      } catch(e) { error(e); button.disabled=false; button.textContent='Criar chamado'; }
    };
    return;
  }
  if (page==='usuarios') {
    if (!remote) { message('Disponível apenas com o backend real ativado.',true); return; }
    async function loadUsers() {
      const rows=await services.usuarios.list();
      $('#user-rows').innerHTML=rows.map(u=>`<tr><td><b>${esc(u.nome)}</b>${u.id===user.id?' <small>(você)</small>':''}</td><td>${u.role==='central'?'Central':'Motorista'}</td><td><span class="badge ${u.ativo?'status-2':'status-3'}">${u.ativo?'Ativo':'Inativo'}</span></td><td>${u.id===user.id?'':`<button class="button secondary" data-toggle="${esc(u.id)}" data-ativo="${u.ativo}">${u.ativo?'Desativar':'Ativar'}</button>`}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Nenhum usuário cadastrado.</td></tr>';
      document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{
        b.disabled=true;
        try { requireConnection(); await services.usuarios.toggleActive(b.dataset.toggle,b.dataset.ativo!=='true'); await loadUsers(); }
        catch(e) { error(e); b.disabled=false; }
      });
    }
    $('#user-form').onsubmit=async event=>{
      event.preventDefault(); const form=event.currentTarget;
      if (!form.reportValidity()) return;
      const button=$('#u-save'); button.disabled=true; button.textContent='Criando…';
      try {
        requireConnection();
        await services.usuarios.create({nome:$('#u-nome').value,email:$('#u-email').value,senha:$('#u-senha').value,role:$('#u-role').value});
        form.reset();
        message('Usuário criado com sucesso.');
        await loadUsers();
      } catch(e) { error(e); }
      finally { button.disabled=false; button.textContent='Criar usuário'; }
    };
    await loadUsers();
    return;
  }
  let offset=0, revision=0, timer, detailRevision=0, photoUrls=[];
  function releasePhotos(){photoUrls.forEach(url=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);});photoUrls=[];}
  const toolbar=document.createElement('div'); toolbar.className='sync-toolbar';
  toolbar.innerHTML='<span id="last-sync" role="status">Carregando atendimentos…</span><button id="refresh" class="button secondary">Atualizar</button>';
  $('.page-heading').after(toolbar);
  const pager=document.createElement('div'); pager.className='pagination';
  pager.innerHTML='<button id="prev" class="button secondary">Anterior</button><span id="page-count"></span><button id="next" class="button secondary">Próxima</button>';
  if (page==='motorista') $('#driver-calls').after(pager); else $('.table-wrap').after(pager);
  $('#prev').onclick=()=>{offset=Math.max(0,offset-50); refresh().catch(error);};
  $('#next').onclick=()=>{offset+=50; refresh().catch(error);};
  $('#refresh').onclick=()=>refresh().catch(error);
  if (page==='motorista') {
    $('#driver-filter').innerHTML=driverOptions(user.role==='motorista'?user.id:undefined);
    if (user.role==='motorista') $('#driver-filter').disabled=true;
    $('#driver-filter').onchange=()=>{offset=0;refresh().catch(error);};
  } else {
    $('#search').oninput=()=>{clearTimeout(timer);revision++;timer=setTimeout(()=>{offset=0;refresh().catch(error);},300);};
    $('#status-filter').onchange=()=>{offset=0;refresh().catch(error);};
    const created=new URLSearchParams(location.search).get('criado');
    if (created) { message(`Chamado ${created} criado com sucesso.`); history.replaceState(null,'',location.pathname); }
  }
  async function refresh() {
    const version=++revision;
    $('#last-sync').textContent='Atualizando…';
    try {
      requireConnection();
      const filters={offset,search:$('#search')?.value||'',status:$('#status-filter')?.value||'',driver:$('#driver-filter')?.value||''};
      if(page==='motorista'&&!filters.driver) {
        $('#driver-calls').innerHTML='<div class="panel empty">Nenhum motorista ativo cadastrado.</div>';
        $('#last-sync').textContent='Cadastre motoristas para distribuir os atendimentos.';
        $('#next').disabled=true;$('#prev').disabled=true;return;
      }
      const [rows,summary]=await Promise.all([services.chamados.list(filters),page==='dashboard'?services.chamados.summary():null]);
      if (version!==revision) return;
      if (page==='dashboard') {
        $('#stats').innerHTML=statuses.map((s,i)=>`<article class="stat" data-tone="${i}"><div class="stat-label">${s}<span class="stat-icon tone-${i}">${statIcons[i]}</span></div><strong>${String(summary[s]||0).padStart(2,'0')}</strong><small>${['Prontos para despacho','Equipes em operação','Atendimentos finalizados','Atendimentos encerrados'][i]}</small></article>`).join('');
        $('#count').textContent=`${rows.length} nesta página`;
        $('#rows').innerHTML=rows.map(r=>`<tr><td><button class="table-link" data-detail="${esc(r.id)}">${esc(r.protocolo)}</button><small>${date(r.createdAt)}</small></td><td><b>${esc(r.cliente)}</b><small>${esc(r.servico)}</small></td><td>${esc(r.placa)}<small>${esc(r.veiculo)}</small></td><td>${esc(driverName(r.motorista))}</td><td>${badge(r.status)}</td><td><span class="${r.prioridade==='Urgente'?'urgent':'muted'}">${esc(r.prioridade)}</span></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum chamado nesta página. Ajuste os filtros ou volte à página anterior.</td></tr>';
      } else {
        $('#driver-calls').innerHTML=rows.map(r=>`<article class="panel driver-card" ${toneStyle(r.status)}><div class="card-top"><b>${esc(r.protocolo)}</b>${badge(r.status)}</div><h2>${esc(r.veiculo)}</h2><p>${esc(r.placa)} · ${esc(r.cliente)}</p><p><b>Origem</b><br>${esc(r.origem)}</p><p><b>Destino</b><br>${esc(r.destino)}</p><button class="button secondary" data-detail="${esc(r.id)}">Ver atendimento</button></article>`).join('')||'<div class="panel empty">Nenhum chamado nesta página para este motorista.</div>';
      }
      $('#prev').disabled=offset===0; $('#next').disabled=rows.length<50;
      $('#page-count').textContent=`Página ${offset/50+1}`;
      $('#last-sync').textContent=`Atualizado às ${new Date().toLocaleTimeString('pt-BR')}${remote?' · Atualização a cada 30 s':''}`;
      document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>show(b.dataset.detail).catch(error));
    } catch(e) { if(version===revision)$('#last-sync').textContent='Atualização falhou. Os dados exibidos podem estar desatualizados.'; throw e; }
  }
  async function show(id) {
    const detailVersion=++detailRevision;
    requireConnection();
    const r=await services.chamados.get(id);
    if(detailVersion!==detailRevision)return;
    releasePhotos();
    const active=['Aguardando','Em atendimento'].includes(r.status);
    $('#detail-content').innerHTML=`<div class="eyebrow">ATENDIMENTO FIORETTI</div><h2 id="detail-title">${esc(r.protocolo)}</h2>${badge(r.status)}<div id="detail-message" class="notice" role="status" tabindex="-1" hidden></div><dl>${[['Cliente',r.cliente],['Telefone',r.telefone],['Veículo',`${r.veiculo} • ${r.placa}`],['Serviço',r.servico],['Prioridade',r.prioridade],['Origem',r.origem],['Destino',r.destino],['Motorista',driverName(r.motorista)],['Observações',r.observacoes||'Sem observações']].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${user.role==='central'&&r.status==='Aguardando'?`<form id="assign-form" class="field"><label for="assign-driver">Atribuir motorista</label><select id="assign-driver"><option value="">Não atribuído</option>${driverOptions(r.motorista)}</select><button class="button secondary">Salvar responsável</button></form>`:''}<div class="actions detail-actions">${r.status==='Aguardando'&&r.motorista?'<button class="button" data-status="Em atendimento">Iniciar atendimento</button>':''}${r.status==='Em atendimento'?'<button class="button" data-status="Concluído">Concluir atendimento</button>':''}${active&&user.role==='central'?'<button class="button secondary" data-status="Cancelado">Cancelar chamado</button>':''}</div>${true?`<section class="photo-section"><h3>Fotos do atendimento</h3><div id="photos" class="photo-grid" aria-live="polite">Carregando fotos…</div>${active?'<form id="photo-form" class="field"><label for="photo-file">Enviar foto · JPG, PNG ou WebP até 5 MB</label><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" required><button class="button secondary">Enviar foto</button></form>':''}<small>Prévia das 100 fotos mais recentes. Na demonstração, as fotos ficam apenas neste navegador.</small></section>`:''}`;
    if(!$('#detail').open)$('#detail').showModal();
    async function perform(button,operation) {
      button.disabled=true;
      try { requireConnection();await operation();await refresh();await show(id); }
      catch(e) { message(e.message,true,'#detail-message');button.disabled=false; }
    }
    document.querySelectorAll('[data-status]').forEach(button=>button.onclick=()=>perform(button,()=>services.chamados.updateStatus(id,button.dataset.status,r.status)));
    if($('#assign-form')) $('#assign-form').onsubmit=e=>{e.preventDefault();perform(e.submitter,()=>services.chamados.assign(id,$('#assign-driver').value,r.updatedAt));};
    {
      if($('#photo-form'))$('#photo-form').onsubmit=e=>{e.preventDefault();perform(e.submitter,()=>services.storage.upload(id,$('#photo-file').files[0]));};
      try {
        const photos=await services.storage.list(id);
        if(detailVersion!==detailRevision){photos.forEach(p=>{if(p.url.startsWith('blob:'))URL.revokeObjectURL(p.url);});return;}
        photoUrls=photos.map(p=>p.url);
        $('#photos').innerHTML=photos.map(p=>`<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(p.url)}" alt="Foto do atendimento"></a>`).join('')||'<p class="muted">Nenhuma foto enviada.</p>';
      } catch { if(detailVersion===detailRevision)$('#photos').textContent='Não foi possível carregar as fotos. Reabra os detalhes para tentar novamente.'; }
    }
  }
  $('#close-detail').onclick=()=>$('#detail').close();
  $('#detail').addEventListener('close',()=>{detailRevision++;releasePhotos();});
  window.addEventListener('storage',()=>refresh().catch(error));
  window.addEventListener('online',()=>refresh().catch(error));
  const interval=setInterval(()=>{ if (!document.hidden && !$('#detail').open && navigator.onLine) refresh().catch(error); },config.refreshIntervalMs);
  window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
  await refresh();
}
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
init().catch(error);
