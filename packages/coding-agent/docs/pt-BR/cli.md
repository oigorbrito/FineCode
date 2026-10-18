[English](../cli.md) | **Português (Brasil)**

<a id="cli-and-modes-reference"></a>

# Linha de comando

Esta página documenta os comandos e as opções integrados de linha de comando do FineCode. `pi` continua disponível como alias de compatibilidade. Execute `finecode --help` ou acrescente `--help` a um comando para ver a interface exata da versão instalada. A ajuda de nível superior também inclui opções registradas pelas extensões carregadas.

```sh
finecode [options] [--] [@files...] [messages...]
finecode install <source> [options]
finecode remove <source> [options]
finecode uninstall <source> [options]
finecode update [target] [options]
finecode list
finecode config [options]
finecode auth <check|print-api-key|print-bearer-token> [options]
finecode mcp <add|remove|list|login|logout> [options]
```

<a id="modes"></a>

<a id="invocation-and-output"></a>
## Invocação e saída

```sh
finecode
finecode --print "Resuma este repositório"
git diff | finecode --print "Revise esta alteração"
finecode --mode json "Inspecione este repositório" > events.jsonl
```

Com a entrada e a saída conectadas ao terminal, o FineCode abre a interface de terminal, a menos que `--print`, `--mode json` ou `--mode rpc` selecione outra interface. Quando uma das streams é redirecionada e nem o modo JSON nem o RPC está selecionado, o FineCode usa o modo print. Consulte [Integração com a CLI](../cli-integration.md) para escolher entre integração interativa, print, JSON, RPC e SDK.

| Entrada | Comportamento |
|---|---|
| `message` | Fornece um prompt inicial |
| `@path` | Inclui um arquivo de texto ou imagem no primeiro prompt |
| stdin via pipe | Acrescenta seu conteúdo ao início do primeiro prompt |
| `--` | Interrompe a análise de opções para que um prompt possa começar com `-` |

O FineCode resolve `@path` a partir do diretório de trabalho atual. Esse diretório também controla a configuração do projeto, a descoberta de recursos e o agrupamento de sessões.

`--print` controla se o FineCode executa uma vez e encerra. `--mode` seleciona a interface de saída. `--mode text` não força uma execução única quando stdin e stdout estão conectados a terminais; use `--print` para isso.

| Opção | Comportamento |
|---|---|
| `-p`, `--print` | Executa os prompts fornecidos, grava em stdout o texto final do assistente e encerra |
| `--mode text` | Seleciona a saída em texto; ainda abre a interface de terminal quando stdin e stdout são terminais |
| `--mode json` | Executa os prompts fornecidos, grava eventos JSONL em stdout e encerra |
| `--mode rpc` | Lê comandos JSONL de stdin e grava respostas e eventos em stdout até o encerramento |
| `--export <input> [output]` | Exporta um arquivo de sessão para HTML e encerra; deriva o destino se `output` for omitido |

O modo RPC rejeita argumentos `@file`. Os modos JSON e RPC reservam stdout para registros do protocolo. Consulte [Fluxo de eventos JSON](../json.md) e [Protocolo RPC](../rpc.md).

<a id="model-options"></a>
## Modelos

```sh
finecode --model sonnet:high
```

Consulte [Escolha um modelo](models.md) para saber sobre a seleção de modelos e [Provedores](providers.md) para informações sobre credenciais.

- `--provider <name>`<br>
  Restringe a busca de `--model` a um provedor. Exige `--model`.
- `--model <pattern>`<br>
  Seleciona por ID exato ou correspondência aproximada de ID/nome. Aceita `provider/id` e um sufixo opcional `:<thinking>`. Se vários provedores corresponderem, o FineCode prefere aquele com credenciais; caso contrário, solicita `--provider`.
- `--api-key <key>`<br>
  Usa uma substituição não persistente da chave de API. Exige um modelo selecionado por `--model` ou `--models`. Não escolhe entre provedores que oferecem o mesmo modelo.
- `--thinking <level>`<br>
  Define `off`, `minimal`, `low`, `medium`, `high`, `xhigh` ou `max`. Substitui o sufixo de `--model` e é limitado aos recursos do modelo.
- `--models <patterns>`<br>
  Define um escopo separado por vírgulas para a inicialização e a alternância entre modelos. Aceita IDs exatos, correspondências aproximadas, curingas que não diferenciam maiúsculas de minúsculas e sufixos opcionais `:<thinking>`. Um modelo oferecido por vários provedores é adicionado para cada um, com um aviso.
- `--list-models [search]`<br>
  Lista os modelos disponíveis, opcionalmente filtrados por uma busca aproximada, e encerra.

<a id="session-options"></a>
## Sessões

```sh
finecode --continue
```

Consulte [Sessões e contexto](sessions.md) para saber como retomar, ramificar, nomear e armazenar sessões.

- `-c`, `--continue`<br>
  Continua a sessão mais recente do projeto atual.
- `-r`, `--resume`<br>
  Abre o seletor de sessões.
- `--session <path|id>`<br>
  Abre uma sessão pelo caminho do arquivo, ID exato ou parcial. O FineCode procura primeiro no projeto atual e oferece criar uma ramificação se encontrar uma correspondência em outro projeto.
- `--session-id <id>`<br>
  Abre o ID exato de uma sessão do projeto ou cria a sessão se ela não existir. Os IDs aceitam letras, números, `.`, `_` e `-`.
- `--fork <path|id>`<br>
  Cria uma nova sessão para o projeto atual a partir de uma sessão existente.
- `--session-dir <dir>`<br>
  Substitui o local de armazenamento e busca. Tem prioridade sobre `PI_CODING_AGENT_SESSION_DIR` e sobre a configuração `sessionDir`.
- `--no-session`<br>
  Usa uma sessão em memória que não é persistida.
- `-n`, `--name <name>`<br>
  Define o nome de exibição da sessão.

Restrições:

- Os IDs de sessão devem começar e terminar com uma letra ou número.
- `--fork` não pode ser combinado com `--session`, `--continue`, `--resume` ou `--no-session`.
- `--session-id` não pode ser combinado com `--session`, `--continue` ou `--resume`. Combine-o com `--fork` para escolher o novo ID.

<a id="tool-options"></a>
<a id="tools"></a>
## Ferramentas

```sh
finecode --tools read,grep,find,ls --print "Revise este projeto"
```

Consulte [Configurações](settings.md#tools) para configurar a seleção padrão de ferramentas.

- `-t`, `--tools <list>`<br>
  Substitui a seleção padrão por uma lista de permissões, separada por vírgulas, de ferramentas integradas, de extensões ou personalizadas. As entradas são nomes ou padrões de ferramentas em que `*` corresponde a quaisquer caracteres. As ferramentas MCP são mantidas, a menos que uma entrada comece com `mcp__` (consulte [Ferramentas MCP](#mcp-tools)). Uma lista contendo somente entradas `+name` e `-name` não é uma lista de permissões; ela altera a seleção padrão.
- `-xt`, `--exclude-tools <list>`<br>
  Desativa nomes ou padrões de ferramentas separados por vírgulas depois de todas as outras opções de seleção, incluindo ferramentas MCP.
- `-nbt`, `--no-builtin-tools`<br>
  Desativa as ferramentas integradas padrão, mantendo as ferramentas de extensões e personalizadas.
- `-nt`, `--no-tools`<br>
  Inicia com todas as ferramentas integradas, de extensões, personalizadas e MCP desativadas.

As ferramentas habilitadas por padrão são `read`, `bash`, `edit` e `write`, a menos que `defaultTools` as altere. `--tools` com nomes simples substitui toda a seleção; portanto, informe cada ferramenta desejada. Assim como `defaultTools`, também aceita uma lista contendo somente entradas `+name` e `-name`, que adiciona ou remove ferramentas da seleção padrão: `finecode --tools +codemode,-write` mantém as demais ferramentas padrão, habilita `codemode` e desabilita `write`. Essas entradas aceitam nomes exatos, não padrões `*`; use `--exclude-tools` para desativar ferramentas por padrão. Não é possível misturar nomes simples com entradas `+name`/`-name`. `/reload` habilita ferramentas recém-adicionadas a `defaultTools`, mas uma ferramenta removida com `-name` continua removida.

<a id="mcp-tools"></a>

`--tools` seleciona as ferramentas declaradas ao modelo. Não remove ferramentas MCP, cujo alcance é definido pela [exposição](../mcp.md#control-tool-exposure): `finecode --tools read,codemode` mantém todas as ferramentas MCP chamáveis por scripts codemode. Uma ferramenta MCP que nenhuma entrada nomeie ou corresponda nunca é declarada diretamente, independentemente da exposição; somente `tool_search`, se estiver listado, pode carregá-la. Quando uma entrada começa com `mcp__`, `--tools` também filtra ferramentas MCP. Por exemplo, isto mantém somente as ferramentas do servidor `radius`:

```sh
finecode --tools read,bash,codemode,'mcp__radius__*'
```

As ferramentas de recursos MCP (`list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`) também são ferramentas MCP. Para removê-las, use `--exclude-tools 'mcp__*'` ou [`--no-mcp`](#resource-options).

| Ferramenta integrada | Finalidade |
|---|---|
| `read` | Lê arquivos de texto e imagens compatíveis |
| `bash` | Executa comandos de shell |
| `powershell` | Executa comandos PowerShell no Windows |
| `edit` | Aplica substituições exatas de texto em um arquivo existente |
| `write` | Cria ou sobrescreve um arquivo |
| `grep` | Pesquisa o conteúdo dos arquivos |
| `find` | Localiza caminhos usando padrões glob |
| `ls` | Lista o conteúdo de diretórios |

Extensões integradas adicionam mais duas ferramentas. Elas ficam desativadas por padrão; a extensão MCP as habilita quando um servidor MCP precisa delas (consulte [MCP](../mcp.md#control-tool-exposure)). Para habilitá-las manualmente, informe-as em `--tools` ou `defaultTools`.

| Extensão integrada | Finalidade |
|---|---|
| `codemode` | Executa JavaScript que chama as demais ferramentas, por exemplo em paralelo com `Promise.allSettled`; somente a saída do script chega ao modelo |
| `tool_search` | Pesquisa ferramentas não declaradas ao modelo (`codemode` e exposição `deferred`, como ferramentas MCP) e declara as correspondências para a próxima chamada |

<a id="enable-codemode"></a>
### Habilite codemode

Para ativar `codemode` em todas as sessões, adicione-o às ferramentas padrão em `~/.pi/agent/settings.json` ou `.pi/settings.json` do projeto:

```json
{
  "defaultTools": ["+codemode"]
}
```

Isso mantém `read`, `bash`, `edit` e `write` e adiciona `codemode`. Para uma única execução, acrescente-o com `--tools`:

```sh
finecode --tools +codemode
```

Codemode é útil mesmo sem MCP: scripts podem executar várias chamadas de ferramentas em paralelo, filtrar saídas grandes antes que cheguem ao modelo, chamar modelos classificadores como Jev da TypeSafe por meio de `models.classify()` (consulte [Modelos classificadores](models.md#use-classifier-models)) e gerar imagens com `models.generateImages()` (consulte [Modelos de imagem](models.md#use-image-models)).

### Como codemode funciona

Os scripts são executados em um sandbox QuickJS e acessam as demais ferramentas por meio de `tools.<name>(args)`. [Codemode](../codemode.md) descreve a API de scripts, como as ferramentas são listadas e encontradas, os globais `store()` e `models` e os limites.

### Busca de ferramentas

`tool_search` fica desativado por padrão; habilite-o com `"defaultTools": ["+tool_search"]` ou `--tools`. Ele usa a mesma classificação de `searchTools()` para pesquisar ferramentas ainda não declaradas e declara as correspondências para a próxima chamada do modelo. As ferramentas carregadas são registradas na sessão como as demais alterações de ferramentas e continuam declaradas naquele ramo.

<a id="resource-options"></a>
<a id="resources"></a>
## Recursos

```sh
finecode --extension ./review.ts
```

Consulte [Configuração](configuration.md) para ver os diretórios convencionais e a confiança no projeto, [Configurações](settings.md#resources) para caminhos configurados e [Pacotes FineCode](../packages.md) para fontes de pacotes.

- `-e`, `--extension <path>`<br>
  Carrega um arquivo ou diretório de extensão, ou uma extensão integrada, como `builtin:mcp`; pode ser repetido.
- `-ne`, `--no-extensions`<br>
  Desativa extensões descobertas, configuradas e integradas. Caminhos explícitos passados com `-e` ainda são carregados; assim, `finecode -ne -e builtin:mcp` mantém somente o suporte MCP integrado.
- `--no-mcp`<br>
  Desativa o suporte MCP integrado nesta execução: nenhum servidor se conecta, e não há ferramentas MCP nem `/mcp`. Não afeta uma extensão que substitua o suporte MCP integrado.
- `--skill <path>`<br>
  Carrega um arquivo ou diretório de skill; pode ser repetido.
- `-ns`, `--no-skills`<br>
  Desativa skills descobertas e configuradas. Caminhos explícitos passados com `--skill` ainda são carregados.
- `--prompt-template <path>`<br>
  Carrega um arquivo ou diretório de modelo de prompt; pode ser repetido.
- `-np`, `--no-prompt-templates`<br>
  Desativa modelos de prompt descobertos e configurados. Caminhos explícitos passados com `--prompt-template` ainda são carregados.
- `--theme <path>`<br>
  Carrega um arquivo ou diretório de tema; pode ser repetido.
- `--use-theme <name[/name]>`<br>
  Seleciona o tema interativo inicial para esta execução.
- `--no-themes`<br>
  Desativa temas descobertos e configurados. Caminhos explícitos passados com `--theme` ainda são carregados.
- `-nc`, `--no-context-files`<br>
  Desativa a descoberta de `AGENTS.md` e `CLAUDE.md`.

Os caminhos de recursos se aplicam somente ao processo atual. Caminhos relativos são resolvidos a partir do diretório de trabalho atual.

<a id="prompt-and-display-options"></a>
## Prompts e processo

```sh
finecode --append-system-prompt ./instructions.md
```

Consulte [Configuração](configuration.md) para configurações salvas, [Segurança](security.md#understand-project-trust) para confiança no projeto e [Variáveis de ambiente](../environment-variables.md) para controles do processo.

- `--system-prompt <text|path>`<br>
  Substitui o prompt de sistema padrão por texto ou pelo conteúdo de um arquivo existente.
- `--append-system-prompt <text|path>`<br>
  Acrescenta texto ou o conteúdo de um arquivo existente ao prompt de sistema; pode ser repetido.
- `--tui-mode <mode>`<br>
  Usa o modo de terminal `fullscreen` (padrão) ou `regular`.
- `--verbose`<br>
  Mostra informações detalhadas da inicialização interativa, substituindo `quietStartup`.
- `-a`, `--approve`<br>
  Confia nas configurações e nos recursos locais do projeto neste processo.
- `-na`, `--no-approve`<br>
  Ignora as configurações e os recursos locais do projeto protegidos por confiança neste processo.
- `--offline`<br>
  Desativa atividade de rede automática, inclusive atualizações do catálogo de modelos. Equivale a `PI_OFFLINE=1`.
- `-h`, `--help`<br>
  Mostra a ajuda, incluindo opções registradas pelas extensões carregadas, e encerra.
- `-v`, `--version`<br>
  Mostra a versão do FineCode e encerra.

Extensões podem registrar outras opções longas. Opções curtas desconhecidas são rejeitadas.

<a id="package-commands"></a>
## Comandos de pacotes

```sh
finecode install npm:@scope/package
```

Consulte [Pacotes FineCode](../packages.md) para formatos de origem, filtragem, instalação e escopo do projeto.

### Tarefas comuns

| Tarefa | Comando |
|---|---|
| Instalar um pacote | `finecode install <source>` |
| Listar pacotes configurados | `finecode list` |
| Remover um pacote e sua entrada de configuração | `finecode remove <source>` |
| Configurar quais recursos de pacotes serão carregados | `finecode config` |

Acrescente `--local` ou `-l` a `install`, `remove`, `uninstall` ou `config` para usar as configurações do projeto em vez das configurações globais.

### Atualize o FineCode ou os pacotes

Executar `finecode update` sem destino atualiza o próprio FineCode.

| Tarefa | Comando |
|---|---|
| Atualizar o FineCode | `finecode update` |
| Atualizar todos os pacotes instalados | `finecode update --extensions` |
| Atualizar um pacote instalado | `finecode update <source>` |
| Atualizar catálogos de modelos | `finecode update --models` |
| Atualizar o FineCode e todos os pacotes instalados | `finecode update --all` |

Acrescente `--force` para reinstalar o FineCode quando a atualização selecionada o incluir.

`finecode update` não pode atualizar o FineCode quando outro gerenciador de pacotes o fornece, como o Nix. Atualize-o com esse gerenciador, por exemplo, `nix profile upgrade finecode`. Atualizações de pacotes e catálogos de modelos continuam funcionando.

### Aliases e opções de comandos

- `finecode uninstall <source>` é um alias de `finecode remove <source>`.
- `finecode update --self` e `finecode update self` selecionam explicitamente o comportamento padrão de autoatualização de `finecode update`.
- `finecode update pi` continua disponível como alias legado de compatibilidade para `finecode update`.
- `finecode update --extension <source>` é um alias de `finecode update <source>`.
- `-a`, `--approve` confia em arquivos locais do projeto para um comando. `-na`, `--no-approve` ignora arquivos locais protegidos por confiança.
- Acrescente `-h` ou `--help` a um comando para consultar seu uso exato e as restrições das opções.

<a id="credential-commands"></a>
## Comandos de credenciais

```sh
finecode auth check --provider openai --json
```

Os comandos de autenticação exigem `--provider <provider>` ou `--model <model>`. Consulte [Provedores](providers.md) para ver os métodos compatíveis.

| Comando | Descrição |
|---|---|
| `finecode auth check` | Exibe `ready`, `not_ready` ou `invalid` e encerra com status `0`, `1` ou `2`, respectivamente |
| `finecode auth print-api-key` | Exibe a chave de API resolvida |
| `finecode auth print-bearer-token` | Exibe um token bearer OAuth resolvido |

| Opção | Aplicável a | Descrição |
|---|---|---|
| `--provider <provider>` | Todos | Resolve credenciais para um provedor |
| `--model <model>` | Todos | Resolve credenciais a partir de um modelo; pode ser combinado com `--provider` |
| `--json` | `auth check` | Escreve o resultado estruturado como JSON |
| `--credentials` | `auth check` | Emite a credencial resolvida quando estiver pronta |
| `--no-refresh` | `auth check` | Não atualiza credenciais OAuth expiradas; a atualização é o padrão |
| `--min-expiry <duration>` | `print-bearer-token` | Exige tempo restante de validade do token usando `ms`, `s`, `m` ou `h`, por exemplo `30m` |

Comandos que exibem credenciais gravam segredos em stdout.

<a id="mcp-commands"></a>
## Comandos MCP

Estes comandos funcionam fora de uma sessão; por isso, agentes podem executá-los por meio de `bash`. Consulte [Servidores MCP](../mcp.md).

| Comando | Descrição |
|---|---|
| `finecode mcp add <server> [options] -- <command> [args...]` | Adiciona ou substitui um servidor stdio em `mcp.json`; `--env KEY=VALUE` (repetível) e `--cwd <dir>` definem seu ambiente e diretório de trabalho. Os argumentos após o comando são passados ao servidor |
| `finecode mcp add <server> [options] --url <url>` | Adiciona ou substitui um servidor HTTP streamable; `--header KEY=VALUE` (repetível), `--bearer-token-env-var <NAME>` (envia `Authorization: Bearer ${NAME}`), `--oauth-client-id`, `--oauth-client-secret`, `--oauth-callback-port` e `--oauth-client-name` configuram a autenticação |
| `finecode mcp remove <server>` | Remove um servidor de `mcp.json`; as credenciais OAuth salvas são mantidas |
| `finecode mcp list [--json]` | Conecta a todos os servidores habilitados e exibe seu estado, ferramentas e erros; encerra com `1` quando uma entrada de configuração é inválida ou um servidor habilitado não está conectado |
| `finecode mcp login <server> [--timeout <seconds>]` | Autentica em um servidor OAuth: abre a página de autorização e aguarda o navegador; um terminal também aceita a URL de redirecionamento colada. `--timeout` limita toda a autenticação, inclusive as solicitações ao servidor de autorização (padrão de 300 segundos) |
| `finecode mcp logout <server>` | Exclui as credenciais OAuth salvas de um servidor |

`add` e `remove` alteram `~/.pi/agent/mcp.json` ou, com `--local` (`-l`), `.pi/mcp.json` no diretório atual. `add` também aceita `--exposure <mode>` (consulte [Exposição](../mcp.md#control-tool-exposure)) e `--description <text>`, mas não se conecta ao servidor; execute `finecode mcp list` para verificá-lo.

Arquivos `.pi/mcp.json` do projeto só são lidos quando o projeto já é confiável.
