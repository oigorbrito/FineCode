[English](../sdk.md) | **Português (Brasil)**

# SDK

O pacote `finecode` incorpora o FineCode em um processo Node.js ou Bun. Ele oferece acesso direto por TypeScript ao agente, às sessões, às ferramentas, aos modelos e aos recursos usados pela aplicação de linha de comando.

Use o SDK para integrações TypeScript no mesmo processo. Para uma integração independente de linguagem ou em um subprocesso isolado, consulte [Integração com a CLI](cli-integration.md).

```typescript
import { createAgentSession } from "finecode";

const { session } = await createAgentSession();

try {
  await session.prompt("What files are in the current directory?");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

Este exemplo usa o diretório de trabalho, recursos descobertos, configurações salvas e credenciais configuradas. `prompt()` é resolvido quando a execução termina.

O [exemplo mínimo completo](../../examples/sdk/01-minimal.ts) também transmite eventos de texto. Todos os [exemplos do SDK](../../examples/sdk/) são verificados quanto a tipos junto ao repositório.

<a id="session-management"></a>

## Ciclo de vida da sessão

`createAgentSession()` cria um `AgentSession`. A sessão é proprietária de uma conversa, do modelo e das ferramentas, das mensagens enfileiradas, do estado de compactação e do runtime de extensões.

Leia o estado atual por meio de `session.messages`, `session.model`, `session.thinkingLevel`, `session.systemPrompt` e `session.getActiveToolNames()`.

`session.systemPrompt` é somente leitura e retorna o prompt de sistema efetivo atual, incluindo alterações ainda não enviadas ao modelo. As alterações de ferramentas são declaradas ao modelo antes da próxima solicitação.

<a id="sessionmanager-api"></a>

### Armazenamento de sessões

As sessões são persistentes por padrão. `SessionManager` é responsável pela árvore de entradas persistida ou em memória e acompanha sua folha ativa. Ramificar altera essa folha sem apagar os ramos abandonados. Ao reconstruir o contexto do modelo, o FineCode seleciona o ramo ativo e aplica a compactação.

`SessionManager` é a fonte de verdade para o contexto final do modelo. Restaure o histórico externo criando a sessão com um gerenciador que contenha essas entradas. Atribuir valores a `session.agent.state.messages` não substitui o contexto persistido.

Use um gerenciador em memória quando o host não quiser arquivos de sessão:

```typescript
import { createAgentSession, SessionManager } from "finecode";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});
```

Consulte o [exemplo verificado de sessões](../../examples/sdk/11-sessions.ts) para criar, abrir, continuar, listar e ramificar sessões. [Formato de arquivo de sessão](../session-format.md) define o contrato JSONL persistido, e [Tipos de mensagem](../message-types.md) define os valores da transcrição. Para métodos e assinaturas exatos, use as declarações TypeScript exportadas ou [`session-manager.ts`](../../src/core/session-manager.ts).

`cwd` seleciona o workspace usado para descobrir recursos do projeto, arquivos de contexto, agrupar sessões e definir os caminhos das ferramentas integradas. Informe-o explicitamente quando o destino for diferente de `process.cwd()`.

`session.dispose()` cancela o trabalho ativo, invalida contextos de extensões, desconecta do agente e remove listeners de eventos. Chame-o quando a sessão não for mais necessária.

`AgentSessionRuntime` adiciona `newSession()`, `switchSession()`, `fork()` e `importFromJsonl()`. Cada operação substitui o `AgentSession` ativo e recria serviços para o diretório de trabalho de destino.

Depois de substituir o runtime, as inscrições pertencem ao `AgentSession` antigo e precisam ser refeitas. Consulte o [exemplo de runtime de sessão](../../examples/sdk/13-session-runtime.ts).

## Envio de prompts

`prompt()` processa comandos de extensão e expande modelos de prompt baseados em arquivos antes que mensagens comuns do usuário entrem no agente. Para uma execução aceita pelo agente, a promessa é resolvida quando a execução termina, incluindo novas tentativas automáticas.

Um prompt enviado enquanto a sessão já está transmitindo deve especificar se deve orientar a execução atual ou vir depois dela. Se essa escolha não for informada, `prompt()` rejeita a chamada em vez de presumir.

Uma mensagem de orientação entra depois do turno atual do assistente e de suas chamadas de ferramentas. Uma mensagem de acompanhamento entra depois que a execução atual conclui o trabalho pendente. `steer()` e `followUp()` expõem esses comportamentos diretamente e retornam `"queued"` quando a entrada é enfileirada (inclusive após transformação por uma extensão) ou `"handled"` quando uma extensão a consome.

`abort()` interrompe a operação ativa e aguarda até a sessão ficar ociosa. `waitForIdle()` aguarda sem interrompê-la.

## Inscreva-se nos eventos

Inscreva-se antes de enviar o prompt quando o host precisar da saída transmitida:

```typescript
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await session.prompt("Explain this repository");
} finally {
  unsubscribe();
}
```

Os eventos da sessão informam atualizações de mensagens, execução de ferramentas, filas, compactação, novas tentativas e alterações do ciclo de vida da execução.

`message_end` contém a mensagem concluída definitiva. `agent_end` marca o fim de uma execução de baixo nível do agente, mas pode haver recuperação automática ou trabalho enfileirado depois.

Use `agent_settled` quando o host precisar saber que o FineCode não continuará automaticamente.

## Configure uma sessão

Sem substituições, a fábrica cria um `ModelRuntime`, um `SettingsManager` baseado em arquivos, um `SessionManager` persistente, um `DefaultResourceLoader` e as ferramentas padrão configuradas.

Cada fronteira pode ser fornecida explicitamente:

- `modelRuntime`, `model`, `thinkingLevel` e `scopedModels` controlam o acesso e a seleção de modelos.
- `settingsManager` fornece configurações mescladas ou uma configuração em memória.
- `sessionManager` fornece histórico de conversa persistente ou em memória.
- `resourceLoader` fornece extensões, skills, modelos de prompt, temas e arquivos de contexto.
- `tools`, `noTools`, `excludeTools` e `customTools` controlam o conjunto ativo de ferramentas.

Use `DefaultResourceLoader` quando quiser a descoberta padrão com algumas substituições. Forneça um `ResourceLoader` personalizado quando o host controlar completamente o armazenamento e a descoberta de recursos.

<a id="inlineextension"></a>

Fábricas de extensões inline podem ser fornecidas por `DefaultResourceLoader`. Informe um nome `InlineExtension` somente quando precisar de um nome estável nos diagnósticos e na saída da inicialização. Uma extensão inline nomeada com `replaceable: true` é ignorada quando outra extensão registra, durante o carregamento, uma ferramenta, um comando ou uma flag com o mesmo nome; assim, não há conflito entre as duas. As extensões integradas da CLI para codemode, busca de ferramentas e MCP podem ser substituídas. Uma entrada nomeada com `builtin: true` não é uma extensão inline: ela fornece o código da extensão `builtin:<name>`, carregada como um arquivo de extensão configurado. Ela é carregada por padrão, aparece em `finecode config` e pode ser desativada com `-builtin:<name>` na configuração `extensions` ou com `noExtensions`; `additionalExtensionPaths: ["builtin:<name>"]` carrega-a explicitamente. Ela é carregada depois que a confiança no projeto é resolvida e, por isso, não pode tratar `project_trust`. As extensões integradas da CLI usam esse recurso.

<a id="codemode-mcp"></a>

A CLI carrega `codemode`, `tool_search` e MCP como extensões integradas. As sessões do SDK não fazem isso; adicione `createCodemodeExtension()`, `createToolSearchExtension()` e `createMcpExtension()` a `extensionFactories` do `DefaultResourceLoader`. `codemode` e `tool_search` são registrados inativos: habilite-os pela configuração `defaultTools` (`["+codemode", "+tool_search"]` preserva as demais ferramentas padrão) ou permita que a extensão MCP os ative: `codemode` para servidores com exposição `codemode` e `tool_search` para servidores com exposição `deferred`. A extensão MCP conecta seus servidores em `session_start`; portanto, chame `session.bindExtensions()`. Consulte [Codemode e MCP](../../examples/sdk/14-codemode-mcp.ts).

Consulte os exemplos focados de [modelos](../../examples/sdk/02-custom-model.ts), [ferramentas](../../examples/sdk/05-tools.ts), [extensões](../../examples/sdk/06-extensions.ts) e [controle total](../../examples/sdk/12-full-control.ts).

## Exemplos

| Exemplo | Finalidade |
|---|---|
| [Mínimo](../../examples/sdk/01-minimal.ts) | Criar, enviar prompts, observar e descartar uma sessão |
| [Modelo personalizado](../../examples/sdk/02-custom-model.ts) | Selecionar modelo e nível de raciocínio |
| [Prompt de sistema](../../examples/sdk/03-custom-prompt.ts) | Substituir ou complementar o prompt de sistema |
| [Skills](../../examples/sdk/04-skills.ts) | Descobrir, filtrar e adicionar skills |
| [Ferramentas](../../examples/sdk/05-tools.ts) | Selecionar ferramentas integradas e seu diretório de trabalho |
| [Extensões](../../examples/sdk/06-extensions.ts) | Carregar extensões baseadas em arquivos e inline |
| [Arquivos de contexto](../../examples/sdk/07-context-files.ts) | Adicionar ou substituir instruções do projeto |
| [Modelos de prompt](../../examples/sdk/08-prompt-templates.ts) | Adicionar modelos de prompt baseados em arquivos |
| [Credenciais](../../examples/sdk/09-api-keys-and-oauth.ts) | Configurar armazenamento de credenciais e modelos |
| [Configurações](../../examples/sdk/10-settings.ts) | Fornecer configurações baseadas em arquivos ou em memória |
| [Sessões](../../examples/sdk/11-sessions.ts) | Controlar persistência e restauração de sessões |
| [Controle total](../../examples/sdk/12-full-control.ts) | Substituir serviços padrão de descoberta e estado |
| [Runtime de sessão](../../examples/sdk/13-session-runtime.ts) | Substituir a sessão ativa com segurança |
| [Codemode e MCP](../../examples/sdk/14-codemode-mcp.ts) | Adicionar as extensões `codemode`, `tool_search` e MCP |

<a id="exports"></a>

## Recursos

- [Escolha um modelo](models.md) aborda a seleção de modelos e endpoints compatíveis; [Provedores](providers.md) aborda credenciais e configurações específicas de cada provedor.
- [Configuração](configuration.md) explica a descoberta normal e as configurações; [Configurações](settings.md) lista todas as opções.
- [Sessões e contexto](sessions.md) explica o comportamento de sessões; [Formato de sessão](../session-format.md) define as entradas persistidas; [Tipos de mensagem](../message-types.md) define os valores compartilhados da transcrição.
- [Extensões](extensions.md), [Skills](skills.md) e [Modelos de prompt](prompt-templates.md) documentam recursos fornecidos por um `ResourceLoader`.
- [Integração com a CLI](cli-integration.md) aborda alternativas print, JSON e RPC para uma integração SDK no mesmo processo.
