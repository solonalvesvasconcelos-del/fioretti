import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pages=['index.html','login.html','dashboard.html','novo-chamado.html','usuarios.html','motorista/index.html'];
let count=0;
for(const page of pages){
  const source=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(source,/<html lang="pt-BR">/);
  for(const [,ref] of source.matchAll(/(?:src|href)="([^"]+)"/g)){
    if(/^(?:https?:|tel:|#)/.test(ref))continue;
    const localRef=ref.split(/[?#]/,1)[0];
    assert.ok(fs.existsSync(path.resolve(root,path.dirname(page),localRef)),`${page}: ${ref}`);count++;
  }
  const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,`IDs duplicados em ${page}`);
}
console.log(`${pages.length} páginas e ${count} referências locais verificadas.`);
