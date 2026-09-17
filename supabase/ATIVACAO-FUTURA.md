# Ativação futura — não necessária para a simulação

Este material é uma proposta de integração e não foi aplicado a um projeto Supabase. Nenhuma alteração de banco ocorre ao abrir o site.

1. Crie um projeto de teste no Supabase e mantenha o modo local enquanto configura.
2. Revise e execute, em ordem, migrations/202609160001_operacao.sql e migrations/202609171000_usuarios.sql uma única vez no SQL Editor de um projeto novo. Não execute sobre tabelas existentes sem planejar uma migração específica.
3. Pelo painel administrativo de Auth, crie manualmente **o primeiro usuário da central** (é preciso ao menos um antes de a tela de usuários existir). Configure política de senhas e desative cadastro público, já que o uso é restrito à equipe.
4. Cadastre uma empresa em public.empresas e copie seu UUID. Em public.perfis, cadastre o UUID desse primeiro usuário com empresa_id, nome, role='central' e ativo=true. Não use metadados editáveis pelo usuário para conceder função de central.
5. Verifique que o bucket chamado-fotos é privado e que as políticas de tabelas, funções e Storage são as esperadas. Não adicione políticas amplas que liberem todos os registros.
6. Publique a Edge Function em functions/criar-usuario/index.ts (painel do projeto → Edge Functions → nova função, cole o código e implante). As variáveis SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente pela Supabase; não é preciso configurar nada manualmente.
7. Em js/config.js, preencha a URL HTTPS e a chave publicável (anon/publishable, nunca a service_role) e altere provider para 'supabase'.
8. A partir daí, use a tela **Usuários** (usuarios.html, visível para quem tem papel 'central') para criar os demais usuários da central e dos motoristas, em vez de repetir os passos 3-4 manualmente. Cada criação já gera o usuário de Auth e o perfil correspondente atomicamente.
9. Sirva por HTTPS e homologue: dois motoristas distintos, outra empresa, usuário inativo, sessão expirada, reatribuição, atualização concorrente, envio duplicado e acesso a fotos alheias. Teste também chamadas diretas à API; ocultar botões não é autorização.
10. Configure backups do banco **e dos objetos de Storage**, incluindo restauração testada. O ZIP do site não inclui esses dados.

A proposta usa RLS para leitura e funções controladas para alterações. Protocolos são gerados por sequência no banco. Uma requisição de criação pode ser repetida com o mesmo UUID e payload sem duplicar o chamado. Alterações de status e responsável conferem o estado esperado. Motoristas não podem cancelar ou atribuir chamados. Fotos têm links temporários de 60 segundos; um link já emitido pode permanecer válido até expirar mesmo se a atribuição mudar.

O frontend atual usa paginação de 50 registros e atualização a cada 30 segundos; não utiliza Realtime. Não há provisionamento de usuários pela aplicação, recuperação de senha na interface, backup automático, importação dos dados locais ou suporte a operação offline remota nesta etapa.

Referências oficiais: [Auth](https://supabase.com/docs/reference/javascript/auth), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [controle de fotos](https://supabase.com/docs/guides/storage/security/access-control).
