[English](../message-types.md) | **Português (Brasil)**

# Tipos de mensagem

O FineCode usa valores `AgentMessage` no estado do SDK, em eventos de ciclo de vida, respostas RPC e entradas de mensagens persistidas na sessão. Esta página define essas mensagens compartilhadas e seus blocos de conteúdo.

Os timestamps das mensagens são timestamps Unix em milissegundos. Eles diferem dos timestamps ISO 8601 das [entradas da sessão](session-format.md#entry-base).

Referências ao código-fonte do Pi upstream (o código pode diferir desta cópia do FineCode):

- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) define mensagens voltadas aos provedores e blocos de conteúdo.
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) define a união extensível `AgentMessage`.
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) acrescenta papéis de mensagem do coding agent.

## Blocos de conteúdo

### TextContent

```typescript
interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}
```

`textSignature` contém metadados de mensagem específicos do provedor. Trate-o como opaco.

### ImageContent

```typescript
interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}
```

`data` contém dados de imagem codificados em base64. `mimeType` identifica o tipo de mídia, como `image/png` ou `image/jpeg`.

### ThinkingContent

```typescript
interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
}
```

Assinaturas de raciocínio contêm dados de reprodução específicos do provedor. Trate-as como opacas. Um bloco redigido pode não ter texto de raciocínio visível, mas manter um conteúdo criptografado em `thinkingSignature`.

### ToolCall

```typescript
interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
  thoughtSignature?: string;
  namespace?: string;
}
```

`thoughtSignature` é específico do provedor. `namespace` identifica um namespace OpenAI Responses para ferramentas carregadas dinamicamente ou com namespace.

## Uso

Mensagens do assistente sempre contêm informações de uso. Resultados de ferramentas também podem conter uso quando a ferramenta executou trabalho aninhado com modelos.

```typescript
interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h?: number;
  reasoning?: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

Quando presente, `reasoning` já está incluído em `output`; não o some novamente. `cacheWrite1h` é a parcela de `cacheWrite` gravada com retenção de uma hora.

## Mensagens básicas

### SystemMessage

```typescript
interface SystemMessage {
  role: "system";
  content: string | TextContent[];
  sections?: Record<string, string | null>;
  toolsAdded?: Tool[];
  toolsRemoved?: ToolReference[];
  timestamp: number;
}
```

A mensagem de sistema inicial declara o prompt e as ferramentas iniciais. Mensagens de sistema posteriores podem acrescentar instruções, substituir ou remover seções nomeadas do prompt e adicionar ou remover ferramentas. Reproduzi-las em ordem produz o estado atual.

### UserMessage

```typescript
interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}
```

### AssistantMessage

```typescript
interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: string;
  provider: string;
  model: string;
  responseModel?: string;
  responseId?: string;
  providerThinkingLevel?: string;
  thinkingLevel?: ModelThinkingLevel;
  diagnostics?: AssistantMessageDiagnostic[];
  usage: Usage;
  stopReason: "pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred";
  deferred?: DeferredHandle;
  errorMessage?: string;
  rawStopReason?: string;
  endTurn?: boolean;
  timestamp: number;
}
```

`responseModel` registra um modelo concreto informado pelo provedor quando ele difere do modelo solicitado. `responseId`, `providerThinkingLevel`, `thinkingLevel`, `diagnostics` e `rawStopReason` preservam detalhes do provedor ou do runtime.

`"pending"` é usado em uma mensagem parcial do assistente durante o streaming. A mensagem concluída em `message_end` tem um motivo de parada final, e o FineCode não persiste mensagens do assistente com estado `"pending"` no JSONL da sessão.

Uma resposta `"deferred"` tem um `DeferredHandle` com os dados do provedor necessários para recuperá-la:

```typescript
interface DeferredHandle {
  provider: string;
  modelId: string;
  api: string;
  id: string;
  expiresAt?: number;
  pollAfterMs?: number;
  data?: JsonValue;
}
```

### ToolResultMessage

```typescript
interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  usage?: Usage;
  nestedCalls?: NestedToolCalls;
  isError: boolean;
  timestamp: number;
}
```

`details` é específico da ferramenta. `usage` opcional informa o trabalho aninhado com modelos executado pela ferramenta e contribui para as estatísticas da sessão completa, mas não faz parte do uso da chamada principal ao modelo. `nestedCalls` registra metadados limitados sobre chamadas feitas por essa ferramenta a outras ferramentas:

```typescript
interface NestedToolCalls {
  calls: NestedToolCallRecord[];
  complete: boolean;
}

interface NestedToolCallRecord {
  id: string;
  name: string;
  arguments?: JsonObject;
  argumentsBytes?: number;
  status: "ok" | "error" | "unfinished";
  durationMs?: number;
  error?: string;
}
```

## Mensagens do coding agent

O pacote coding-agent estende `AgentMessage` com quatro papéis.

### BashExecutionMessage

Criada por comandos diretos de shell, inclusive pelo comando RPC [`bash`](rpc-commands.md#bash). Não é um resultado de ferramenta de LLM.

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;
  timestamp: number;
}
```

A menos que `excludeFromContext` seja `true`, o FineCode converte essa mensagem em texto com papel de usuário antes da próxima solicitação ao modelo.

### CustomMessage

Criada quando uma extensão envia uma mensagem de contexto.

```typescript
interface CustomMessage<T = unknown> {
  role: "custom";
  customType: string;
  content: string | (TextContent | ImageContent)[];
  display: boolean;
  details?: T;
  timestamp: number;
}
```

O FineCode converte o conteúdo em uma mensagem de usuário para solicitações ao modelo. `display` controla a renderização no terminal; `details` não é enviado ao modelo.

### BranchSummaryMessage

```typescript
interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string | null;
  timestamp: number;
}
```

O FineCode cria essa mensagem de contexto a partir de uma entrada persistida `branch_summary`.

### CompactionSummaryMessage

```typescript
interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}
```

O FineCode cria essa mensagem de contexto a partir de uma entrada persistida `compaction`.

## União AgentMessage

No coding agent, a união equivale a:

```typescript
type AgentMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomMessage
  | BranchSummaryMessage
  | CompactionSummaryMessage;
```

No pacote de agente de nível mais baixo, `AgentMessage` é `Message | CustomAgentMessages[keyof CustomAgentMessages]`. Aplicações podem adicionar papéis por meio de merging de declarações TypeScript; portanto, consumidores devem tolerar papéis personalizados desconhecidos quando recebem mensagens de um host estendido.
