# Ativação futura — não necessária para a simulação

Este material é uma proposta de integração e não foi aplicado a um projeto Supabase. Nenhuma alteração de banco ocorre ao abrir o site.

1. Crie um projeto de teste no Supabase e mantenha o modo local enquanto configura.
2. Revise e execute migrations/202609160001_operacao.sql uma única vez no SQL Editor de um projeto novo. Não execute sobre tabelas existentes sem planejar uma migração específica.
3. Pelo painel administrativo de Auth, crie os usuários reais da central e dos motoristas. Configure política de senhas e desative cadastro público se o uso for restrito à equipe. Não distribua uma senha compartilhada.
4. Cadastre uma empresa em public.empresas e copie seu UUID. Em public.perfis, cadastre cada UUID de usuário de Auth com empresa_id, nome, role ('central' ou 'motorista') e ativo=true. Não use metadados editáveis pelo usuário para conceder função de central. Somente administradores do projeto podem provisionar os perfis.
5. Verifique que o bucket chamado-fotos é privado e que as políticas de tabelas, funções e Storage são as esperadas. Não adicione políticas amplas que liberem todos os registros.
6. Em js/config.js, preencha a URL HTTPS e a chave publicável e altere provider para 'supabase'. Chaves secretas e service_role nunca devem aparecer no site.
7. Sirva por HTTPS e homologue: dois motoristas distintos, outra empresa, usuário inativo, sessão expirada, reatribuição, atualização concorrente, envio duplicado e acesso a fotos alheias. Teste também chamadas diretas à API; ocultar botões não é autorização.
8. Configure backups do banco **e dos objetos de Storage**, incluindo restauração testada. O ZIP do site não inclui esses dados.

A proposta usa RLS para leitura e funções controladas para alterações. Protocolos são gerados por sequência no banco. Uma requisição de criação pode ser repetida com o mesmo UUID e payload sem duplicar o chamado. Alterações de status e responsável conferem o estado esperado. Motoristas não podem cancelar ou atribuir chamados. Fotos têm links temporários de 60 segundos; um link já emitido pode permanecer válido até expirar mesmo se a atribuição mudar.

O frontend atual usa paginação de 50 registros e atualização a cada 30 segundos; não utiliza Realtime. Não há provisionamento de usuários pela aplicação, recuperação de senha na interface, backup automático, importação dos dados locais ou suporte a operação offline remota nesta etapa.

Referências oficiais: [Auth](https://supabase.com/docs/reference/javascript/auth), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [controle de fotos](https://supabase.com/docs/guides/storage/security/access-control).
