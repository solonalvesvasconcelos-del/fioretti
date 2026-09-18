const allowedTypes=new Set(['image/jpeg','image/png','image/webp']);
const maxDimension=1600;
const targetBytes=1200*1024;

export function dimensionsFor(width,height,limit=maxDimension) {
  if (!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1) throw new Error('Não foi possível ler o tamanho da foto.');
  const scale=Math.min(1,limit/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

function canvasBlob(canvas,quality) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível otimizar esta foto.')), 'image/jpeg', quality));
}

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    const bitmap=await createImageBitmap(file);
    return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close()};
  }
  const url=URL.createObjectURL(file);
  try {
    const image=await new Promise((resolve,reject)=>{
      const element=new Image();
      element.onload=()=>resolve(element);
      element.onerror=()=>reject(new Error('Não foi possível abrir esta foto.'));
      element.src=url;
    });
    return {source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>URL.revokeObjectURL(url)};
  } catch(error) { URL.revokeObjectURL(url); throw error; }
}

export async function optimizePhoto(file) {
  if (!file || !allowedTypes.has(file.type) || !file.size) throw new Error('Use uma foto JPG, PNG ou WebP válida.');
  const image=await loadImage(file);
  try {
    const size=dimensionsFor(image.width,image.height);
    const canvas=document.createElement('canvas');
    canvas.width=size.width; canvas.height=size.height;
    const context=canvas.getContext('2d',{alpha:false});
    context.fillStyle='#ffffff'; context.fillRect(0,0,size.width,size.height);
    context.drawImage(image.source,0,0,size.width,size.height);
    let quality=.82, blob=await canvasBlob(canvas,quality);
    while (blob.size>targetBytes&&quality>.48) { quality-=.08; blob=await canvasBlob(canvas,quality); }
    const name=(file.name||'checkin').replace(/\.[^.]+$/,'')+'.jpg';
    return {file:new File([blob],name,{type:'image/jpeg',lastModified:Date.now()}),originalBytes:file.size,bytes:blob.size,width:size.width,height:size.height};
  } finally { image.close(); }
}

export const formatBytes=bytes=>bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/(1024*1024)).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`;
