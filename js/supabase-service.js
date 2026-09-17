// O SDK cuida da renovação de sessão. O banco aplica autorização em todas as operações.
export function createSupabaseServices(getClient, validate) {
  const check = result => {
    if (result.error) throw new Error(result.error.message || 'Não foi possível concluir a operação.');
    return result.data;
  };
  const map = r => ({...r, createdAt:r.created_at, updatedAt:r.updated_at, motorista:r.motorista_id || ''});
  async function profile(client, id) {
    const row = check(await client.from('perfis').select('id,empresa_id,nome,role,ativo').eq('id',id).maybeSingle());
    if (!row?.ativo || !['central','motorista'].includes(row.role)) throw new Error('Seu acesso ainda não foi liberado. Fale com a central.');
    return {id:row.id, name:row.nome, role:row.role, empresaId:row.empresa_id};
  }
  return {
    mode:'supabase',
    auth:{
      async current() {
        const c = await getClient();
        const {session} = check(await c.auth.getSession());
        if (!session) return null;
        // Valida a sessão no servidor antes de usar o perfil. Não confia no conteúdo local do token.
        const result = await c.auth.getUser();
        if (result.error) {
          if ([401,403].includes(result.error.status)) { await c.auth.signOut({scope:'local'}); return null; }
          throw new Error('Não foi possível validar seu acesso. Verifique a conexão e tente novamente.');
        }
        return profile(c,result.data.user.id);
      },
      async signIn(email,password) {
        const c = await getClient();
        const result = await c.auth.signInWithPassword({email:email.trim(),password});
        if (result.error) throw new Error('Não foi possível entrar. Confira e-mail e senha ou tente novamente em instantes.');
        try { return await profile(c,result.data.user.id); }
        catch(e) { await c.auth.signOut({scope:'local'}); throw e; }
      },
      async signOut() { check(await (await getClient()).auth.signOut({scope:'local'})); },
      async watch(callback) {
        const {data} = (await getClient()).auth.onAuthStateChange(event=>{ if (event==='SIGNED_OUT') callback(); });
        return ()=>data.subscription.unsubscribe();
      }
    },
    drivers:{async list() {
      const rows=check(await (await getClient()).from('perfis').select('id,nome').eq('role','motorista').eq('ativo',true).order('nome'));
      return rows.map(r=>({id:r.id,name:r.nome}));
    }},
    chamados:{
      async list({search='',status='',driver='',offset=0}={}) {
        const rows=check(await (await getClient()).rpc('listar_chamados',{p_busca:search,p_status:status,p_motorista:driver||null,p_offset:offset}));
        return rows.map(map);
      },
      async summary() {
        return Object.fromEntries(check(await (await getClient()).rpc('resumo_chamados')).map(r=>[r.status,Number(r.total)]));
      },
      async get(id) { return map(check(await (await getClient()).from('chamados').select('*').eq('id',id).single())); },
      async create(input,id=crypto.randomUUID()) {
        const d=validate(input,{remote:true});
        const {motorista,...payload}=d;
        return map(check(await (await getClient()).rpc('criar_chamado',{p_id:id,p_dados:{...payload,motorista_id:motorista||null}})));
      },
      async updateStatus(id,status,expected) {
        return map(check(await (await getClient()).rpc('atualizar_status',{p_id:id,p_status:status,p_expected:expected})));
      },
      async assign(id,driver,expected) {
        return map(check(await (await getClient()).rpc('atribuir_motorista',{p_id:id,p_motorista:driver||null,p_expected:expected})));
      }
    },
    storage:{
      async upload(id,file) {
        if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024 || file.size===0)
          throw new Error('Escolha uma foto JPG, PNG ou WebP de até 5 MB.');
        const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
        const path=`${id}/${crypto.randomUUID()}.${extension}`;
        check(await (await getClient()).storage.from('chamado-fotos').upload(path,file,{contentType:file.type,upsert:false}));
        return path;
      },
      async list(id) {
        const bucket=(await getClient()).storage.from('chamado-fotos');
        const files=check(await bucket.list(id,{limit:100,sortBy:{column:'created_at',order:'desc'}})).filter(f=>f.id);
        if (!files.length) return [];
        const paths=files.map(f=>`${id}/${f.name}`);
        return check(await bucket.createSignedUrls(paths,60)).map(r=>{
          if (r.error || !r.signedUrl) throw new Error('Não foi possível abrir uma das fotos. Atualize os detalhes.');
          return {url:r.signedUrl};
        });
      }
    }
  };
}
