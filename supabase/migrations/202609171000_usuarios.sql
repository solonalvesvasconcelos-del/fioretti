-- Execute uma vez, após 202609160001_operacao.sql, no mesmo projeto Supabase.
begin;

-- Ativa ou desativa um usuário da mesma empresa. Só a central pode chamar; ninguém desativa a própria conta.
create function public.alternar_usuario_ativo(p_id uuid, p_ativo boolean) returns public.perfis
language plpgsql security definer set search_path = '' as $$
declare v_row public.perfis; v_empresa uuid := private.empresa_atual();
begin
  if private.role_atual() is distinct from 'central' then
    raise exception 'Somente a central pode alterar usuários.' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'Você não pode desativar sua própria conta.' using errcode = '22023';
  end if;
  select * into v_row from public.perfis where id = p_id and empresa_id = v_empresa for update;
  if not found then raise exception 'Usuário indisponível.' using errcode = '42501'; end if;
  update public.perfis set ativo = p_ativo where id = p_id returning * into v_row;
  return v_row;
end $$;
revoke all on function public.alternar_usuario_ativo(uuid,boolean) from public, anon;
grant execute on function public.alternar_usuario_ativo(uuid,boolean) to authenticated;

commit;
