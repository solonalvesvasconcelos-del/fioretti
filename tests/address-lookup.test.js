import test from 'node:test';
import assert from 'node:assert/strict';
import {addressReference,formatCep,lookupCep,normalizeCep} from '../js/address-lookup.js';

test('normaliza e formata CEP',()=>{
  assert.equal(normalizeCep('65.900-000'),'65900000');
  assert.equal(formatCep('65900000'),'65900-000');
  assert.equal(addressReference({bairro:'Centro',localidade:'Imperatriz',uf:'MA'}),'Centro, Imperatriz - MA');
});
test('consulta o CEP e exige dados suficientes',async()=>{
  const fetchFn=async url=>({ok:true,json:async()=>({logradouro:'Rua Tamandaré',bairro:'Jardim São Luís',localidade:'Imperatriz',uf:'MA',url})});
  const result=await lookupCep('65900-000',{fetchFn});
  assert.equal(result.cep,'65900000');assert.equal(result.logradouro,'Rua Tamandaré');
  await assert.rejects(lookupCep('65900'),/8 dígitos/);
  await assert.rejects(lookupCep('65900000',{fetchFn:async()=>({ok:true,json:async()=>({erro:true})})}),/CEP não encontrado/);
});
