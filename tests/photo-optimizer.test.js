import test from 'node:test';
import assert from 'node:assert/strict';
import {dimensionsFor,formatBytes} from '../js/photo-optimizer.js';

test('reduz a imagem sem alterar a proporção',()=>{
  assert.deepEqual(dimensionsFor(4000,3000),{width:1600,height:1200});
  assert.deepEqual(dimensionsFor(800,600),{width:800,height:600});
  assert.deepEqual(dimensionsFor(900,1800),{width:800,height:1600});
});
test('rejeita dimensões inválidas e formata tamanhos',()=>{
  assert.throws(()=>dimensionsFor(0,100));
  assert.equal(formatBytes(1024),'1 KB');
  assert.match(formatBytes(1024*1024),/1/);
});
