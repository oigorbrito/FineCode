# Inventário inicial — identidade

Escopo medido em `dbfb63e` (baseline), antes de editar o código. As contagens são por arquivo versionado contendo o termo; categorias se sobrepõem e não devem ser somadas.

## Medidas

- Baseline: **1.927 arquivos**; busca por `FineCode`/`finecode`: **0 arquivos**.
- **854 arquivos** contêm pelo menos um dos padrões de identidade pesquisados (`pi-monorepo`, `@earendil-works`, `pi.dev`, URL upstream, `.pi` ou `PI_`). É uma busca de descoberta, não uma lista de arquivos a renomear.
- `@earendil-works`: **728 arquivos**; `PI_`: **317**; `.pi`: **215**; `github.com/earendil-works/pi`: **96**; `pi.dev`: **62**; `pi-monorepo`: **5**. Contagens independentes e sobrepostas.

## Estado da implementação

- Workspace raiz privado: `finecode-monorepo`; manifesto npm do CLI: `finecode`; comandos `finecode` e alias legado `pi` apontam ao mesmo bundle.
- Configuração de usuário permanece em `.pi`; variáveis `PI_CODING_AGENT_DIR` e `PI_CODING_AGENT_SESSION_DIR` são lidas como fallback às novas `FINECODE_*`.
- Atualização FineCode usa o endpoint `finecode/latest` do npm; fluxos Pi existentes não foram redirecionados.
- Exemplos de CLI e SDK usam `finecode`; os exemplos npm têm nomes FineCode. O campo de manifesto `pi` permanece por compatibilidade, assim como o carregador aceita `@earendil-works/pi-coding-agent`.
- Referências a Pi em documentação identificam serviços, kits ou projetos upstream; não há pacote npm nem imagem FineCode publicada.

- Documentação bilíngue: 41/41 artigos da navegação agora têm versão pt-BR em `packages/coding-agent/docs/pt-BR/`; README raiz, CONTRIBUTING, SECURITY e README do pacote também têm traduções. Os originais em inglês foram mantidos com links de idioma. Validação de links e âncoras passou em 45 arquivos, e as 41 entradas da navegação apontam para arquivos existentes. A revisão de paridade restaurou os exemplos de payload/resposta que faltavam na referência RPC; ambas as versões agora contêm os mesmos 81 blocos de código.

## Referências Pi remanescentes — classificação

- **Compatibilidade**: executável/alias `pi`, alvo legado `finecode update pi`, import SDK `@earendil-works/pi-coding-agent`, metadata key `pi` e variáveis `PI_*`. `PI_CODING_AGENT=true` continua como marcador legado; `AI_AGENT` agora identifica o app (`finecode` neste build).
- **Interfaces/continuidade visíveis**: o diálogo de login OAuth identifica FineCode e a mensagem de porta ocupada agora menciona uma sessão FineCode; logs de redraw/crash do TUI usam `finecode-tui-*` quando `AI_AGENT=finecode`; o wordmark de startup agora exibe `<FC> FineCode`, sem alterar o título ou comportamento. A configuração que controla headers de atribuição aparece como `Provider attribution` no FineCode, preservando o id de settings `install-telemetry` para compatibilidade. A documentação de opções OAuth MCP descreve o nome do cliente como o nome do app em execução, em vez de fixá-lo em Pi. O onboarding de telemetria que menciona Pi só é exibido no pacote oficial Pi. Exemplos FineCode usam sua identidade nas saídas (como o prefixo de commit automático e o spinner padrão), mantendo `pi` em APIs de extensão, caminhos e integrações upstream. A coleção de exemplos foi enxugada a pedido do mantenedor: removidos os jogos Doom, Snake, Space Invaders e Tic-Tac-Toe, além de demos de novidade Pirate e Rainbow Editor; nenhuma funcionalidade do produto foi retirada nessa poda. Separadamente, a pedido do mantenedor, foram removidos o easter egg upstream `/dementedelves` e sua imagem do peixe, além de imagens órfãs do Doom e do antigo rodapé (`doom-extension.png`, `exy.png`); screenshots úteis da documentação e fixtures de teste permanecem.
- O pacote TUI genérico mantém `pi-tui-*` como padrão.
- **Dados e protocolos**: `.pi` e `~/.pi/agent`, nomes de custom entries/símbolos e mensagens de worker; preservar para não invalidar sessões, configurações, integrações e extensões existentes.
- **Upstream**: `pi.dev`, `radius.pi.dev`, schemas, instaladores, galerias, o viewer de sessions de gist e links/repositórios de Pi são identificados como upstream (incluindo referências a source code em docs de SDK/TUI/RPC); o crédito de doação do domínio `pi.dev` aparece contextualizado na seção do projeto Pi no README, não como rodapé FineCode. FineCode não reivindica esses serviços. Em `nix/package.nix`, `meta.homepage` continua apontando para `pi.dev` como metadado upstream porque não há URL canônica FineCode aprovada; isso não deve ser interpretado como site do FineCode. `CONTRIBUTING.md`, templates de issues e workflows de publicação continuam vinculados ao repositório/serviços upstream; não foram reescritos nem redirecionados sem um destino FineCode aprovado. O pacote FineCode ignora `PI_MANAGED_INSTALL_ROOT` e não usa o instalador gerenciado Pi, mesmo se o marcador for herdado. O envio de relatórios de instalação para a telemetria Pi foi desativado no pacote FineCode.
- **Provider attribution**: FineCode se identifica como `FineCode`/`finecode` nos headers compatíveis de OpenRouter, NVIDIA, Cloudflare e OpenCode e nos nomes de aplicativo enviados aos fluxos de login OAuth compatíveis; não envia referer `pi.dev`. Instalações Pi mantêm sua atribuição anterior.
- **Histórico e dependências**: changelogs, snapshots de sessão, nomes `@earendil-works/pi-*` e exemplos de APIs que recebem o objeto `pi` mantêm referências históricas/técnicas; não são nome do comando FineCode.
- **Comando canônico**: documentação e exemplos executáveis usam `finecode`; referências ao comando `pi` identificam o alias de compatibilidade ou uma integração upstream.

## Ocorrências representativas e decisão inicial

| Superfície | Estado no baseline | Tratamento proposto |
|---|---|---|
| Identidade pública | `README.md` apresenta Pi, `pi.dev`, instaladores e marca | Migrar marca e canais próprios apenas após confirmar destinos FineCode disponíveis. |
| Nome npm/CLI | Raiz `pi-monorepo`; CLI `@earendil-works/pi-coding-agent`, executável `pi` | Atualizar para o escopo aprovado, incluindo nome canônico npm `finecode`; verificar manifests, lockfiles, instaladores e publicação sem publicar nesta tarefa. |
| Pacotes internos | `@earendil-works/pi-*` em produção, testes e scripts | Mudança potencialmente incompatível. Comparar com o desenho validado no backup e renomear somente os pacotes que pertencem ao produto; manter dependências externas intactas. |
| Diretórios/configuração | `.pi`, `~/.pi/agent` e `PI_*` | Interface técnica e dados existentes. Migrar com fallback/compatibilidade aprovados; não mover nem apagar dados do usuário. |
| Upstream e terceiros | `pi.dev`, repositório upstream, providers e `@earendil-works/*` | Distinguir serviço/dependência upstream de identidade FineCode; manter atribuição e referências externas corretas. |
| Licença/atribuição | `LICENSE` e créditos no projeto | Preservar; não são alvos de rebranding. |

## Triagem de risco — orientação atual

A instrução é conservar qualquer identificador cuja troca possa quebrar consumidores ou comportamento; a identidade deve avançar pelos outros itens, sem bloquear o trabalho inteiro.

| Identificador | Risco concreto | Decisão nesta etapa |
|---|---|---|
| `@earendil-works/pi-*` em imports/dependências | Quebra resolução de módulos, workspace, lockfiles e possíveis consumidores | **Não renomear** sem prova de que todos os pacotes e consumidores foram migrados e validados. |
| Binário/comando `pi` | Quebra scripts, integrações, instruções e usuários existentes | **Não remover nem substituir** sem compatibilidade comprovada. Nome FineCode pode ser adicionado em paralelo se tecnicamente validado. |
| `.pi`, `~/.pi/agent`, `PI_*` | Pode ocultar configurações, credenciais, extensões e sessões já existentes | **Preservar**; não mover/apagar dados. Só adicionar preferência FineCode com fallback depois de validar o código. |
| Formatos de sessão, chaves de settings, protocolos e headers | Pode invalidar dados persistidos ou integração externa | **Não alterar** nesta entrega. |
| URL `pi.dev`, schemas/instaladores e endpoints upstream | Pode apontar para serviços necessários ou não controlados pelo FineCode | **Preservar** enquanto não existir destino próprio verificado. |
| Nome npm `finecode` | Nome confirmado pelo mantenedor, mas publicar/renomear o pacote CLI afeta manifests, lockfiles e consumidores | Tratar como alvo aprovado, mas só mudar depois de provar o caminho de empacotamento e dependências; sem publicar nesta tarefa. |
| Texto de marca em documentação/apresentação própria | Normalmente não altera execução, desde que links e atribuições continuem corretos | **Pode avançar** quando a ocorrência for confirmada como identidade do produto, e não referência upstream/legal. |

## Limites e validação final

- Comparação por SHA-256 do backup com os **1.927 caminhos versionados** do baseline: **1.027 idênticos**, **872 diferentes**, **28 ausentes** no snapshot; o snapshot tem **2.874 arquivos extras**. Logo, o backup não é uma cópia integral equivalente: foi usado apenas como referência, sem cópia integral em lote.
- Validação final: 141 testes combinados do coding-agent (editor externo, package manager e SSH) passaram; a suíte completa do TUI passou; `npm run test:scripts` passou em 44/44. Biome (1.475 arquivos), install-lock, imports TypeScript, entry graphs e `git diff --check` passaram. Auditoria de 88 arquivos Markdown encontrou zero links/âncoras quebrados, zero destinos de navegação ausentes e zero divergências de fences EN/pt-BR; a navegação pt-BR contém 41 guias. Os testes do editor externo, incluindo executável e argumentos com espaços/aspas, passam no Windows.
- `tsc --noEmit --pretty false` reporta 1.056 diagnósticos atuais contra 1.061 no baseline `dbfb63e`, com zero novos tipos de diagnóstico e cinco diagnósticos OpenAI Responses somente no baseline. Persistem erros do catálogo e a ausência baseline de `packages/ai/src/providers/data/amazon-bedrock.json`, que bloqueia algumas suítes dependentes de catálogo. O typecheck de exemplos falha em módulos internos não resolvidos e ainda não foi comparado ao baseline. `npm run check` não tem resultado limpo por esses diagnósticos conhecidos.
- Nix 2.35.3 foi instalado no Ubuntu WSL; `nix-command` e `flakes` foram habilitados para o usuário. `nix flake check --all-systems --no-build` passou; `nix build .#finecode --no-link` passou para Linux `x86_64`; os binários gerados responderam `1.3.0` tanto em `finecode --version` quanto no alias `pi --version`. `config.test.ts` ainda tem as mesmas sete falhas Windows de instalação global/permissões verificadas no baseline. Revisão integral concluída: 266 caminhos rastreados e 50 novos revisados, sem arquivos staged. Nix não valida macOS, ARM ou Windows nativo.
