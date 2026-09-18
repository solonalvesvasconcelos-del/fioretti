// Prévia local com o Node já disponível. Nenhum pacote precisa ser instalado.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpeg':'image/jpeg','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const port=Number(process.env.PORT||8081);
const server=http.createServer(async(req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const url=new URL(req.url,'http://127.0.0.1');
    let relative=decodeURIComponent(url.pathname);
    if(relative.endsWith('/'))relative+='index.html';
    if(!/^\/(?:index\.html|login\.html|dashboard\.html|novo-chamado\.html|usuarios\.html|indicadores\.html|integracoes\.html|os\.html|motorista\/index\.html|(?:css|js|assets)\/[a-zA-Z0-9_./-]+)$/.test(relative)){res.writeHead(404).end('Não encontrado');return;}
    const file=path.resolve(root,'.'+relative), extension=path.extname(file);
    if(!file.startsWith(root+path.sep)||!types[extension]){res.writeHead(404).end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extension],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end('Não encontrado');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'A porta 8081 está em uso. Feche a prévia anterior ou defina outra PORT.':e.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`Fioretti: http://127.0.0.1:${port}\nMantenha esta janela aberta. Ctrl+C encerra a prévia.`));
