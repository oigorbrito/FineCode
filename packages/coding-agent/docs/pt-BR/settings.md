[English](../settings.md) | **Português (Brasil)**

# Referência de configurações

Esta referência lista as configurações disponíveis ao usuário, seus tipos, padrões e finalidades. As configurações do projeto têm prioridade sobre as configurações do diretório do agente. As listas de recursos são combinadas. Consulte [Configuração](configuration.md) para saber onde ficam os arquivos e como funciona a confiança no projeto.

O FineCode inclui seu [schema de configurações](../../schemas/settings.schema.json). O `$id`, `https://pi.dev/schemas/settings.schema.json`, continua sendo um URL hospedado pelo Pi upstream por compatibilidade; o FineCode não hospeda endpoints de schemas.

<a id="model-and-thinking"></a>
## Modelo e raciocínio

<a id="model-cycling"></a>

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `defaultProvider` | string | Automático | Provedor de IA inicial. |
| `defaultModel` | string | Automático | ID do modelo inicial. |
| `defaultThinkingLevel` | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max"` | `"medium"` | Nível de raciocínio inicial. |
| `modelThinkingLevels` | object | Nenhum | Níveis de raciocínio iniciais por modelo, identificados exatamente por `provider/modelId`. |
| `thinkingBudgets` | object | Limites integrados | Limites de tokens para os níveis de raciocínio `minimal`, `low`, `medium` e `high`. |
| `enabledModels` | `string[]` | Todos os modelos disponíveis | Padrões de modelos usados na seleção inicial e na alternância entre modelos. Usa o mesmo formato de `--models`. |
| `hideThinkingBlock` | boolean | `false` | Oculta blocos de raciocínio na transcrição. |
| `showCacheMissNotices` | boolean | `false` | Mostra avisos sobre faltas de cache significativas, aquecimento de cache bem-sucedido, uso de compactação e recuperação de provedores. |
| `cacheWarming` | `"off" \| "streaming" \| "idle"` | `"streaming"` | Mantém aquecidos os caches de prompt elegíveis durante a execução ativa ou, com `"idle"`, entre execuções. Configuração global somente. |

O aquecimento do cache só ocorre quando o modelo declara um tempo de vida de cache e o FineCode estima uma economia de pelo menos US$ 0,05 em custos de falta de cache. O uso para atualização conta nos totais da sessão, mas não entra no contexto do modelo. `/session` mostra a próxima decisão; extensões podem substituí-la com `cache_warming_decision`. Consulte [Tempos de vida do cache de prompt](models.md#prompt-cache-lifetimes).

Consulte [Escolha um modelo](models.md) para informações sobre seleção de modelos e controles de raciocínio.

## Interação

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | Como as mensagens de orientação enfileiradas são entregues. |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | Como as mensagens de acompanhamento enfileiradas são entregues. |
| `externalEditor` | string | `$VISUAL`, depois `$EDITOR` e, por fim, o padrão da plataforma | Comando aberto pelo atalho do editor externo. |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | Ação executada ao pressionar Escape duas vezes com o editor vazio. |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | Filtro inicial usado por `/tree`. |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | Comportamento padrão de confiança no projeto. **Só pode ser definido nas configurações do diretório do agente.** |

O comando do editor externo é separado em argumentos sem iniciar um shell. Coloque entre aspas caminhos do executável e argumentos que contenham espaços, por exemplo: `"C:\\Program Files\\Editor\\editor.exe" --wait`.

<a id="tools"></a>
## Ferramentas

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`, `bash`, `edit`, `write` | Ferramentas habilitadas na inicialização. Nomes simples substituem os padrões; `+name` adiciona uma ferramenta e `-name` a remove. Um array vazio desativa todas as ferramentas integradas, mas não as ferramentas de extensões ou do SDK. |
| `codemode.mode` | `"on"` \| `"only"` | `"on"` | Como a ferramenta `codemode` apresenta ferramentas enquanto está ativa. `on`: a descrição das ferramentas declaradas recebe uma nota sobre como chamá-las a partir de scripts, e `codemode` lista somente as ferramentas não declaradas. `only`: `codemode` lista todas as ferramentas que os scripts podem chamar, e as ferramentas integradas e de extensão ativas ficam ocultas para o modelo, que as acessa por meio de `codemode`. |
| `codemode.inlineBudget` | number | `3000` | Estimativa de tokens (caracteres / 4) que a descrição da ferramenta `codemode` pode usar para declarar ferramentas. Ferramentas que não couberem são omitidas e podem ser encontradas com `searchTools()`. O valor `0` lista somente namespaces. |

As ferramentas integradas disponíveis são `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find` e `ls`. `defaultTools` também pode incluir `codemode` e `tool_search`, registradas inativas por extensões integradas, além de outras ferramentas de extensões registradas inativas.

Uma lista contendo apenas entradas `+name` e `-name` altera a seleção herdada em vez de substituí-la. Por exemplo, isto habilita `codemode` junto às ferramentas padrão:

```json
{
  "defaultTools": ["+codemode"]
}
```

Isto substitui `bash` por `powershell` e habilita `grep`: `["-bash", "+powershell", "+grep"]`. As configurações do projeto são aplicadas sobre as do usuário: uma lista do projeto contendo apenas entradas `+name` e `-name` altera a seleção do usuário, enquanto uma lista com um nome simples a substitui. Em uma única lista, nomes simples definem a seleção; depois, `+name` e `-name` são aplicados na ordem em que aparecem.

`/reload` habilita ferramentas recém-adicionadas a `defaultTools`. Ele não desabilita ferramentas removidas nem reabilita ferramentas inalteradas que você desativou. `--tools` com nomes simples, `--no-tools` e `--no-builtin-tools` substituem `defaultTools`, inclusive após recarregar as configurações.

As opções de ferramentas da CLI substituem esta configuração em uma execução. `--tools` contendo apenas entradas `+name` e `-name` altera a seleção resolvida de `defaultTools`; por exemplo, `finecode --tools +codemode`. No `/reload`, essas entradas também são aplicadas à configuração recarregada, portanto uma ferramenta removida com `-name` continua removida. Consulte [Linha de comando](cli.md#tools).

<a id="sessions-and-context"></a>
## Sessões e contexto

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `sessionDir` | string | Diretório de sessões do agente | Diretório de armazenamento das sessões. Caminhos relativos são resolvidos a partir do diretório de trabalho. `PI_CODING_AGENT_SESSION_DIR` e `--session-dir` substituem esta configuração. |
| `sessionShareDestination` | `"auto" \| "gist" \| "radius"` | `"auto"` | Destino usado por `/share`. `auto` usa Radius quando autenticado; caso contrário, cria um gist no GitHub. `gist` sempre usa um gist. `radius` exige autenticação Radius e nunca recorre a um gist. |

<a id="compaction"></a>
### Compactação

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `compaction.enabled` | boolean | `true` | Habilita a compactação automática. |
| `compaction.reserveTokens` | number | `16384` | Quantidade de tokens livres de contexto abaixo da qual começa a compactação automática. |
| `compaction.keepRecentTokens` | number | `20000` | Quantidade de tokens recentes mantidos sem resumo. |
| `compaction.modelOverrides` | object | Nenhum | Configurações de tokens por modelo, identificadas exatamente por `provider/modelId`. |

<a id="per-model-compaction-overrides"></a>

Os valores de tokens da compactação devem ser inteiros seguros não negativos. Cada valor é resolvido independentemente a partir da substituição correspondente do modelo, depois da configuração comum de compactação e, por fim, do padrão integrado. Os objetos do projeto e do usuário são mesclados antes da consulta por modelo.

Consulte a [Referência de compactação](../compaction.md) para conhecer os limites, o resumo e o comportamento da validação.

### Resumos de ramificações

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | Tokens reservados ao resumir o histórico de uma ramificação. |
| `branchSummary.skipPrompt` | boolean | `false` | Ignora o prompt de resumo da ramificação e, por padrão, não cria um resumo. |

## Terminal e exibição

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `theme` | string | `"system"` | Nome de um tema integrado ou personalizado. `system` deriva as cores do tema do terminal. |
| `quietStartup` | boolean \| `"header"` | `false` | `true` oculta o cabeçalho inicial e a lista de recursos carregados. `"header"` mantém o cabeçalho (versão e atalhos), mas oculta a linha de escopo do modelo e a lista de recursos carregados. |
| `tuiMode` | `"regular" \| "fullscreen"` | `"fullscreen"` | Modo da interface de terminal interativa. |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | Saída exibida ao sair do modo de tela cheia. |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | Comportamento da barra de rolagem da transcrição em tela cheia. |
| `fullscreenCopyOnSelect` | boolean | `true` | Copia automaticamente o texto selecionado no modo de tela cheia. |
| `fullscreenWheelScrollLines` | `"auto"` \| number | `"auto"` | Linhas por evento da roda do mouse no modo de tela cheia, de 1 a 100. `"auto"` move uma linha por evento em terminais locais do macOS, que já aceleram a roda e o trackpad; em outros ambientes e via SSH, acelera giros rápidos para no máximo 6 linhas por evento. A roda com Alt move cinco vezes mais. |
| `editorPaddingX` | number | `0` | Espaçamento horizontal do editor, de 0 a 3 células. |
| `outputPad` | `0 \| 1` | `1` | Espaçamento horizontal da transcrição para mensagens, saídas de ferramentas, saídas de comandos `!` e blocos de resumo. |
| `autocompleteMaxVisible` | number | `5` | Itens de preenchimento automático visíveis, de 3 a 20. |
| `showHardwareCursor` | boolean | `false` | Usa o cursor do terminal em vez do cursor desenhado pelo FineCode. O FineCode ainda o posiciona para métodos de entrada. |
| `terminal.showImages` | boolean | `true` | Exibe imagens em linha quando houver suporte. |
| `terminal.imageWidthCells` | number | `60` | Largura preferencial de imagens em linha, em células do terminal. |
| `terminal.clearOnShrink` | boolean | `false` | Limpa linhas vazias quando o conteúdo renderizado diminui. |
| `terminal.showTerminalProgress` | boolean | `false` | Mostra o progresso OSC 9;4 na aba do terminal. |
| `terminal.hyperlinks` | `boolean \| "auto"` | `"auto"` | Substitui a detecção de hyperlinks OSC 8. |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | Substitui a detecção do protocolo de imagens em linha. |
| `terminal.trueColor` | `boolean \| "auto"` | `"auto"` | Substitui a detecção de truecolor. |
| `images.autoResize` | boolean | `true` | Redimensiona imagens para no máximo 2000 por 2000 pixels antes de enviá-las a um modelo. |
| `images.blockImages` | boolean | `false` | Impede o envio de imagens aos modelos. |
| `markdown.codeBlockIndent` | string | `"  "` | Prefixo usado para indentar blocos de código renderizados. |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Modo de renderização do Mermaid. |

Consulte [Temas](../themes.md) e [Configuração do terminal](terminal-setup.md) para detalhes de formato e plataforma.

## Rede e novas tentativas

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `transport` | `"auto" \| "sse" \| "websocket" \| "websocket-cached"` | `"auto"` | Transporte preferencial para provedores de IA compatíveis com vários transportes. |
| `httpProxy` | string | Nenhum | URL de proxy aplicada como `HTTP_PROXY` e `HTTPS_PROXY` aos clientes HTTP gerenciados pelo FineCode. **Só pode ser definida nas configurações do diretório do agente.** |
| `httpIdleTimeoutMs` | number | `300000` | Timeout de inatividade, em milissegundos, para cabeçalhos e corpo HTTP. Defina como `0` para desativar. |
| `websocketConnectTimeoutMs` | number | `15000` | Timeout de conexão WebSocket, em milissegundos. Defina como `0` para desativar. |
| `retry.enabled` | boolean | `true` | Habilita novas tentativas automáticas no nível do agente para falhas transitórias. |
| `retry.maxRetries` | number | `3` | Número máximo de novas tentativas no nível do agente. |
| `retry.baseDelayMs` | number | `2000` | Atraso inicial, em milissegundos, da espera exponencial. |
| `retry.maxAgentDelayMs` | number | `60000` | Atraso máximo de novas tentativas no nível do agente, em milissegundos. |
| `retry.provider.timeoutMs` | number | `httpIdleTimeoutMs` | Timeout de solicitação ao provedor, em milissegundos. |
| `retry.provider.maxRetries` | number | `0` | Número de novas tentativas no nível do provedor. |
| `retry.provider.maxRetryDelayMs` | number | `60000` | Atraso máximo solicitado pelo servidor, em milissegundos. Defina como `0` para desativar o limite. |

Mantenha `retry.provider.maxRetries` em `0`, a menos que novas tentativas no nível do provedor sejam necessárias. Elas podem atrasar o tratamento, pelo FineCode, de erros de cota e limite de uso.

## Shell

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `shellPath` | string | Padrão da plataforma | Caminho personalizado para o executável do shell. Aceita `~` no início. |
| `shellCommandPrefix` | string | Nenhum | Prefixo acrescentado a todos os comandos do shell. |
| `npmCommand` | `string[]` | `npm` | Comando e argumentos usados para consultar e instalar pacotes npm. |

Consulte [Aliases de shell](shell-aliases.md) para configurar o shell e [Pacotes FineCode](packages.md) para informações sobre o gerenciador de pacotes.

<a id="resources"></a>
## Recursos

Os caminhos de recursos nas configurações do usuário são resolvidos a partir do diretório do agente. Nas configurações do projeto, são resolvidos a partir do diretório `.pi` do projeto. Caminhos absolutos e `~` são aceitos.

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `packages` | array | `[]` | Fontes de pacotes FineCode npm, git ou locais. Consulte [Pacotes FineCode](../packages.md). |
| `extensions` | `string[]` | `[]` | Arquivos ou diretórios de extensões. |
| `skills` | `string[]` | `[]` | Arquivos ou diretórios de skills. |
| `prompts` | `string[]` | `[]` | Arquivos ou diretórios de modelos de prompt. |
| `themes` | `string[]` | `[]` | Arquivos ou diretórios de temas. |
| `enableSkillCommands` | boolean | `true` | Registra skills como comandos `/skill:name`. |

As listas de recursos aceitam exclusões por glob com `!pattern`, inclusão exata com `+path` e exclusão exata com `-path`. O FineCode carrega os recursos listados nas configurações do usuário e do projeto.

As extensões integradas são identificadas em `extensions` como `builtin:mcp`, `builtin:llama.cpp`, `builtin:codemode` e `builtin:tool-search`. Elas são carregadas por padrão; `-builtin:mcp` desativa uma delas. Uma entrada `+builtin:<name>` ou `-builtin:<name>` nas configurações do projeto substitui a configuração do usuário. `finecode config` as lista em Built-in. `--no-extensions` também as desativa, e `-e builtin:<name>` carrega uma explicitamente.

## Atualizações, telemetria e avisos

| Configuração | Tipo | Padrão | Descrição |
|---|---|---|---|
| `collapseChangelog` | boolean | `false` | Mostra um changelog resumido após uma atualização. |
| `enableInstallTelemetry` | boolean | `true` | Habilita o envio anônimo de relatórios de instalação/atualização para builds do Pi e determinados cabeçalhos de atribuição de provedores. O FineCode não envia relatórios de instalação ao Pi upstream; na interface de configurações do FineCode, esta opção é chamada `Provider attribution` e controla os cabeçalhos compatíveis dos provedores FineCode. Não controla as verificações de atualização. |
| `enableAnalytics` | boolean | `false` | Aceita compartilhar dados de análise. Atualmente, só é usado pela configuração experimental da primeira execução. |
| `warnings.anthropicExtraUsage` | boolean | `true` | Avisa quando a autenticação por assinatura Anthropic pode usar consumo extra pago. |
