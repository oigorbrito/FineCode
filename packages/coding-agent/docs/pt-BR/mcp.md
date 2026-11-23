[English](../mcp.md) | **Português (Brasil)**

# Servidores MCP

O FineCode se conecta a servidores [Model Context Protocol](https://modelcontextprotocol.io) por stdio ou HTTP streamable e disponibiliza suas ferramentas e recursos ao modelo.

## Configuração rápida

Adicione um servidor local por stdio, verifique a conexão e inicie o FineCode:

```bash
finecode mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem .
finecode mcp list
finecode
```

Para um servidor remoto:

```bash
finecode mcp add docs --url https://example.com/mcp --bearer-token-env-var DOCS_TOKEN
finecode mcp list
```

Por padrão, esses comandos adicionam servidores no nível do usuário. Acrescente `--local` ou `-l` para gravar a configuração do projeto:

```bash
finecode mcp add -l tools --env API_KEY='${TOOLS_KEY}' -- uvx tools-mcp
```

Use `/mcp` durante uma sessão interativa para inspecionar conexões, autenticar, reconectar, alterar a exposição ou ativar e desativar servidores. Execute `/reload` depois de adicionar, remover ou alterar um servidor fora da sessão.

## Configurar servidores

O FineCode lê servidores do usuário em `~/.pi/agent/mcp.json` e servidores do projeto em `.pi/mcp.json`. A configuração do projeto só é lida depois que a [confiança no projeto](security.md#understand-project-trust) é concedida. Uma entrada do projeto substitui uma entrada do usuário com o mesmo nome.

Uma entrada do projeto sem `command`, `url` ou `type` substitui somente `enabled`, `exposure` e `toolExposure` do servidor do usuário com o mesmo nome e mantém os demais campos, inclusive `env`, `headers` e `auth`. Por exemplo, isto desativa um servidor do usuário em um projeto:

```json
{
  "mcpServers": {
    "internal-tools": { "enabled": false }
  }
}
```

O formato é compatível com outros clientes MCP:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "docs": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" },
      "description": "Search and read the product documentation"
    }
  }
}
```

Servidores stdio usam `command`, `args`, `env` e `cwd`. Valores relativos de `cwd` são resolvidos em relação ao diretório da sessão. Um `~/` no início de `command`, de um argumento ou de `cwd` representa o diretório inicial do usuário.

Servidores HTTP usam `url`, `headers` e `oauth` (consulte [Autenticar com OAuth](#authenticate-with-oauth)). O transporte SSE legado não é compatível.

Ambos os tipos de servidor aceitam:

- `timeout`: timeout por solicitação, em segundos (padrão 60). Notificações de progresso reiniciam a contagem.
- `enabled: false`: mantém a entrada sem se conectar a ela.
- `exposure` e `toolExposure`: controlam como as ferramentas chegam ao modelo (consulte [Controlar exposição de ferramentas](#control-tool-exposure)).
- `description`: uma frase sobre o que o servidor oferece. Ela inclui o servidor no prompt de sistema (consulte [Controlar exposição de ferramentas](#control-tool-exposure)), ajuda a busca de ferramentas a classificar suas ferramentas e é retornada por `describeNamespace()` do codemode. Se omitida, usa-se a primeira linha das instruções do servidor depois da conexão.

Mantenha servidores pessoais e servidores com credenciais no arquivo do usuário. Use o arquivo do projeto somente para servidores necessários ao projeto, e apenas em projetos confiáveis.

### Regras de configuração

- Os nomes de servidor só podem conter letras, dígitos, `_` e `-`. As ferramentas são nomeadas `mcp__<server>__<tool>`; caracteres que não sejam letras, dígitos ou `_` são substituídos por `_`. Se os nomes das ferramentas de um servidor resultarem em colisões, todas recebem um sufixo hash. Nomes de servidor que só diferem entre `-` e `_` são considerados iguais: o segundo é rejeitado, e uma entrada de `mcp.json` substitui um servidor registrado.
- `type` é opcional. `command` seleciona stdio e `url` seleciona HTTP streamable. Se presente, `type` precisa ser `stdio`, `http` ou `streamable-http`.
- `sse` é rejeitado. Servidores que documentam um endpoint SSE geralmente também oferecem HTTP streamable, com frequência em `/mcp` em vez de `/sse`.
- `command` é um executável, e `args` contém seus argumentos. Não é uma string de comando shell.
- Valores de `env` e `headers` podem usar variáveis de ambiente, como `${GITHUB_TOKEN}`. Também podem executar um comando com `!command`, mas o comando precisa constituir o valor inteiro; por exemplo, `"Authorization": "!echo Bearer $(gh auth token)"`.
- Entradas inválidas são informadas e ignoradas sem impedir a conexão dos demais servidores.

`finecode mcp add` e `finecode mcp remove` cobrem alterações comuns pelo shell. Consulte [Comandos MCP](cli.md#mcp-commands) para ver as opções.

### Inspecionar ou alterar um servidor

`/mcp` lista os servidores configurados com estado, quantidade de ferramentas, exposição e origem da configuração. Servidores que precisam de atenção aparecem primeiro. Selecione um servidor para inspecionar suas ferramentas e detalhes de conexão, reconectar, entrar ou sair, alterar a exposição ou ativá-lo e desativá-lo.

Alterações de exposição e estado habilitado são gravadas no arquivo que define o servidor, sem substituir conteúdo não relacionado. Em um projeto confiável, “Ativar neste projeto” e “Desativar neste projeto” adicionam uma substituição no projeto para um servidor do usuário; alterações posteriores são gravadas nessa substituição. Servidores desativados continuam listados. Fora da TUI interativa, `/mcp` imprime o estado; `/mcp login <server>`, `/mcp logout <server>` e `/mcp reconnect <server>` executam diretamente essas ações.

Comandos de shell funcionam sem uma sessão: `finecode mcp add`, `finecode mcp remove`, `finecode mcp list`, `finecode mcp login` e `finecode mcp logout`. Comandos de shell não carregam extensões.

### Diagnosticar problemas de conexão

Execute `finecode mcp list` para conectar a todos os servidores habilitados e exibir seu estado, ferramentas e erros. O comando termina com status 1 quando uma entrada é inválida ou um servidor habilitado não está conectado. `/mcp` mostra o erro completo de conexão e o trecho final de stderr de um servidor stdio que falhou.

O FineCode informa uma vez após a inicialização erros de configuração, falhas de conexão e autenticações necessárias. Notificações de log dos servidores são acrescentadas a `~/.pi/agent/mcp.log` no formato `<time> [<server>] <level> <logger>: <message>`. Quando o arquivo ultrapassa 5 MB, ele é renomeado para `mcp.log.1`.

O FineCode conecta em segundo plano todos os servidores habilitados ao iniciar uma sessão. As ferramentas de um servidor aparecem quando ele se conecta; a descrição de `codemode` não as lista e, portanto, não muda quando os servidores se conectam. O primeiro prompt aguarda até 10 segundos somente pelos servidores com ferramentas `direct`, que precisam ser declaradas na solicitação. Os demais servidores são aguardados quando necessário: um script codemode aguarda os servidores que nomeia (`mcp__<server>`) e, quando chama `searchTools()` ou lê `ALL_TOOLS`, aguarda todos; `tool_search` e as ferramentas de recursos também aguardam todos. Erros de rede HTTP e status transitórios (408, 429 e 5xx) são repetidos duas vezes. Uma conexão interrompida aparece como desconectada e é restabelecida na chamada seguinte. Quando um servidor anuncia uma lista de ferramentas alterada, novas ferramentas são adicionadas e as removidas deixam de estar acessíveis.

Parar um servidor stdio fecha seu stdin, envia SIGTERM e depois SIGKILL ao grupo de processos. Isso também encerra servidores iniciados por wrappers como `npx` ou `uvx`.

## Migrar a configuração de outro cliente

Mova a entrada convertida para `mcpServers` em `mcp.json` e execute `finecode mcp list` para validá-la.

| Cliente | Conversão |
|---|---|
| Claude Desktop, Claude Code ou Cursor | Copie a entrada existente de `mcpServers`. |
| VS Code | Mova uma entrada do objeto de nível superior `servers` e substitua os prompts `${input:...}` por variáveis de ambiente `${NAME}`. |
| Codex | Converta campos TOML `[mcp_servers.<name>]`, como `command`, `args`, `env` e `url`, para JSON. |
| OpenCode | Converta `"type": "local"` para uma entrada stdio, divida o array `command` entre `command` e `args`, renomeie `environment` para `env` e substitua `{env:NAME}` por `${NAME}`. Converta `"type": "remote"` para uma entrada de URL. |

<a id="authenticate-with-oauth"></a>
## Autenticar com OAuth

Servidores remotos que usam OAuth, como o Sentry, não precisam de credenciais em `mcp.json`:

```json
{
  "mcpServers": {
    "sentry": { "url": "https://mcp.sentry.dev/mcp" }
  }
}
```

Quando o servidor rejeita uma conexão sem autenticação, `/mcp` indica que é necessário entrar. Selecione “Entrar”, execute `/mcp login sentry` ou `finecode mcp login sentry`. O FineCode abre a página de autorização e aguarda a aprovação. Se o navegador estiver em outra máquina, por exemplo via SSH, cole na tela de autenticação a URL para a qual ele foi redirecionado. Uma sessão em execução usa as novas credenciais no turno seguinte.

O FineCode se registra no servidor de autorização, armazena tokens em `~/.pi/agent/mcp-auth.json` e atualiza tokens de acesso expirados ou rejeitados pelo servidor. Se o servidor passar a exigir escopos adicionais, o FineCode solicitará nova autenticação. Sair apaga as credenciais armazenadas.

As credenciais pertencem a um nome e URL de servidor. Servidores com a mesma URL sob nomes diferentes, como um por conta, exigem autenticação separada; servidores com o mesmo nome e URL em arquivos `mcp.json` diferentes compartilham uma autenticação.

OAuth se aplica a servidores HTTP sem cabeçalho `Authorization`. Para um servidor que não aceite registro dinâmico de cliente, configure um cliente registrado:

```json
{
  "mcpServers": {
    "example": {
      "url": "https://mcp.example.com/mcp",
      "oauth": { "clientId": "my-client", "clientSecret": "${EXAMPLE_SECRET}", "callbackPort": 8765 }
    }
  }
}
```

O URI de redirecionamento precisa corresponder ao URI registrado. `callbackPort` usa `http://127.0.0.1:<port>/callback`. Para usar outro URI, defina `callbackUrl`; ele deve usar HTTP em `localhost`, `127.0.0.1` ou `[::1]`. O FineCode o envia exatamente como escrito. Se `callbackUrl` não tiver porta, o FineCode usa `callbackPort` ou uma porta livre e a acrescenta ao URI, conforme permitido para redirecionamentos de loopback pela RFC 8252. `clientSecret` é opcional e pode usar uma variável de ambiente ou um comando.

Defina `scope` como uma lista separada por espaços para servidores que não anunciam os escopos necessários. Caso contrário, o FineCode solicita os escopos anunciados. Escopos solicitados posteriormente são adicionados ao valor configurado.

O FineCode se identifica como `finecode` no registro dinâmico de clientes. Alguns servidores só aceitam registros de clientes conhecidos. Defina `clientName` para enviar outro nome:

```json
{
  "mcpServers": {
    "figma": { "url": "https://mcp.figma.com/mcp", "oauth": { "clientName": "Claude Code" } }
  }
}
```

O nome só é enviado quando o FineCode registra um cliente. Para registrar novamente com um nome diferente, saia primeiro.

Alguns servidores de autorização permitem identificar clientes pela URL do documento de metadados do Client ID, em vez de registrá-los. Defina `clientRegistration` como `cimd` para identificar o cliente pelo documento de metadados do cliente Pi upstream em pi.dev, em vez de realizar o registro:

```json
{
  "mcpServers": {
    "example": { "url": "https://mcp.example.com/mcp", "oauth": { "clientRegistration": "cimd" } }
  }
}
```

Atualmente, o FineCode reutiliza o documento de metadados do Pi upstream em `https://pi.dev/oauth/client.json`, com o URI de redirecionamento `http://127.0.0.1:<port>/callback`. Se o servidor de autorização não enviar o parâmetro `iss` nas respostas de autorização (RFC 9207), ele usa um documento e caminho de redirecionamento específicos do servidor MCP: `https://pi.dev/oauth/<id>/client.json` e `http://127.0.0.1:<port>/callback/<id>`. O servidor de autorização precisa anunciar suporte ao documento de metadados do Client ID e a clientes públicos; caso contrário, a autenticação falha. `cimd` não pode ser combinado com `clientId` ou `clientName`, e `callbackUrl` precisa usar `localhost` ou `127.0.0.1` com o caminho `/callback`.

O FineCode localiza o servidor de autorização pelos metadados do recurso protegido do servidor (RFC 9728) e verifica se os metadados do servidor de autorização indicam o emissor esperado (RFC 8414). Alguns servidores anunciam um servidor incorreto ou nenhum; nesse caso, a autenticação abre uma página inexistente. Defina `authServerMetadataUrl` para apontar ao documento de metadados do servidor correto:

```json
{
  "mcpServers": {
    "example": {
      "url": "https://mcp.example.com/mcp",
      "oauth": { "authServerMetadataUrl": "https://example.okta.com/.well-known/openid-configuration" }
    }
  }
}
```

O FineCode usa esse documento em vez da descoberta automática e confia na configuração; portanto, aponte-o somente para um documento confiável. A URL precisa usar HTTPS, exceto em `localhost`, `127.0.0.1` ou `[::1]`.

<a id="control-tool-exposure"></a>
## Controlar a exposição de ferramentas

Cada ferramenta do servidor é registrada como `mcp__<server>__<tool>`. A `exposure` do servidor determina como o modelo a acessa:

| Exposição | Comportamento | Uso típico |
|---|---|---|
| `codemode` (padrão) | Pode ser chamada por scripts [`codemode`](cli.md#tools), mas não é declarada ao modelo nem listada na descrição de codemode. Scripts encontram ferramentas com `searchTools()`, `describeTool()` ou `ALL_TOOLS`. | Servidores MCP em geral, especialmente quando scripts precisam combinar ou filtrar chamadas. |
| `deferred` | Só é declarada após [`tool_search`](cli.md#tools) encontrar uma correspondência para a próxima chamada ao modelo. | Servidores grandes cujas ferramentas devem ser chamadas diretamente depois de descobertas. |
| `direct` | É declarada ao modelo como ferramenta integrada e também pode ser chamada por codemode. | Conjuntos pequenos de ferramentas usados com frequência. |
| `hidden` | É registrada, mas não pode ser acessada. | Servidores ou ferramentas que devem permanecer indisponíveis. |

`codemode-deferred` é aceito como alias de `codemode`.

Servidores com ferramentas `codemode` ou `deferred` são listados na seção `mcp_servers` do prompt de sistema, com a forma de acesso às ferramentas e uma linha da `description` configurada ou, depois da conexão, das instruções do servidor. O FineCode atualiza essa seção quando um prompt começa, depois de aguardar servidores com ferramentas `direct`. Se ela mudar, por exemplo, porque um servidor se conectou e seu resumo ficou disponível, o FineCode acrescenta a nova seção à conversa em vez de alterar as declarações de ferramentas, preservando o cache das mensagens anteriores. `describeNamespace()` e a opção `namespace` de `searchTools()` aceitam `mcp__dev-radius`, `mcp__dev_radius`, `dev-radius` ou `dev_radius`.

O FineCode ativa `codemode` quando um servidor com exposição `codemode` se conecta. Ativa `tool_search` para um servidor com exposição `deferred`. Para que o modelo veja uma ferramenta sem precisar pesquisá-la, atribua-lhe exposição `direct` usando `toolExposure`.

`toolExposure` substitui a exposição do servidor para ferramentas individuais. As chaves são nomes exatos de ferramentas do servidor ou padrões em que `*` corresponde a quaisquer caracteres. Nomes exatos têm prioridade sobre padrões; entre padrões, vence o primeiro correspondente. Um servidor com exposição `hidden` pode expor somente ferramentas selecionadas:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "exposure": "deferred",
      "toolExposure": {
        "search_code": "direct",
        "get_*": "codemode",
        "delete_*": "hidden"
      }
    }
  }
}
```

`finecode mcp list` marca as ferramentas cuja exposição difere da do servidor. A visualização Tools em `/mcp` também exibe a exposição efetiva.

Ferramentas com exposição `codemode` ou `deferred` podem ser acessadas pelos dois mecanismos indiretos: scripts codemode podem chamá-las e `tool_search` pode carregá-las. Chamadas codemode não dependem do conjunto de ferramentas ativo; portanto, continuam disponíveis após `/tree`, retomada e fork. Ferramentas carregadas por `tool_search` são registradas na transcrição e continuam declaradas naquele ramo.

`--tools` não remove ferramentas MCP, a menos que uma das entradas comece com `mcp__`; `finecode --tools read,codemode,'mcp__radius__*'` mantém somente as ferramentas de `radius`. `--exclude-tools` aceita os mesmos padrões, e `--no-mcp` desativa MCP para uma execução (consulte [Ferramentas](cli.md#mcp-tools)).

Para manter `codemode` ativo sem servidores MCP, adicione `"defaultTools": ["+codemode"]` às [configurações](settings.md#tools). Para impedir a ativação automática de codemode, defina `"autoEnableCodemode": false` ao lado de `mcpServers`. Um valor de projeto substitui o valor do usuário. O FineCode avisa uma vez quando nem `codemode` nem `tool_search` está ativo e ferramentas não diretas não podem ser chamadas.

Resultados de texto maiores que 20 KB chegam ao modelo com a parte central removida e um marcador `…N chars truncated…`. O texto completo é salvo em um arquivo temporário cujo caminho aparece no resultado. Scripts codemode recebem o resultado completo e podem reduzi-lo antes de retornar a saída ao modelo.

Scripts codemode recebem o `CallToolResult` MCP completo, incluindo `content`, `structuredContent` e `isError`. Um resultado com `isError` resolve dentro dos scripts, mas é informado como erro em chamadas diretas. `image(result.content[0])` encaminha um bloco de imagem. Instruções do servidor não fazem parte da descrição de nenhuma ferramenta; scripts podem lê-las com `describeNamespace("mcp__<server>")`, que também retorna os nomes das ferramentas do servidor.

## Usar recursos

Quando um servidor conectado oferece [resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources), o FineCode disponibiliza as ferramentas de recursos usadas pelo Codex e OpenCode:

- `list_mcp_resources` lista recursos como JSON: `{ server?, resources: [{ server, uri, name, ... }], nextCursor? }`. Com `server`, lista uma página; `cursor` busca a próxima. Sem `server`, lista todos os recursos de todos os servidores.
- `list_mcp_resource_templates` lista modelos de URI para recursos que os servidores não listam diretamente.
- `read_mcp_resource` lê um recurso por `server` e `uri`. Texto chega ao modelo como texto e imagens como imagens. Outros recursos binários são salvos em arquivos temporários, e o modelo recebe o caminho. Scripts recebem `{ server, uri, contents }`.

Essas ferramentas acessam todos os servidores habilitados, não ocultos e que oferecem recursos. A exposição delas é a mais ampla entre esses servidores, nesta ordem: `direct`, depois `codemode` ou `deferred`. Links de recursos nos resultados identificam `read_mcp_resource` e o servidor.

Recursos do MCP Apps, identificados por URIs `ui://` ou `text/html;profile=mcp-app`, são omitidos porque o FineCode não os renderiza. Ícones de recursos também são omitidos.

Leituras e listagens de recursos são repetidas uma vez após erros HTTP transitórios (408, 429 ou 5xx). Chamadas de ferramentas não são repetidas, pois o servidor pode já tê-las executado.

## Permissões

Cada chamada MCP passa pelo pipeline de ferramentas do FineCode. Portanto, handlers de extensão `tool_call` e `tool_result`, inclusive controles de permissão, também se aplicam às ferramentas MCP. Chamadas feitas por scripts codemode incluem o ID de chamada codemode em `parentToolCallId`.

`pi.getAllTools()` informa as anotações declaradas por cada servidor: `readOnlyHint`, `destructiveHint`, `idempotentHint` e `openWorldHint`. Extensões de permissão podem usar essas indicações para decidir quais chamadas exigem confirmação (consulte [Exposição de ferramentas](extensions.md#tool-exposure)). Ferramentas de recursos são marcadas como somente leitura.

## Extensões e SDK

### Adicionar servidores por extensões

Extensões podem adicionar servidores para a sessão atual com `pi.registerMcpServer(name, config)`, usando a mesma estrutura de uma entrada `mcpServers` (consulte [Servidores MCP em extensões](extensions.md#mcp-servers)). Servidores registrados se conectam como os configurados e aparecem em `/mcp` com a extensão como origem.

Alterações de estado habilitado ou exposição só se aplicam à sessão atual. Um servidor configurado em arquivo com o mesmo nome tem prioridade, e `/mcp` lista o registro substituído. Comandos de shell `finecode mcp` não carregam extensões e só veem servidores configurados em arquivos.

<a id="replace-the-built-in-mcp-support"></a>
### Substituir o suporte MCP integrado

Uma extensão instalada que registra `/mcp`, como `pi-mcp-adapter`, substitui o suporte MCP integrado nas sessões. Nesse caso, o FineCode não lê `mcp.json` nem conecta seus servidores na sessão, e `/mcp` passa a pertencer à extensão. Remova a extensão para restaurar o comportamento integrado. Para desativar o suporte MCP integrado sem substituí-lo, desative `mcp` em Built-in no `finecode config` ou defina `"extensions": ["-builtin:mcp"]` em [configurações](settings.md#resources). `--no-mcp` o desativa em uma única execução.

Uma extensão que registra `codemode` ou `tool_search` também substitui a ferramenta integrada de mesmo nome. O FineCode ativa a substituição para servidores MCP e aguarda os servidores necessários às chamadas somente quando ela declara [`reachesTools`](extensions.md#tool-exposure). Comandos `finecode mcp` no shell sempre usam a implementação integrada.

### Usar MCP pelo SDK

Sessões do SDK não carregam extensões integradas. Adicione a extensão MCP, a extensão codemode para servidores `codemode` e a extensão de busca de ferramentas para servidores `deferred` ao carregador de recursos. Consulte [Codemode e MCP](sdk.md#codemode-mcp).
