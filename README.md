# Auto Socorro Fioretti — simulação local

Sistema em HTML, CSS e JavaScript puro, com a identidade visual fornecida pela Fioretti. Esta entrega funciona como **simulação no navegador**, sem instalação de pacotes, banco, conta externa ou chaves reais.

## Abrir agora

Na máquina utilizada para criar o projeto, o Node já está disponível:

1. Extraia o ZIP.
2. Abra **INICIAR.cmd** na pasta do projeto. Ele usa o Node existente e não instala nada.
3. Acesse **http://127.0.0.1:8081/** e mantenha a janela da prévia aberta.

Alternativa no terminal, na pasta do projeto:

```sh
node scripts/serve.mjs
```

Se não houver Node em outra máquina, utilize qualquer servidor web já disponível para servir a pasta. Não é necessário executar npm install, compilar o projeto ou instalar dependências. Os módulos JavaScript precisam de HTTP/HTTPS; abrir index.html por duplo clique não é suportado.

O servidor de prévia atende somente na própria máquina e não deve ser exposto à internet. É possível usar outra porta com a variável PORT. Alterar a porta ou o domínio cria uma origem de armazenamento diferente no navegador.

## O que funciona na simulação

- Entrada demonstrativa como central ou um dos três motoristas fictícios.
- Dashboard com contadores de todos os chamados acessíveis, busca, filtro por status e páginas de até 50 registros.
- Cadastro com validação de cliente, telefone, placa, veículo, serviço e trajeto.
- Atribuição de motorista na abertura ou posteriormente pelos detalhes.
- Fluxo Aguardando → Em atendimento → Concluído. A central também pode cancelar chamados ativos.
- Motoristas veem apenas os atendimentos atribuídos ao perfil escolhido e não podem cancelar ou distribuir chamados pela interface.
- Fotos JPG, PNG ou WebP até 5 MB por arquivo, gravadas no navegador e disponíveis após recarregar. Os detalhes mostram até 100 fotos recentes.
- Atualização manual, atualização periódica quando a página está visível e sincronização de chamados entre abas da mesma origem.
- Layout para computador e celular, com logotipo e fotografia originais da Fioretti, azul institucional, vermelho e azul-escuro.

### Roteiro de simulação

1. Entre como **Central de atendimento**.
2. Crie um chamado fictício, deixando o motorista para atribuir depois.
3. Abra o protocolo na tabela, escolha **Ana Costa** e salve o responsável.
4. Envie uma foto de teste pelos detalhes.
5. Saia e entre como **Motorista → Ana Costa**.
6. Abra o atendimento, clique em **Iniciar atendimento** e depois **Concluir atendimento**.
7. Recarregue e confira a persistência do status e da foto.

Os seis chamados iniciais são exemplos. Os perfis de demonstração não têm senha. Restrições implementadas no navegador servem para simular o fluxo e **não são autenticação ou autorização de produção**.

## Subir a simulação no servidor depois

Copie estes arquivos e pastas para o diretório público do seu servidor:

```text
index.html
login.html
dashboard.html
novo-chamado.html
usuarios.html
motorista/
css/
js/
assets/
```

Use a estrutura sem mudar os nomes. Os caminhos são relativos e permitem publicar tanto na raiz quanto em um subdiretório, por exemplo /fioretti/. O servidor deve servir .js como JavaScript e não substituir arquivos inexistentes por index.html. Não é preciso configurar rotas de aplicação, PHP ou backend para esta simulação.

**Enviar os arquivos ao servidor não transforma a demonstração em um sistema compartilhado.** Os dados continuarão locais ao navegador. Para central e motoristas em dispositivos diferentes usarem os mesmos registros, ainda será necessário ativar e validar o backend real.

Não envie scripts/, tests/ ou supabase/ para o diretório público; são ferramentas de desenvolvimento e material para a integração futura. Também não envie informações reais de clientes ou credenciais.

### GitHub Pages, se desejar

O mesmo conjunto estático pode ser enviado à raiz de um repositório junto de .nojekyll. Em Settings → Pages, selecione Deploy from a branch → main → /(root). A disponibilidade em repositórios privados depende do plano. [Documentação oficial](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

O repositório armazena os arquivos do sistema. O provedor de dados é controlado por js/config.js (provider: 'local' ou 'supabase'); quando 'supabase', os registros vão para o projeto configurado, não para o navegador nem para o GitHub.

## Onde ficam os dados

| Dados | Local |
| --- | --- |
| Chamados | localStorage, chave reboque.chamados.v1 |
| Perfil da aba | sessionStorage, chave reboque.sessao.v1 |
| Fotos | IndexedDB, banco fioretti-fotos-v1 |

Fechar a aba encerra a sessão demonstrativa. Os chamados e fotos permanecem até que o armazenamento do navegador seja apagado. A pasta/ZIP contém o sistema, **não os dados de teste digitados no navegador**. Não há backup automático, sincronização entre máquinas ou garantia de gravação simultânea em várias abas.

Para reiniciar a demonstração, remova essas duas chaves e o banco fioretti-fotos-v1 nas ferramentas do navegador. Isso apaga seus registros e fotos locais; recarregar recria os seis exemplos.

## Organização do código

- js/app.js: ponto de entrada.
- js/ui.js: telas, formulários, filtros, atualização e detalhes.
- js/services.js: validação, serviços da simulação e seleção do provedor.
- js/local-photos.js: armazenamento local das fotos.
- js/config.js: define o provedor ativo (local ou supabase) e as credenciais públicas.
- js/supabase-client.js e js/supabase-service.js: adaptador para o backend real quando provider é 'supabase'.
- usuarios.html: tela de gerenciamento de usuários (criar central/motorista, ativar/desativar) — só funciona com provider 'supabase' e para quem tem papel 'central'.
- css/style.css: base responsiva; css/fioretti.css: identidade da Fioretti e ajustes da operação.
- assets/: arquivos fornecidos pelo usuário, sem modificar o logotipo original.
- supabase/migrations/: SQL do banco (rodar em ordem, uma vez cada, no SQL Editor do projeto).
- supabase/functions/criar-usuario/: Edge Function que cria o usuário de Auth + perfil; é a única peça que usa a chave service_role, e roda no servidor da Supabase, nunca no navegador.

## Supabase: backend real

Este projeto pode rodar em dois modos, controlados por js/config.js: `provider: 'local'` (demonstração, dados só no navegador) ou `provider: 'supabase'` (backend real, dados compartilhados entre central e motoristas). Ativar o modo Supabase exige criar o projeto, aplicar as migrações de supabase/migrations/ em ordem, provisionar empresa e perfis, publicar a Edge Function de supabase/functions/ e homologar isolamento entre usuários/empresas, acesso às fotos, sessões e concorrência antes de distribuir credenciais reais. Veja o passo a passo em supabase/ATIVACAO-FUTURA.md.

O modo local não carrega bibliotecas externas e não faz chamadas ao Supabase. O adaptador futuro, quando ativado, carrega o SDK oficial de uma CDN com versão fixa; depende de conexão à internet.

## Validação

Os testes usam apenas recursos do Node já instalado:

```sh
node --test tests/*.test.js
```

Em ambientes que impedem a criação de subprocessos, com Node 22 ou superior:

```sh
node --test --test-isolation=none tests/*.test.js
```

Cobertura: validação, persistência, armazenamento inválido/indisponível, sessão, restrições do perfil demonstrativo, repetição de envio, atualização desatualizada, busca, paginação e rejeição de credenciais secretas na configuração futura. O uso de fotos e o fluxo central/motorista foram verificados no navegador. Testes locais não substituem a homologação do backend real.
