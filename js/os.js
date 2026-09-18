import {services,statuses} from './services.js?v=14';

const root=document.querySelector('#os-document');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const currency=value=>value==null?'A combinar':Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const statusClass=status=>`status-${Math.max(0,statuses.indexOf(status))}`;

async function render() {
  const user=await services.auth.current();
  if(!user) { location.replace('login.html'); return; }
  const id=new URLSearchParams(location.search).get('id');
  if(!id) throw new Error('Informe o chamado para gerar a ordem de serviço.');
  const [r,drivers]=await Promise.all([services.chamados.get(id),services.drivers.list()]);
  const driverName=drivers.find(driver=>driver.id===r.motorista)?.name || r.motorista || 'A definir';
  const fields=[
    ['Cliente',r.cliente],['Telefone',r.telefone],['Veículo',`${r.veiculo} · ${r.placa}`],
    ['Serviço solicitado',r.servico],['Prioridade',r.prioridade],['Motorista',driverName],
    ['Origem',r.origem],['Destino',r.destino],['Observações',r.observacoes||'Sem observações']
  ];
  root.innerHTML=`
    <div class="os-actions no-print">
      <a class="button secondary" href="dashboard.html">Voltar à operação</a>
      <button class="button" id="print-os">Imprimir ou salvar em PDF</button>
    </div>
    <header class="os-header">
      <div class="os-brand"><img src="assets/fioretti-logo.jpeg" alt="Auto Socorro Fioretti"><div><strong>FIORETTI</strong><span>Auto Socorro</span></div></div>
      <div class="os-title"><span>ORDEM DE SERVIÇO</span><strong>${esc(r.protocolo)}</strong></div>
    </header>
    <section class="os-summary">
      <div><span>Status atual</span><b class="badge ${statusClass(r.status)}">${esc(r.status)}</b></div>
      <div><span>Aberta em</span><strong>${esc(date(r.createdAt))}</strong></div>
      <div><span>Última atualização</span><strong>${esc(date(r.updatedAt||r.createdAt))}</strong></div>
      <div><span>Valor do serviço</span><strong>${esc(currency(r.valor))}</strong></div>
    </section>
    <section class="os-section">
      <h1>Dados do atendimento</h1>
      <dl class="os-fields">${fields.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    </section>
    <section class="os-section os-confirmation">
      <h2>Confirmação do atendimento</h2>
      <p>Documento emitido com os dados atuais do atendimento. O status e a data de atualização são renovados a cada nova abertura desta ordem de serviço.</p>
      <div class="os-signatures"><div><span>Assinatura do cliente</span></div><div><span>Responsável Fioretti</span></div></div>
    </section>
    <footer class="os-footer"><span>Auto Socorro Fioretti · Atendimento 24h</span><span>(99) 99153-5877</span></footer>`;
  document.querySelector('#print-os').onclick=()=>window.print();
}

render().catch(error=>{root.innerHTML=`<section class="os-error"><h1>Não foi possível gerar a OS</h1><p>${esc(error.message||'Tente novamente.')}</p><a class="button" href="dashboard.html">Voltar à operação</a></section>`;});
