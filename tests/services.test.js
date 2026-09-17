import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {localServices as services,validate} from '../js/services.js';
import {parseValor} from '../js/valor.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),clear:()=>m.clear()};};
globalThis.localStorage=memory();globalThis.sessionStorage=memory();
beforeEach(async()=>{localStorage.clear();sessionStorage.clear();await services.auth.signIn('central','');});
const valid={cliente:'Cliente Teste',telefone:'(11) 99999-0000',placa:'abc-1234',veiculo:'Fiat Uno',origem:'Rua A, 100',destino:'Oficina B',servico:'Reboque',prioridade:'Normal',motorista:'Ana Costa',observacoes:'Teste'};
test('valida cadastro e normaliza placa',()=>{assert.equal(validate(valid).placa,'ABC1234');for(const field of ['cliente','telefone','placa','origem','destino','veiculo','servico','prioridade'])assert.throws(()=>validate({...valid,[field]:''}));assert.throws(()=>validate({...valid,cliente:'   '}));assert.throws(()=>validate({...valid,motorista:'Inexistente'}));});
test('semeia uma vez, persiste cadastro e restringe transições',async()=>{localStorage.clear();assert.equal((await services.chamados.list()).length,6);assert.equal((await services.chamados.list()).length,6);const row=await services.chamados.create(valid);assert.equal((await services.chamados.list()).length,7);assert.equal(row.protocolo,'RB-1007');assert.equal(JSON.parse(localStorage.getItem('reboque.chamados.v1'))[0].placa,'ABC1234');await assert.rejects(services.chamados.updateStatus(row.id,'Concluído'));await services.chamados.updateStatus(row.id,'Em atendimento');await services.chamados.updateStatus(row.id,'Concluído');await assert.rejects(services.chamados.updateStatus(row.id,'Cancelado'));await assert.rejects(services.chamados.updateStatus('missing','Cancelado'));});
test('preserva lista vazia e dados corrompidos',async()=>{localStorage.setItem('reboque.chamados.v1','[]');assert.deepEqual(await services.chamados.list(),[]);localStorage.setItem('reboque.chamados.v1','broken');await assert.rejects(services.chamados.list(),/inválidos/);assert.equal(localStorage.getItem('reboque.chamados.v1'),'broken');});
test('falha de armazenamento é comunicada',async()=>{const original=globalThis.localStorage;globalThis.localStorage={getItem:()=>null,setItem:()=>{throw Error('quota');}};await assert.rejects(services.chamados.list(),/salvar/);globalThis.localStorage=original;});
test('sessão de demonstração e saída',async()=>{await services.auth.signOut();assert.equal(await services.auth.current(),null);await services.auth.signIn('motorista','Ana Costa');assert.equal((await services.auth.current()).name,'Ana Costa');await services.auth.signOut();assert.equal(await services.auth.current(),null);await assert.rejects(services.auth.signIn('admin',''));await assert.rejects(services.chamados.list(),/Entre/);});

test('motorista consulta e atualiza apenas os próprios chamados na simulação',async()=>{
  const own=await services.chamados.create(valid);
  const other=await services.chamados.create({...valid,motorista:'Carlos Silva'});
  await services.auth.signIn('motorista','Ana Costa');
  assert.ok((await services.chamados.list()).every(r=>r.motorista==='Ana Costa'));
  await assert.rejects(services.chamados.get(other.id));
  await assert.rejects(services.chamados.create(valid));
  await assert.rejects(services.chamados.assign(own.id,'Marcos Lima'));
  await assert.rejects(services.chamados.updateStatus(other.id,'Em atendimento'));
  await assert.rejects(services.chamados.updateStatus(own.id,'Cancelado'));
  await services.chamados.updateStatus(own.id,'Em atendimento','Aguardando');
  assert.equal((await services.chamados.get(own.id)).status,'Em atendimento');
});

test('atribuição e proteção contra repetição ou dados desatualizados',async()=>{
  const id=crypto.randomUUID();
  const row=await services.chamados.create({...valid,motorista:''},id);
  await services.chamados.create({...valid,motorista:''},id);
  assert.equal((await services.chamados.list()).filter(r=>r.id===id).length,1);
  await assert.rejects(services.chamados.create({...valid,cliente:'Outro nome'},id));
  await assert.rejects(services.chamados.updateStatus(id,'Em atendimento','Aguardando'));
  await services.chamados.assign(id,'Ana Costa',row.updatedAt);
  await assert.rejects(services.chamados.assign(id,'Marcos Lima','2000-01-01'));
  await services.chamados.updateStatus(id,'Em atendimento','Aguardando');
  await assert.rejects(services.chamados.updateStatus(id,'Concluído','Aguardando'));
});

test('busca, filtro e paginação preservam contadores totais',async()=>{
  localStorage.setItem('reboque.chamados.v1','[]');
  for(let i=0;i<55;i++)await services.chamados.create({...valid,cliente:`Cliente ${i}`});
  assert.equal((await services.chamados.list()).length,50);
  assert.equal((await services.chamados.list({offset:50})).length,5);
  assert.equal((await services.chamados.summary()).Aguardando,55);
  assert.equal((await services.chamados.list({search:'Cliente 54'})).length,1);
  assert.equal((await services.chamados.list({status:'Concluído'})).length,0);
});

test('parseValor aceita valores opcionais e rejeita entradas inválidas',()=>{
  assert.equal(parseValor(''),null);
  assert.equal(parseValor(undefined),null);
  assert.equal(parseValor('150'),150);
  assert.equal(parseValor('150,5'),150.5);
  assert.equal(parseValor('99.999'),100); // arredonda para 2 casas
  for(const raw of ['-10','abc','1000000'])assert.throws(()=>parseValor(raw));
});

test('validate() normaliza o valor cobrado e create() persiste o campo',async()=>{
  assert.equal(validate(valid).valor,null);
  assert.equal(validate({...valid,valor:'250'}).valor,250);
  assert.throws(()=>validate({...valid,valor:'-5'}));
  const row=await services.chamados.create({...valid,valor:'320.5'});
  assert.equal(row.valor,320.5);
});

test('updateValor é exclusivo da central e respeita a concorrência otimista',async()=>{
  const row=await services.chamados.create(valid);
  await assert.rejects(services.chamados.updateValor(row.id,300,'2000-01-01'));
  const updated=await services.chamados.updateValor(row.id,300,row.updatedAt);
  assert.equal(updated.valor,300);
  await services.auth.signIn('motorista','Ana Costa');
  await assert.rejects(services.chamados.updateValor(row.id,400,updated.updatedAt));
});
