[English](../json.md) | **Português (Brasil)**

# Fluxo de eventos JSON

O modo JSON emite progresso estruturado para uma execução:

```bash
finecode --mode json "Review this repository"
```

O FineCode grava primeiro um cabeçalho de sessão, seguido pelos eventos da sessão; depois encerra quando os prompts fornecidos terminam. O modo RPC emite os mesmos formatos de evento da sessão, mas não inclui o cabeçalho porque é um protocolo bidirecional de longa duração. Consulte [Modo RPC](rpc.md).

Esta página é a referência oficial para eventos compartilhados pelos modos JSON e RPC. Os valores de mensagens usam os [tipos de mensagem compartilhados](../message-types.md).

## Enquadramento e entrada/saída do processo

O fluxo usa enquadramento JSONL estrito. Cada registro é um objeto JSON terminado por LF (`\n`). Separe registros somente por LF e remova um eventual carriage return anterior. Separadores Unicode de linha e parágrafo são válidos dentro de strings JSON e não delimitam registros.

`readline` do Node.js não é adequado para este fluxo porque também reconhece esses separadores Unicode. Use um decodificador de fluxo de bytes ou UTF-8 e separe por LF.

Leia stdout continuamente. Um leitor que deixe de consumir registros pode bloquear o FineCode quando o buffer do pipe encher. Stdout fica reservado para JSONL; diagnósticos e logs da aplicação são enviados a stderr.

## Cabeçalho da sessão

O primeiro registro do modo JSON é o [cabeçalho da sessão](session-format.md#sessionheader) atual:

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path"}
```

O modo RPC não emite esse registro. Use [`get_state`](rpc-commands.md#get_state) para obter o ID e o arquivo da sessão atual.

## Sequência de eventos

Uma execução básica produz registros como estes:

```json
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"user","content":"Review this repository","timestamp":1733234401000}}
{"type":"message_end","message":{"role":"user","content":"Review this repository","timestamp":1733234401000}}
{"type":"message_start","message":{"role":"assistant","content":[],"stopReason":"pending","...":"..."}}
{"type":"message_update","usage":{"...":"..."},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello"}}
{"type":"message_end","message":{"role":"assistant","...":"..."}}
{"type":"turn_end","message":{"role":"assistant","...":"..."},"toolResults":[]}
{"type":"agent_end","messages":[{"...":"..."}],"willRetry":false}
{"type":"agent_settled","aborted":false}
```

`agent_end` encerra uma execução de baixo nível do agente. Novas tentativas automáticas, recuperação de excesso de contexto, tentativas após compactação, orientação ou mensagens de acompanhamento ainda podem continuar. `agent_settled` significa que o FineCode não tem mais trabalho automático para aquela execução no nível da sessão.

## Eventos do agente e do turno

| Evento | Campos | Significado |
|---|---|---|
| `agent_start` | Nenhum | Uma execução de baixo nível do agente começou. |
| `agent_end` | `messages`, `willRetry` | Essa execução de baixo nível terminou. `messages` contém as mensagens geradas por ela. |
| `agent_settled` | `aborted` | O FineCode não continuará automaticamente com novas tentativas, recuperação de compactação ou mensagens enfileiradas. `aborted` é `true` se a execução terminou por cancelamento. |
| `turn_start` | Nenhum | Um turno do assistente começou. |
| `turn_end` | `message`, `toolResults` | Uma resposta do assistente e as chamadas de ferramentas resultantes terminaram. |

Um turno consiste em uma resposta do assistente e quaisquer chamadas e resultados de ferramentas produzidos por ela.

## Eventos de mensagem

| Evento | Campos | Significado |
|---|---|---|
| `message_start` | `message` | Uma mensagem começou. |
| `message_update` | `usage`, `assistantMessageEvent` | Uma mensagem do assistente emitiu uma atualização de bloco de conteúdo. |
| `message_end` | `message` | Uma mensagem foi concluída. Esta é a mensagem final definitiva. |

<a id="message_update-streaming"></a>
### Reconstrua mensagens transmitidas

Registros `message_update` no protocolo contêm somente deltas. Eles omitem o campo cumulativo `message` do evento SDK e todos os snapshots `assistantMessageEvent.partial`, mantendo o tamanho do fluxo linear.

O evento aninhado é um destes:

| Tipo | Campos além de `type` | Significado |
|---|---|---|
| `start` | Nenhum | O fluxo do provedor começou; o campo cumulativo `partial` é removido no protocolo. |
| `text_start` | `contentIndex` | Um bloco de texto começou. |
| `text_delta` | `contentIndex`, `delta` | Acrescente texto ao bloco. |
| `text_end` | `contentIndex`, `content` | O bloco de texto terminou com conteúdo definitivo. |
| `thinking_start` | `contentIndex` | Um bloco de raciocínio começou. |
| `thinking_delta` | `contentIndex`, `delta` | Acrescente texto de raciocínio ao bloco. |
| `thinking_end` | `contentIndex`, `content` | O bloco de raciocínio terminou com conteúdo definitivo. |
| `toolcall_start` | `contentIndex`, `id`, `toolName` | Um bloco de chamada de ferramenta começou. |
| `toolcall_delta` | `contentIndex`, `delta` | Acrescente dados serializados dos argumentos. |
| `toolcall_end` | `contentIndex`, `toolCall` | A chamada terminou com o `ToolCall` completo. |
| `done` | `reason`, `message` | O fluxo do provedor terminou com sucesso. |
| `error` | `reason`, `error` | O fluxo do provedor terminou com um erro ou cancelamento. |

O ciclo normal do agente converte `start`, `done` e `error` do provedor em eventos de sessão `message_start` e `message_end`, em vez de emiti-los como `message_update`. Eles continuam aceitos pela transformação exportada `JsonAgentSessionEvent` para chamadores que criem um evento de sessão correspondente.

Use `contentIndex` para identificar o bloco. Armazene os campos `delta` para exibição em tempo real, mas substitua os dados reconstruídos pelo conteúdo concluído em `text_end`, `thinking_end` ou `toolcall_end`. Quando chegar `message_end.message`, substitua por ele a mensagem parcial inteira.

O `usage` de nível superior contém o uso cumulativo mais recente informado pelo provedor para a resposta do assistente. Ele pode permanecer zerado até a conclusão quando o provedor não informa uso durante o streaming.

```json
{"type":"message_update","usage":{"input":100,"output":1,"cacheRead":0,"cacheWrite":0,"totalTokens":101,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello "}}
```

## Eventos de execução de ferramentas

| Evento | Campos | Significado |
|---|---|---|
| `tool_execution_start` | `toolCallId`, `toolName`, `args` | A execução da ferramenta começou. |
| `tool_execution_update` | `toolCallId`, `toolName`, `args`, `partialResult` | A ferramenta informou um resultado parcial. |
| `tool_execution_end` | `toolCallId`, `toolName`, `result`, `isError`, `durationMs` | A execução terminou. `durationMs` é o tempo de `execute()` medido por relógio monotônico; não aparece se a ferramenta não foi executada. |

Use `toolCallId` para correlacionar o ciclo de vida. `partialResult` é o resultado parcial mais recente fornecido pela ferramenta. Conforme o contrato de resultado dessa ferramenta, ele pode substituir ou complementar uma atualização anterior.

```json
{"type":"tool_execution_start","toolCallId":"call_abc123","toolName":"bash","args":{"command":"ls -la"}}
{"type":"tool_execution_update","toolCallId":"call_abc123","toolName":"bash","args":{"command":"ls -la"},"partialResult":{"content":[{"type":"text","text":"partial output"}],"details":{}}}
{"type":"tool_execution_end","toolCallId":"call_abc123","toolName":"bash","result":{"content":[{"type":"text","text":"complete output"}],"details":{}},"isError":false}
```

## Eventos de fila e estado

| Evento | Campos | Significado |
|---|---|---|
| `queue_update` | `steering`, `followUp` | A fila pendente de orientação ou acompanhamento mudou. Os dois campos contêm a fila atual completa. |
| `entry_appended` | `entry` | Uma extensão anexou uma entrada personalizada à sessão por `pi.appendEntry()`. |
| `session_info_changed` | `name` | O nome de exibição da sessão mudou. A ausência de `name` significa que ele foi apagado. |
| `thinking_level_changed` | `level` | O nível de raciocínio ativo mudou. |

O valor `entry` usa um [tipo de entrada de sessão](session-format.md#entry-types) persistido.

<a id="compaction_start--compaction_end"></a>
## Eventos de compactação

`compaction_start` informa por que a compactação começou:

```json
{"type":"compaction_start","reason":"threshold"}
```

`reason` é `"manual"`, `"threshold"` ou `"overflow"`.

`compaction_end` contém o resultado quando a compactação tem sucesso:

```json
{
  "type": "compaction_end",
  "reason": "threshold",
  "result": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {"...": "..."},
    "details": {}
  },
  "aborted": false,
  "willRetry": false
}
```

Se a compactação for cancelada, `result` estará ausente e `aborted` será `true`. Se falhar, `result` estará ausente, `aborted` será `false` e `errorMessage` descreverá a falha. Uma recuperação bem-sucedida de excesso de contexto define `willRetry` como `true` antes de o FineCode repetir o prompt.

Consulte [Compactação e resumos de ramificações](compaction.md) para entender a semântica dos resultados.

<a id="summarization_retry_scheduled--summarization_retry_attempt_start--summarization_retry_finished"></a>
## Eventos de novas tentativas

Uma nova tentativa do turno do assistente emite:

```json
{"type":"auto_retry_start","attempt":1,"maxAttempts":3,"delayMs":2000,"errorMessage":"529 overloaded"}
{"type":"auto_retry_end","success":true,"attempt":2}
```

Na falha final, `auto_retry_end` tem `success: false` e uma string `finalError`.

Novas tentativas de compactação e resumos de ramificação emitem:

```json
{"type":"summarization_retry_scheduled","attempt":1,"maxAttempts":3,"delayMs":2000,"errorMessage":"terminated"}
{"type":"summarization_retry_attempt_start","source":"compaction","reason":"threshold"}
{"type":"summarization_retry_finished"}
```

Para resumo de ramificação, `source` é `"branchSummary"` e `reason` está ausente. Em uma nova tentativa de compactação, `reason` é `"manual"`, `"threshold"` ou `"overflow"`.

<a id="bash_execution_update"></a>
## Eventos exclusivos de RPC

Um comando RPC direto [`bash`](rpc-commands.md#bash) emite um `bash_execution_update` para cada bloco de saída. O `id` opcional corresponde ao ID do comando. A resposta final pode conter saída truncada, mas esses eventos transmitem toda a saída:

```json
{"type":"bash_execution_update","id":"req-1","delta":"total 48\n"}
```

O RPC também acrescenta `extension_error` quando um handler de extensão lança uma exceção:

```json
{"type":"extension_error","extensionPath":"/path/to/extension.ts","event":"tool_call","error":"Error message"}
```

Registros da interface de extensões formam um subprotocolo RPC separado; não são valores `AgentSessionEvent`. Consulte [Interface RPC de extensões](rpc-extension-ui.md).

## Tipos TypeScript

O `AgentSessionEvent` do SDK contém snapshots cumulativos do streaming para consumidores no mesmo processo. JSON e RPC transformam somente `message_update`:

```typescript
type WithoutPartial<T> = T extends { partial: unknown } ? Omit<T, "partial"> : T;

type JsonAssistantMessageEvent<T> = T extends { type: "toolcall_start"; partial: unknown }
  ? WithoutPartial<T> & { id: string; toolName: string }
  : WithoutPartial<T>;

type JsonAgentSessionEvent =
  | Exclude<AgentSessionEvent, { type: "message_update" }>
  | {
      type: "message_update";
      usage: Usage;
      assistantMessageEvent: JsonAssistantMessageEvent<AssistantMessageEvent>;
    };
```

Use o tipo exportado `JsonAgentSessionEvent` do pacote `finecode`. A implementação do Pi upstream está disponível como referência em [`json-event.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/json-event.ts).

## Exemplo

Imprima mensagens concluídas em uma execução única:

```bash
finecode --mode json "List files" 2>/dev/null | jq -c 'select(.type == "message_end")'
```
