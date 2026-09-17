-- Execute uma vez em um projeto Supabase novo. Nenhuma senha ou usuário é criado aqui.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 120)
);
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  role text not null check (role in ('central','motorista')),
  ativo boolean not null default true
);
create sequence public.chamado_protocolo_seq start 1001;
create table public.chamados (
  id uuid primary key,
  protocolo text not null unique default ('FIO-' || nextval('public.chamado_protocolo_seq')),
  empresa_id uuid not null references public.empresas(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cliente text not null check (length(btrim(cliente)) between 3 and 120),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  placa text not null check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  veiculo text not null check (length(btrim(veiculo)) between 3 and 120),
  origem text not null check (length(btrim(origem)) between 3 and 250),
  destino text not null check (length(btrim(destino)) between 3 and 250),
  servico text not null check (servico in ('Reboque','Pane mecânica','Pane elétrica','Pneu furado')),
  prioridade text not null check (prioridade in ('Normal','Urgente')),
  motorista_id uuid references public.perfis(id),
  observacoes text not null default '' check (length(observacoes) <= 1000),
  status text not null default 'Aguardando' check (status in ('Aguardando','Em atendimento','Concluído','Cancelado')),
  request_payload jsonb not null
);
create index chamados_empresa_data on public.chamados(empresa_id, created_at desc);
create index chamados_motorista_data on public.chamados(motorista_id, created_at desc);
create index perfis_empresa_role on public.perfis(empresa_id, role);

-- Funções internas evitam recursão das políticas de perfis. Nunca usam user_metadata.
create function private.empresa_atual() returns uuid language sql stable security definer
set search_path = '' as $$ select empresa_id from public.perfis where id = auth.uid() and ativo $$;
create function private.role_atual() returns text language sql stable security definer
set search_path = '' as $$ select role from public.perfis where id = auth.uid() and ativo $$;
revoke all on function private.empresa_atual(), private.role_atual() from public, anon;
grant execute on function private.empresa_atual(), private.role_atual() to authenticated;

alter table public.empresas enable row level security;
alter table public.perfis enable row level security;
alter table public.chamados enable row level security;
revoke all on public.empresas, public.perfis, public.chamados from anon, authenticated;
revoke all on sequence public.chamado_protocolo_seq from anon, authenticated;
grant select on public.perfis, public.chamados to authenticated;
create policy perfis_leitura on public.perfis for select to authenticated using (
  empresa_id = (select private.empresa_atual())
  and (id = (select auth.uid()) or (select private.role_atual()) = 'central')
);
create policy chamados_leitura on public.chamados for select to authenticated using (
  empresa_id = (select private.empresa_atual())
  and ((select private.role_atual()) = 'central' or motorista_id = (select auth.uid()))
);

-- As únicas escritas permitidas passam por estas operações; nenhuma edição direta via REST.
create function public.criar_chamado(p_id uuid, p_dados jsonb) returns public.chamados
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := private.empresa_atual(); v_motorista uuid; v_row public.chamados;
begin
  if private.role_atual() is distinct from 'central' or v_empresa is null then
    raise exception 'Somente a central pode criar chamados.' using errcode = '42501';
  end if;
  if p_id is null or p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  v_motorista := nullif(p_dados->>'motorista_id', '')::uuid;
  if v_motorista is not null and not exists (
    select 1 from public.perfis where id = v_motorista and empresa_id = v_empresa and role = 'motorista' and ativo
  ) then raise exception 'Motorista indisponível.' using errcode = '22023'; end if;
  insert into public.chamados(id, empresa_id, created_by, cliente, telefone, placa, veiculo, origem, destino,
    servico, prioridade, motorista_id, observacoes, request_payload)
  values (p_id, v_empresa, auth.uid(), btrim(p_dados->>'cliente'), regexp_replace(p_dados->>'telefone', '[^0-9]', '', 'g'),
    upper(regexp_replace(p_dados->>'placa', '[-[:space:]]', '', 'g')), btrim(p_dados->>'veiculo'), btrim(p_dados->>'origem'),
    btrim(p_dados->>'destino'), p_dados->>'servico', p_dados->>'prioridade', v_motorista, coalesce(btrim(p_dados->>'observacoes'), ''), p_dados)
  on conflict (id) do nothing returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.chamados where id = p_id and empresa_id = v_empresa and created_by = auth.uid() and request_payload = p_dados;
    if v_row.id is null then raise exception 'Identificador já utilizado. Recarregue o formulário antes de alterar os dados.' using errcode = '22023'; end if;
  end if;
  return v_row;
end $$;

create function public.atualizar_status(p_id uuid, p_status text, p_expected text) returns public.chamados
language plpgsql security definer set search_path = '' as $$
declare v_row public.chamados; v_role text := private.role_atual();
begin
  select * into v_row from public.chamados where id = p_id and empresa_id = private.empresa_atual()
    and (v_role = 'central' or motorista_id = auth.uid()) for update;
  if not found then raise exception 'Chamado indisponível.' using errcode = '42501'; end if;
  if v_row.status is distinct from p_expected then raise exception 'Este chamado foi atualizado. Recarregue os detalhes.' using errcode = '40001'; end if;
  if not ((v_row.status = 'Aguardando' and p_status = 'Em atendimento' and v_row.motorista_id is not null)
    or (v_row.status = 'Em atendimento' and p_status = 'Concluído')
    or (v_role = 'central' and v_row.status in ('Aguardando','Em atendimento') and p_status = 'Cancelado')) then
    raise exception 'Transição de status não permitida. Para iniciar, atribua um motorista.' using errcode = '22023';
  end if;
  update public.chamados set status = p_status, updated_at = now() where id = p_id returning * into v_row;
  return v_row;
end $$;

create function public.atribuir_motorista(p_id uuid, p_motorista uuid, p_expected timestamptz) returns public.chamados
language plpgsql security definer set search_path = '' as $$
declare v_row public.chamados; v_empresa uuid := private.empresa_atual();
begin
  if private.role_atual() is distinct from 'central' then raise exception 'Somente a central pode atribuir motoristas.' using errcode = '42501'; end if;
  select * into v_row from public.chamados where id = p_id and empresa_id = v_empresa for update;
  if not found then raise exception 'Chamado indisponível.' using errcode = '42501'; end if;
  if v_row.updated_at is distinct from p_expected then raise exception 'Este chamado foi atualizado. Recarregue os detalhes.' using errcode = '40001'; end if;
  if v_row.status <> 'Aguardando' then raise exception 'Atribua o motorista antes de iniciar o atendimento.' using errcode = '22023'; end if;
  if p_motorista is not null and not exists (select 1 from public.perfis where id = p_motorista and empresa_id = v_empresa and role = 'motorista' and ativo) then
    raise exception 'Motorista indisponível.' using errcode = '22023';
  end if;
  update public.chamados set motorista_id = p_motorista, updated_at = now() where id = p_id returning * into v_row;
  return v_row;
end $$;

-- SECURITY INVOKER: busca e contadores continuam submetidos à RLS do chamador.
create function public.listar_chamados(p_busca text default '', p_status text default '', p_motorista uuid default null,
  p_offset integer default 0) returns setof public.chamados language sql stable security invoker set search_path = '' as $$
  select * from public.chamados
  where (coalesce(p_status, '') = '' or status = p_status)
    and (p_motorista is null or motorista_id = p_motorista)
    and (coalesce(p_busca, '') = '' or strpos(lower(cliente || ' ' || placa || ' ' || protocolo), lower(p_busca)) > 0)
  order by created_at desc, id desc limit 50 offset greatest(p_offset, 0)
$$;
create function public.resumo_chamados() returns table(status text, total bigint)
language sql stable security invoker set search_path = '' as $$ select status, count(*) from public.chamados group by status $$;
revoke all on function public.criar_chamado(uuid,jsonb), public.atualizar_status(uuid,text,text),
  public.atribuir_motorista(uuid,uuid,timestamptz), public.listar_chamados(text,text,uuid,integer), public.resumo_chamados() from public, anon;
grant execute on function public.criar_chamado(uuid,jsonb), public.atualizar_status(uuid,text,text),
  public.atribuir_motorista(uuid,uuid,timestamptz), public.listar_chamados(text,text,uuid,integer), public.resumo_chamados() to authenticated;

-- Fotos em bucket privado. A pasta é o UUID do chamado, conferido pela política de leitura.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('chamado-fotos','chamado-fotos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy fotos_leitura on storage.objects for select to authenticated using (
  bucket_id = 'chamado-fotos' and exists (select 1 from public.chamados c where c.id::text = (storage.foldername(name))[1])
);
create policy fotos_envio on storage.objects for insert to authenticated with check (
  bucket_id = 'chamado-fotos' and exists (select 1 from public.chamados c where c.id::text = (storage.foldername(name))[1]
  and c.status in ('Aguardando','Em atendimento'))
);
-- Sem UPDATE/DELETE: não sobrescrever nem apagar comprovantes pelo navegador.
commit;
