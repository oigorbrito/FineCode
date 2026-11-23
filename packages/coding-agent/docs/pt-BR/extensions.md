[English](../extensions.md) | **Português (Brasil)**

# Extensões

Extensões são módulos TypeScript que adicionam comportamento executável ao FineCode. Use uma quando um fluxo de trabalho precisar de ferramentas, comandos, handlers de eventos, provedores de modelos, estado de sessão ou interface de terminal, e não apenas de instruções.

Uma extensão é executada dentro do processo do FineCode com as mesmas permissões do sistema operacional. Ela pode inspecionar prompts, chamadas de ferramentas, arquivos, credenciais e histórico da sessão; portanto, carregue somente extensões de fontes confiáveis.

Extensões comuns adicionam uma ferramenta de agente, protegem caminhos, confirmam comandos perigosos, reagem a eventos de sessão, modificam o contexto, expõem um comando ou exibem status persistente.

<a id="quick-start"></a>
<a id="writing-an-extension"></a>
<a id="create-an-extension"></a>

## Crie e carregue uma extensão

Uma extensão exporta uma fábrica padrão que recebe `ExtensionAPI`. A fábrica registra recursos para o runtime da extensão atual.

Crie `~/.pi/agent/extensions/hello.ts`:

```typescript
import type { ExtensionAPI } from "finecode";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Show a greeting",
    handler: async (name, ctx) => {
      ctx.ui.notify(`Hello, ${name || "world"}!`, "info");
    },
  });
}
```

Inicie o FineCode e execute `/hello`. Durante o desenvolvimento, carregue um arquivo diretamente:

```bash
finecode --extension ./hello.ts
```

O FineCode usa `jiti`, portanto extensões TypeScript locais não precisam de uma etapa de compilação separada. Use [Pacotes FineCode](../packages.md) para distribuir extensões e dependências.

<a id="extension-locations"></a>
<a id="available-imports"></a>
<a id="choose-where-it-loads"></a>

## Adicione a extensão ao FineCode

Coloque a extensão no diretório de extensões do usuário ou do projeto. O FineCode carrega arquivos TypeScript ou JavaScript diretamente e subdiretórios que contenham um ponto de entrada `index.ts` ou `index.js`.

Use um único arquivo para uma extensão pequena e um diretório para uma implementação com vários arquivos. Coloque dependências npm em um `package.json` próximo. Consulte [Configuração](configuration.md) para conhecer os locais convencionais e [Configurações](settings.md#resources) para definir caminhos adicionais.

A recarga substitui o runtime da extensão; portanto, o código executado após `await ctx.reload()` não deve reutilizar o estado do runtime anterior. Somente extensões pessoais e passadas explicitamente pela linha de comando podem participar do evento `project_trust`, executado antes do carregamento das extensões do projeto.

<a id="understand-the-lifecycle"></a>

## Respeite o ciclo de vida do runtime

A fábrica pode ser síncrona ou assíncrona. O FineCode aguarda uma fábrica assíncrona antes de continuar a inicialização, permitindo buscar configurações ou registrar provedores necessários durante a inicialização.

Não inicie processos, sockets, observadores ou timers na fábrica, pois algumas invocações carregam extensões sem iniciar uma sessão. Inicie recursos de longa duração em `session_start` ou no comando ou ferramenta que precisar deles. Encerre recursos específicos da sessão em um handler `session_shutdown` idempotente.

Uma execução passa da entrada e de `before_agent_start`, pelo ciclo de vida do modelo, das mensagens e das ferramentas, até `agent_end`. O FineCode está ocupado durante a inicialização da execução, inclusive na verificação de compactação e em `before_agent_start`; por isso, mensagens enviadas nesse intervalo entram na execução que está começando. Novas tentativas automáticas, recuperação, compactação ou trabalho enfileirado podem continuar em seguida.

<a id="agent_start--agent_end--agent_before_settle--agent_settled"></a>

`agent_before_settle` é o último ponto em que se pode agir: ele pode acrescentar entradas e solicitar uma continuação. `agent_settled` é final e serve somente para notificações; use-o quando uma integração precisar saber que o FineCode não continuará automaticamente.

<a id="extensionapi-methods"></a>

## Escolha um ponto de integração

| Recurso | API principal |
|---|---|
| Observar ou modificar o comportamento do ciclo de vida | `pi.on()` |
| Adicionar uma operação que o modelo possa chamar | `pi.registerTool()` |
| Adicionar um comando `/` | `pi.registerCommand()` |
| Adicionar um atalho ou sinalizador de CLI | `pi.registerShortcut()` ou `pi.registerFlag()` |
| Enviar mensagens do usuário ou personalizadas | `pi.sendUserMessage()` ou `pi.sendMessage()` |
| Persistir dados de sessão que não entram no contexto | `pi.appendEntry()` |
| Alterar ferramentas ativas, modelo ou nível de raciocínio | Métodos de controle de sessão em `pi` |
| Adicionar um provedor de modelos | `pi.registerProvider()` |
| Adicionar um servidor MCP | `pi.registerMcpServer()` |
| Direcionar cada solicitação a um modelo | [`pi.registerVirtualModel()`](virtual-models.md) |
| Adicionar renderização no terminal | Registro de renderizadores e `ctx.ui` |
| Comunicar-se com outra extensão | `pi.events` |

Como referência, as declarações exportadas do repositório Pi upstream em [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) mostram os tipos de eventos, contexto, ferramentas e resultados.

## Siga os contratos das extensões

<a id="events"></a>
<a id="work-with-events"></a>

### Eventos e concorrência

Handlers são executados na ordem de carregamento e registro das extensões. `pi.on()` retorna uma função que remove aquele registro; alterações não afetam uma chamada de evento já em andamento. Alguns eventos notificam; outros transformam dados, substituem resultados ou cancelam uma operação. Use o tipo de resultado declarado por cada evento, em vez de presumir que todo valor retornado terá efeito.

Os eventos abrangem descoberta de recursos, sessões, ciclo de vida do agente e das mensagens, provedores, ferramentas e entrada bruta.

`before_agent_start` expõe tanto o prompt atual quanto suas opções estruturadas `systemPromptOptions`. `event.messageType` indica o que iniciou a execução: `"user"` para um prompt ou `pi.sendUserMessage()`, com `prompt` e `images`; `"custom"` para `pi.sendMessage(..., { triggerTurn: true })`, com a mensagem inicial em `message` e sem `prompt`. Uma `message` retornada é adicionada aos dois tipos de execução; verifique `messageType` para ignorar execuções iniciadas por mensagens personalizadas. Prefira alterar seções do prompt, ferramentas selecionadas ou diretrizes para que o FineCode possa acrescentar uma diferença à transcrição. Retornar `systemPrompt` ou definir `forceSystemPrompt` substitui todo o prompt daquela execução, enquanto a transcrição continua registrando as seções estruturadas. Os provedores recebem o texto forçado como prompt de sistema inicial.

`message_end` pode substituir uma mensagem finalizada preservando seu papel. `tool_call` pode modificar a entrada ou bloquear a execução. Handlers `tool_result` são compostos, e cada handler recebe as alterações anteriores.

<a id="provider_stream_event"></a>

`provider_stream_event` é emitido para cada evento analisado do stream do provedor, antes de o FineCode normalizá-lo. O evento identifica o provedor, a API e o modelo; `event.data` é o valor estruturado mais inicial disponível ao FineCode, não necessariamente os bytes HTTP ou o frame SSE original. Trate-o como somente leitura, pois alterações podem afetar a normalização. O evento serve apenas para notificação e não é persistido.

Os handlers são aguardados na ordem do stream; portanto, handlers lentos atrasam o consumo. Erros dos handlers são relatados sem alterar a resposta do provedor. Consulte [`debug-provider.ts`](../../examples/extensions/debug-provider.ts) para ver um inspetor opcional que agrupa eventos brutos por mensagem do assistente.

<a id="context_with_system"></a>

`context` transforma mensagens da conversa sem incluir as mensagens de sistema do prompt e das ferramentas; o FineCode restaura esse estado depois. Use `context_with_system` somente quando uma transformação local da solicitação precisar controlar a transcrição inteira e mantenha uma mensagem de sistema no índice zero.

`turn_end` e `agent_before_settle` são pontos em que ainda se pode agir. Seus handlers podem encadear entradas `custom`, `custom_message`, `context_edit` ou `compaction` propostas e retornar `continue: true` para uma próxima solicitação ao modelo. Condições de continuação precisam ser protegidas, pois uma continuação incondicional pode criar um loop. Consulte as declarações de eventos exportadas para conhecer o contrato completo de validação e ordenação.

<a id="cache_warming_decision"></a>

`cache_warming_decision` pode substituir uma atualização de cache de prompt ocioso com `{ action: "warm" }` ou `{ action: "stop" }`. Prevalece a ação retornada pelo último handler.

Chamadas de ferramentas de uma mesma mensagem do assistente podem ser executadas em paralelo. Não presuma que a chamada ou o resultado de uma ferramenta irmã exista quando outro evento de ferramenta for executado. Use `ctx.signal` para trabalho aninhado pertencente a um turno ativo; comandos e eventos de sessão ociosa geralmente não têm sinal de operação.

Um handler `user_bash` que retorna `undefined` passa o comando ao próximo handler e, se nenhum o tratar, à execução local. Retornar `operations` ou `result` interrompe a propagação. Uma falha do handler bloqueia o comando em vez de permitir que ele seja executado localmente.

<a id="custom-tools"></a>
<a id="register-tools"></a>

### Ferramentas

Uma ferramenta personalizada define um nome, uma descrição voltada ao modelo, um schema de parâmetros TypeBox e uma função `execute()`. O resultado precisa conter `content`, voltado ao modelo, e um campo `details` para renderização ou reconstrução do estado. Use `details: undefined` quando não houver dados estruturados. Se a ferramenta fizer chamadas aninhadas ao modelo, inclua o `usage` delas no resultado para manter corretos os totais da sessão.

Lance uma exceção em `execute()` para produzir um resultado de ferramenta com falha. Retornar um objeto não o marca como erro. Retorne `terminate: true` somente quando o agente deva pular a continuação automática depois que todas as ferramentas concluídas naquele lote concordarem em encerrar.

Use execução sequencial quando ferramentas compartilharem estado mutável em memória. Ferramentas que alteram arquivos devem envolver toda a operação de leitura, modificação e gravação com `withFileMutationQueue()`. Trunque resultados grandes enviados ao modelo e informe onde ele pode ler a saída completa.

Declare `outputSchema` e retorne um `structuredContent` correspondente quando o resultado contiver dados. O modelo ainda recebe `content`; chamadores programáticos, como scripts codemode, recebem `structuredContent` em vez do texto. Ferramentas sem `outputSchema` são passadas aos scripts como conteúdo de texto. Para relatar uma falha que ainda contenha dados, retorne o resultado com `isError: true` em vez de lançar uma exceção: o modelo vê um erro, e os scripts ainda recebem `structuredContent`.

Uma ferramenta pode chamar outras ferramentas com `ctx.executeTool(name, args, { signal, onUpdate })`. Chamadas aninhadas passam pela validação de argumentos e pelos handlers `tool_call` e `tool_result`, como as chamadas do modelo, e emitem `tool_execution_start`, `tool_execution_update` e `tool_execution_end`; todos esses eventos incluem `parentToolCallId`, e o Pi atribui `toolCallId` como `<parent id>/<n>`. Esses IDs não aparecem na transcrição como chamadas ou resultados de ferramentas. Chamadas aninhadas não adicionam entradas à transcrição: seus resultados só chegam à ferramenta chamadora, que os reporta, por exemplo, usando `onUpdate` e `details`. A sessão mantém um registro limitado delas (nome, argumentos, estado, duração e erro, nunca resultados) em `nestedCalls`, na mensagem de resultado da ferramenta chamadora. Ele é usado nas listas de arquivos da compactação e aparece em exportações HTML. Argumentos acima de 8 KiB por chamada ou 32 KiB por resultado de ferramenta são omitidos; são mantidas no máximo 256 chamadas, e `complete: false` indica que algum conteúdo foi perdido. O `usage` dos resultados aninhados, em todos os níveis, é acrescentado ao `usage` do resultado da ferramenta chamadora; assim, uma ferramenta informa somente seu próprio uso, não o das ferramentas que chamou. `ctx.tools` lista as ferramentas que `ctx.executeTool()` pode chamar. Handlers `tool_result` que removem informações de `content` também devem substituir `structuredContent`; substituir somente `content` o descarta.

Consulte [`hello.ts`](../../examples/extensions/hello.ts), [`todo.ts`](../../examples/extensions/todo.ts), [`dynamic-tools.ts`](../../examples/extensions/dynamic-tools.ts) e [`truncated-tool.ts`](../../examples/extensions/truncated-tool.ts).

<a id="tool-exposure"></a>
### Exposição de ferramentas

`exposure` controla como o modelo acessa uma ferramenta. “Chamável” significa que ela pode ser chamada por outras ferramentas por meio de `ctx.executeTool()` (`ctx.tools`), como fazem os scripts da ferramenta `codemode`:

- `direct` (padrão): declarada ao modelo enquanto estiver ativa e chamável enquanto estiver ativa.
- `model-only`: declarada ao modelo enquanto estiver ativa, mas nunca chamável. Use-a para ferramentas que coordenam outras ferramentas ou perguntam algo ao usuário.
- `codemode`: chamável sempre que registrada e listada pela ferramenta `codemode`. Não é declarada ao modelo, a menos que seja ativada explicitamente.
- `deferred`: semelhante a `codemode`, mas ferramentas codemode não a listam; `tool_search` pode encontrá-la e ativá-la.
- `hidden`: registrada, mas inacessível. Para retirar uma ferramenta, registre-a novamente com `exposure: "hidden"`, pois ferramentas não podem ser removidas do registro.

`namespace: { name, aliases, description, instructions }` agrupa ferramentas relacionadas, como servidores MCP. Ferramentas codemode listam um namespace sob um único título com sua `description`. `instructions` contém orientações de uso mais longas; elas não são listadas, e scripts codemode podem consultá-las com `describeNamespace(name)`. `aliases` são nomes alternativos pelos quais scripts podem buscar o namespace, por exemplo, o nome de servidor `docs` para `mcp__docs`; um nome e o mesmo nome como identificador de script (`my-docs`, `my_docs`) correspondem da mesma forma.

Registrar uma ferramenta `direct` ou `model-only` a ativa; as demais exposições não são ativadas no registro. O conjunto ativo (`pi.getActiveTools()`, `pi.setActiveTools()`) corresponde às ferramentas declaradas ao modelo. `pi.getAllTools()` informa `exposure`, `namespace`, `annotations` e `reachesTools` de cada ferramenta.

`annotations` são indicações sobre o que uma ferramenta faz, com o significado das anotações de ferramentas MCP: `readOnlyHint`, `destructiveHint`, `idempotentHint` e `openWorldHint`. Ferramentas MCP carregam as indicações declaradas pelo servidor. Indicações ausentes usam os padrões MCP: uma ferramenta não é somente leitura e pode ser destrutiva e alcançar um mundo aberto. As indicações não são verificadas, mas uma extensão de permissões pode usá-las para decidir quais chamadas exigem confirmação. Este exemplo confirma as chamadas para as quais o Codex solicita aprovação:

```typescript
pi.on("tool_call", async (event, ctx) => {
  const hints = pi.getAllTools().find((tool) => tool.name === event.toolName)?.annotations;
  const needsApproval =
    hints?.destructiveHint === true ||
    (!hints?.readOnlyHint && ((hints?.destructiveHint ?? true) || (hints?.openWorldHint ?? true)));
  if (needsApproval && !(await ctx.ui.confirm("Allow tool call?", event.toolName))) {
    return { block: true, reason: `${event.toolName} was not approved` };
  }
});
```

Uma ferramenta que coordena outras pode ajustar o que o modelo vê enquanto está ativa com `prepareLoadout(loadout)`. Isso ocorre sempre que as ferramentas ativas mudam e recebe as ferramentas declaradas, as ferramentas chamáveis e todas as ferramentas registradas com sua exposição, namespace e diretrizes para prompts. Retorna `descriptions` substitutas para ferramentas declaradas (inclusive a própria) e `hiddenDeclarations`: ferramentas ativas cujas declarações devem ser omitidas, embora permaneçam ativas e chamáveis. O prompt de sistema padrão omite as ferramentas ocultas de sua lista e de suas regras e não cita nenhuma ferramenta na indicação de skills quando o leitor de arquivos está oculto; portanto, a ferramenta coordenadora deve apresentar as diretrizes por conta própria. `codemode` usa somente este hook, `exposure`, `reachesTools` e `ctx.executeTool()`; assim, outra ferramenta pode implementar o mesmo comportamento com outro nome.

Uma ferramenta que pode acessar outras declara quais ferramentas uma chamada pode alcançar com `reachesTools(input)`: `"all"` ou as palavras da entrada que podem nomeá-las. Uma palavra corresponde a todas as ferramentas ou namespaces cujo nome a contém. `codemode` retorna `"all"` para scripts que pesquisam ou listam ferramentas e as palavras do script nos outros casos; `tool_search` sempre retorna `"all"`. Extensões que registram ferramentas tardiamente usam esse recurso no handler `tool_call` para terminar de registrar as ferramentas necessárias antes da execução, como faz a extensão MCP para servidores que ainda estão se conectando. A extensão MCP também ativa `codemode` ou `tool_search` para ferramentas MCP somente quando a ferramenta com esse nome declara `reachesTools`.

### Ative ferramentas dinamicamente

Registre primeiro todas as ferramentas, mantenha inativas as ferramentas opcionais e use `pi.setActiveTools()` em uma ferramenta carregadora para escolher as ferramentas ativas desejadas. Os nomes precisam já estar registrados; nomes desconhecidos são ignorados.

O FineCode registra o prompt inicial e o conjunto de ferramentas na primeira mensagem de sistema da transcrição e, antes da próxima solicitação ao modelo, acrescenta alterações de ferramentas e prompts. Provedores que não conseguem representar essa transição recebem um checkpoint completo da transcrição, o que pode invalidar o prefixo em cache.

### Renderização de ferramentas

`renderCall` e `renderResult` de uma ferramenta desenham suas chamadas na transcrição interativa e nas exportações HTML. `pi.registerToolRenderer((toolName, next) => renderers)` escolhe renderizadores para chamadas de qualquer ferramenta, inclusive as ainda não registradas, como ferramentas MCP em uma sessão retomada antes de o servidor se conectar. `next()` retorna o que os demais resolvedores (na ordem de carregamento das extensões) e, em seguida, a ferramenta registrada usariam; assim, `next() ?? mine` só preenche o que estiver faltando.

<a id="mcp-servers"></a>
### Servidores MCP

`pi.registerMcpServer(name, config)` adiciona um servidor MCP à sessão atual. `config` tem o mesmo formato de uma entrada `mcpServers` em [`mcp.json`](../mcp.md): `command`, `args`, `env` e `cwd` para servidores stdio; `url`, `headers` e `oauth` para servidores HTTP; além de `exposure`, `toolExposure`, `description`, `enabled` e `timeout`.

```typescript
pi.registerMcpServer("jira", { url: "https://mcp.example.com/jira", exposure: "codemode" });
pi.unregisterMcpServer("jira");
```

Servidores registrados durante o carregamento da extensão se conectam quando a sessão começa, junto aos servidores de `mcp.json`; servidores registrados depois se conectam imediatamente, e `pi.unregisterMcpServer()` encerra a conexão e torna inacessíveis as ferramentas do servidor. Os registros não são salvos: registre-os novamente em cada carregamento, por exemplo, com base nas configurações próprias da extensão. Um servidor em `mcp.json` com o mesmo nome tem prioridade, e `/mcp` mostra a substituição. Registrar novamente o mesmo nome substitui o registro anterior da extensão; nomes registrados por outra extensão, nomes inválidos e configurações inválidas geram erro.

O suporte MCP integrado conecta servidores registrados. Se nada fizer isso porque outra extensão o substituiu (consulte [MCP](../mcp.md#replace-the-built-in-mcp-support)), cada registro é informado como erro de extensão. Outras extensões MCP também podem conectar servidores registrados: leia-os com `pi.getMcpServers()` em `session_start` e trate o evento `mcp_servers_change` para alterações posteriores.

<a id="extensioncontext"></a>
<a id="extensioncommandcontext"></a>
<a id="use-extension-context"></a>

### Contexto e alterações de sessão

`ExtensionContext` fornece o diretório de trabalho, o modo, a interface, o gerenciador de sessões, o runtime de modelos, o sinal de aborto, o uso de contexto e controles para compactação e encerramento. Use `ctx.modelRegistry.streamSimple()` para chamadas aninhadas a modelos sem dependência de provedor.

Handlers de comandos recebem `ExtensionCommandContext`, que acrescenta operações para aguardar até que o sistema fique ocioso, recarregar, navegar na árvore e substituir a sessão. Essas operações estão disponíveis somente em comandos, pois chamá-las em handlers de ciclo de vida pode causar deadlock no runtime.

A substituição da sessão invalida o contexto antigo. Capture apenas dados simples antes de trocar e, em seguida, use o contexto novo fornecido por `withSession` para operações vinculadas à sessão.

<a id="state-management"></a>
<a id="persist-state"></a>

<a id="state"></a>
### Estado

Escolha o armazenamento conforme a participação do estado na conversa:

| Estado | Armazenamento |
|---|---|
| Estado da ferramenta que acompanha o ramo ativo | `details` do resultado da ferramenta |
| Dados duráveis excluídos do contexto do modelo | `pi.appendEntry()` |
| Conteúdo personalizado armazenado e enviado ao modelo | `pi.sendMessage()` |
| Dados que não pertencem a uma única sessão | Armazenamento externo |

Reconstrua estado sensível ao ramo a partir de `ctx.sessionManager.getBranch()` durante `session_start`. Não o reconstrua a partir de todas as entradas do arquivo, pois ramos abandonados representam históricos alternativos. Registre um renderizador de entrada ou mensagem quando o conteúdo armazenado personalizado precisar aparecer na transcrição.

<a id="custom-ui"></a>
<a id="mode-behavior"></a>
<a id="interact-with-the-user"></a>
<a id="account-for-each-mode"></a>
<a id="ui-and-modes"></a>
### Interface e modos

`ctx.ui` oferece diálogos, notificações, texto de status, widgets, títulos, acesso ao editor e componentes personalizados. Use `ctx.ui.custom()` somente quando a interação precisar de renderização, entrada, foco, layout ou ciclo de vida próprios. Consulte [Interface de terminal](../tui.md) para orientações sobre componentes, foco, sobreposições, temas e desempenho.

Extensões são carregadas nos modos interativo, RPC, JSON e print. O modo interativo oferece a interface de terminal completa. O RPC pode encaminhar diálogos e notificações compatíveis pelo [protocolo de interface de extensões RPC](../rpc-extension-ui.md), mas não componentes de terminal personalizados; os modos JSON e print não têm interface. Restrinja comportamentos exclusivos do terminal com `ctx.mode === "tui"` e use `ctx.hasUI` para interações compatíveis com clientes interativos e RPC.

Mantenha o comportamento das ferramentas e dos eventos independente da renderização para que modos não interativos continuem funcionais.

<a id="error-handling"></a>
<a id="handle-errors-and-shutdown"></a>

### Erros e limpeza

O FineCode informa erros dos handlers e continua quando possível. Uma falha em um handler `tool_call` bloqueia a ferramenta como medida de segurança; uma falha na execução de uma ferramenta se torna um resultado de erro para o modelo.

Libere os recursos em `session_shutdown`, mesmo que a operação normal já tenha tentado limpá-los. A limpeza deve ser idempotente, pois cancelamento, recarga, substituição de sessão e encerramento do processo podem convergir para o mesmo caminho. Use `ctx.shutdown()` para solicitar o encerramento ordenado do processo.

<a id="examples-reference"></a>
<a id="use-examples-as-the-implementation-reference"></a>

## Exemplos e referência

Os [exemplos de extensões](../../examples/extensions/) validados abrangem ferramentas, eventos de ciclo de vida, comandos, sinalizadores, atalhos, estado, renderização, provedores, OAuth, execução remota e componentes de terminal. Comece pelo menor exemplo que corresponda ao seu ponto de integração.

Use [Provedores personalizados](custom-provider.md) para integrações com serviços de modelos, [Interface de terminal](../tui.md) para componentes personalizados e [Pacotes FineCode](../packages.md) para instalar ou distribuir extensões junto a outros recursos.
