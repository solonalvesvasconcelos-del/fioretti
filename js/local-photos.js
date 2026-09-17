// Fotos da demonstração ficam somente neste navegador, em IndexedDB.
let database;
async function open() {
  if (!database) database = new Promise((resolve,reject)=>{
    const request=indexedDB.open('fioretti-fotos-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('fotos',{keyPath:'id'}).createIndex('chamado','chamado');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('Não foi possível abrir o armazenamento de fotos do navegador.'));
  }).catch(e=>{database=undefined;throw e;});
  return database;
}
export const localPhotos={
  async upload(chamado,file) {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size===0 || file.size>5*1024*1024)
      throw new Error('Escolha uma foto JPG, PNG ou WebP de até 5 MB.');
    const db=await open(), id=crypto.randomUUID();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('fotos','readwrite');
      tx.objectStore('fotos').add({id,chamado,file,createdAt:Date.now()});
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(new Error('Não foi possível salvar a foto. Verifique o espaço disponível no navegador.'));
      tx.onabort=()=>reject(new Error('O envio da foto foi interrompido. Tente novamente.'));
    });
    return id;
  },
  async list(chamado) {
    const db=await open();
    const rows=await new Promise((resolve,reject)=>{
      const request=db.transaction('fotos').objectStore('fotos').index('chamado').getAll(chamado);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(new Error('Não foi possível carregar as fotos.'));
    });
    return rows.sort((a,b)=>b.createdAt-a.createdAt).slice(0,100).map(r=>({url:URL.createObjectURL(r.file)}));
  }
};
