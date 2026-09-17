-- Execute uma vez, após 202609171000_usuarios.sql, no mesmo projeto Supabase.
begin;

-- Valor cobrado do cliente. Fica nulo até a central informar (o preço final muitas vezes só é conhecido após o atendimento).
alter table public.chamados add column valor numeric(10,2) check (valor is null or valor >= 0);

-- CREATE OR REPLACE preserva as concessões já feitas na migração anterior.
create or replace function public.criar_chamado(p_id uuid, p_dados jsonb) returns public.chamados
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := private.empresa_atual(); v_motorista uuid; v_valor numeric(10,2); v_row public.chamados;
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
  v_valor := nullif(p_dados->>'valor', '')::numeric(10,2);
  if v_valor is not null and v_valor < 0 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  insert into public.chamados(id, empresa_id, created_by, cliente, telefone, placa, veiculo, origem, destino,
    servico, prioridade, motorista_id, observacoes, valor, request_payload)
  values (p_id, v_empresa, auth.uid(), btrim(p_dados->>'cliente'), regexp_replace(p_dados->>'telefone', '[^0-9]', '', 'g'),
    upper(regexp_replace(p_dados->>'placa', '[-[:space:]]', '', 'g')), btrim(p_dados->>'veiculo'), btrim(p_dados->>'origem'),
    btrim(p_dados->>'destino'), p_dados->>'servico', p_dados->>'prioridade', v_motorista, coalesce(btrim(p_dados->>'observacoes'), ''), v_valor, p_dados)
  on conflict (id) do nothing returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.chamados where id = p_id and empresa_id = v_empresa and created_by = auth.uid() and request_payload = p_dados;
    if v_row.id is null then raise exception 'Identificador já utilizado. Recarregue o formulário antes de alterar os dados.' using errcode = '22023'; end if;
  end if;
  return v_row;
end $$;

-- A central corrige ou informa o valor a qualquer momento, mesmo após o atendimento concluído.
create function public.atualizar_valor(p_id uuid, p_valor numeric, p_expected timestamptz) returns public.chamados
language plpgsql security definer set search_path = '' as $$
declare v_row public.chamados;
begin
  if private.role_atual() is distinct from 'central' then raise exception 'Somente a central pode alterar o valor.' using errcode = '42501'; end if;
  if p_valor is not null and p_valor < 0 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  select * into v_row from public.chamados where id = p_id and empresa_id = private.empresa_atual() for update;
  if not found then raise exception 'Chamado indisponível.' using errcode = '42501'; end if;
  if v_row.updated_at is distinct from p_expected then raise exception 'Este chamado foi atualizado. Recarregue os detalhes.' using errcode = '40001'; end if;
  update public.chamados set valor = p_valor, updated_at = now() where id = p_id returning * into v_row;
  return v_row;
end $$;
revoke all on function public.atualizar_valor(uuid,numeric,timestamptz) from public, anon;
grant execute on function public.atualizar_valor(uuid,numeric,timestamptz) to authenticated;

-- SECURITY DEFINER: os indicadores gerenciais são exclusivos da central, não apenas escopados pela RLS do motorista.
create function public.kpis_periodo(p_inicio timestamptz default null, p_fim timestamptz default null)
returns table(status text, total bigint, valor_total numeric, ticket_medio numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.role_atual() is distinct from 'central' then raise exception 'Somente a central acessa os indicadores.' using errcode = '42501'; end if;
  return query
    select c.status, count(*), coalesce(sum(c.valor), 0)::numeric,
      case when count(c.valor) > 0 then round(sum(c.valor) / count(c.valor), 2) else null end
    from public.chamados c
    where c.empresa_id = private.empresa_atual()
      and (p_inicio is null or c.created_at >= p_inicio)
      and (p_fim is null or c.created_at < p_fim)
    group by c.status;
end $$;
revoke all on function public.kpis_periodo(timestamptz,timestamptz) from public, anon;
grant execute on function public.kpis_periodo(timestamptz,timestamptz) to authenticated;

commit;
