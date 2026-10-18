[English](../rpc-commands.md) | **Português (Brasil)**

# Comandos RPC

Esta referência lista os comandos aceitos em stdin no [modo RPC](rpc.md). Cada comando e resposta é um objeto JSON. Valores de mensagens compartilhados usam os [tipos de mensagem](message-types.md).

<a id="prompting"></a>
## Envio de prompts

### prompt

Envia um prompt de usuário ao agente. A resposta do comando é emitida depois que o prompt é aceito, enfileirado ou tratado. Após a aceitação, os eventos continuam sendo transmitidos de forma assíncrona.

```json
{"id":"req-1","type":"prompt","message":"Hello, world!"}
```

O campo opcional `images` usa o formato `ImageContent`: `{"type":"image","data":"base64-encoded-data","mimeType":"image/png"}`.

Se o agente já estiver transmitindo, é obrigatório especificar `streamingBehavior` para enfileirar a mensagem:

```json
{"type":"prompt","message":"New instruction","streamingBehavior":"steer"}
```

- `"steer"`: enfileira enquanto o agente está em execução. A mensagem é entregue quando termina a execução de chamadas de ferramentas do turno atual do assistente, antes da próxima chamada ao LLM.
- `"followUp"`: aguarda o término do agente e só então entrega a mensagem.

Se o agente estiver transmitindo e `streamingBehavior` não for informado, o comando retorna um erro. Comandos de extensão (por exemplo, `/mycommand`) são executados imediatamente mesmo durante o streaming; a extensão gerencia sua própria interação com LLM por `pi.sendMessage()`. Comandos de skills (`/skill:name`) e modelos de prompt (`/template`) são expandidos antes do envio ou enfileiramento.

```json
{"id":"req-1","type":"response","command":"prompt","success":true,"data":{"disposition":"started"}}
```

`data.disposition` é `"handled"` se uma extensão ou handler de entrada consumiu o prompt, `"queued"` se o FineCode o enfileirou durante uma execução, ou `"started"` se o aceitou para iniciar uma execução. Isso descreve o prompt enviado; não indica trabalho independente iniciado por uma extensão nem garante conclusão.

`success: true` significa que o prompt foi aceito, enfileirado ou tratado imediatamente. `success: false` significa que foi rejeitado antes da aceitação. Falhas posteriores à aceitação são informadas pelo fluxo normal de eventos e mensagens, não por uma segunda `response` para o mesmo ID.

**Exemplo adicional de payload do protocolo:**

```json
{"type": "prompt", "message": "What's in this image?", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

### steer

Enfileira uma mensagem de orientação enquanto o agente está em execução. Ela é entregue após o turno atual do assistente terminar suas chamadas de ferramentas e antes da próxima chamada ao LLM. Comandos de skills e modelos de prompt são expandidos. Comandos de extensão não são permitidos; use `prompt`.

```json
{"type":"steer","message":"Stop and do this instead"}
```

`images` é opcional e usa o mesmo formato de `prompt`.

```json
{"type":"response","command":"steer","success":true,"data":{"disposition":"queued"}}
```

`data.disposition` é `"handled"` se um handler de entrada consumiu a orientação, ou `"queued"` se o FineCode a enfileirou (inclusive depois de um handler transformá-la). Isso não garante que a mensagem continue na fila. Consulte [`set_steering_mode`](#set_steering_mode) para controlar o processamento.

**Exemplo adicional de payload do protocolo:**

```json
{"type": "steer", "message": "Look at this instead", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

### follow_up

Enfileira uma mensagem de acompanhamento para processamento depois que o agente terminar. Ela só é entregue quando não houver mais chamadas de ferramentas nem mensagens de orientação. Comandos de skills e modelos de prompt são expandidos. Comandos de extensão não são permitidos; use `prompt`.

```json
{"type":"follow_up","message":"After you're done, also do this"}
```

`images` é opcional e usa o mesmo formato de `prompt`.

```json
{"type":"response","command":"follow_up","success":true,"data":{"disposition":"queued"}}
```

`data.disposition` tem o mesmo significado de `steer`, aplicado à mensagem de acompanhamento. Consulte [`set_follow_up_mode`](#set_follow_up_mode) para controlar o processamento.

**Exemplo adicional de payload do protocolo:**

```json
{"type": "follow_up", "message": "Also check this image", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

### abort

Cancela a operação atual e aguarda a sessão ficar ociosa antes de responder.

```json
{"type":"abort"}
```

Resposta: `{"type":"response","command":"abort","success":true}`.

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "abort", "success": true}
```

### clear_queue

Remove mensagens de orientação e acompanhamento enfileiradas e retorna seus textos.

```json
{"type":"clear_queue"}
```

A resposta inclui `data.steering` e `data.followUp` com as mensagens removidas. Para implementar o comportamento interativo de Esc, envie `clear_queue` antes de `abort` e restaure no editor do cliente o texto retornado. `abort` continua as mensagens enfileiradas que ainda permanecerem na sessão.

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "clear_queue",
  "success": true,
  "data": {
    "steering": ["Change direction"],
    "followUp": ["Summarize when finished"]
  }
}
```

### new_session

Inicia uma sessão nova. Um handler de evento de extensão `session_before_switch` pode cancelar a operação. `parentSession` opcional registra o caminho da sessão pai.

```json
{"type":"new_session","parentSession":"/path/to/parent-session.jsonl"}
```

A resposta inclui `data.cancelled`, que indica se uma extensão cancelou a troca.

**Exemplos adicionais de payload do protocolo:**

```json
{"type": "new_session"}
```

```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": false}}
```

```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": true}}
```

<a id="state"></a>
## Estado

### get_state

Obtém o estado atual da sessão. `data` inclui `model` (objeto [Model](#model-object) completo, ou ausente quando não há modelo selecionado), `thinkingLevel`, `isStreaming`, `isCompacting`, `steeringMode`, `followUpMode`, `sessionFile`, `sessionId`, `sessionName`, `autoCompactionEnabled`, `messageCount` e `pendingMessageCount`. `sessionName` é o nome de exibição definido por `set_session_name` e só aparece se tiver sido definido.

```json
{"type":"get_state"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

### get_messages

Obtém todas as mensagens da conversa. `data.messages` contém objetos `AgentMessage` (consulte [Tipos de mensagem](message-types.md)).

```json
{"type":"get_messages"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_messages",
  "success": true,
  "data": {"messages": [...]}
}
```

<a id="model"></a>
## Modelo

### set_model

Troca para um modelo específico, identificado por `provider` e `modelId`. A resposta contém o objeto [Model](#model-object) completo.

```json
{"type":"set_model","provider":"anthropic","modelId":"claude-sonnet-4-20250514"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "set_model",
  "success": true,
  "data": {...}
}
```

### cycle_model

Avança para o próximo modelo disponível. Se houver somente um modelo, `data` retorna `null`. A resposta inclui `model`, `thinkingLevel` e `isScoped`.

```json
{"type":"cycle_model"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "cycle_model",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isScoped": false
  }
}
```

### get_available_models

Lista todos os modelos configurados. A resposta contém `data.models`, um array de objetos [Model](#model-object) completos.

```json
{"type":"get_available_models"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_available_models",
  "success": true,
  "data": {
    "models": [...]
  }
}
```

<a id="thinking"></a>
## Raciocínio

### set_thinking_level

Define o nível de raciocínio para modelos compatíveis. Os níveis são `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"` e `"max"`. `"xhigh"` e `"max"` só aparecem quando o modelo selecionado os aceita. Alguns modelos, incluindo GPT-5.6, expõem ambos.

```json
{"type":"set_thinking_level","level":"high"}
```

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "set_thinking_level", "success": true}
```

### cycle_thinking_level

Percorre os níveis de raciocínio disponíveis. Retorna `data: null` se o modelo não for compatível com raciocínio.

```json
{"type":"cycle_thinking_level"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "cycle_thinking_level",
  "success": true,
  "data": {"level": "high"}
}
```

### get_available_thinking_levels

Lista os níveis aceitos pelo modelo atual. Para modelos sem suporte a raciocínio, retorna `["off"]`.

```json
{"type":"get_available_thinking_levels"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_available_thinking_levels",
  "success": true,
  "data": {
    "levels": ["off", "minimal", "low", "medium", "high"]
  }
}
```

<a id="queue-modes"></a>
## Modos de fila

### set_steering_mode

Controla como as mensagens de orientação de `steer` são entregues. `mode` pode ser `"all"` (entrega todas depois da execução das chamadas de ferramentas do turno atual) ou `"one-at-a-time"` (uma por turno concluído; padrão).

```json
{"type":"set_steering_mode","mode":"one-at-a-time"}
```

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "set_steering_mode", "success": true}
```

### set_follow_up_mode

Controla a entrega de mensagens de acompanhamento de `follow_up`. `mode` pode ser `"all"` (entrega todas quando o agente termina) ou `"one-at-a-time"` (uma por conclusão do agente; padrão).

```json
{"type":"set_follow_up_mode","mode":"one-at-a-time"}
```

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "set_follow_up_mode", "success": true}
```

<a id="compaction"></a>
## Compactação

### compact

Compacta manualmente o contexto da conversa para reduzir o uso de tokens. `customInstructions` opcional pode direcionar o resumo. A resposta pode incluir `summary`, `firstKeptEntryId`, `tokensBefore`, `estimatedTokensAfter`, `usage` e `details`.

```json
{"type":"compact","customInstructions":"Focus on code changes"}
```

`estimatedTokensAfter` é uma estimativa heurística do contexto de mensagens reconstruído imediatamente após a compactação, não uma contagem exata do provedor. `usage` informa as chamadas ao LLM que geraram o resumo e pode estar ausente quando handlers personalizados executam a compactação.

**Exemplos adicionais de payload do protocolo:**

```json
{"type": "compact"}
```

```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {
      "input": 32000,
      "output": 1200,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 33200,
      "cost": {"input": 0.01, "output": 0.02, "cacheRead": 0, "cacheWrite": 0, "total": 0.03}
    },
    "details": {}
  }
}
```

### set_auto_compaction

Ativa ou desativa a compactação automática quando o contexto está quase cheio.

```json
{"type":"set_auto_compaction","enabled":true}
```

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "set_auto_compaction", "success": true}
```

<a id="retry"></a>
## Nova tentativa

### set_auto_retry

Ativa ou desativa novas tentativas automáticas para erros transitórios, como sobrecarga, limite de solicitações e respostas 5xx.

```json
{"type":"set_auto_retry","enabled":true}
```

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "set_auto_retry", "success": true}
```

### abort_retry

Cancela uma nova tentativa em andamento, interrompendo a espera e novas tentativas.

```json
{"type":"abort_retry"}
```

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "abort_retry", "success": true}
```

<a id="bash"></a>
## Bash

### bash

Executa um comando shell e acrescenta a saída ao contexto da conversa. Enquanto o comando roda, a saída é transmitida por eventos `bash_execution_update`; a resposta contém o resultado final. Defina `excludeFromContext: true` para armazenar a saída na sessão, mas omiti-la do contexto do modelo no próximo prompt. Inclua um `id` para associar eventos transmitidos ao comando.

```json
{"id":"req-1","type":"bash","command":"ls -la"}
```

A resposta contém `output`, `exitCode`, `cancelled` e `truncated`. Se a saída for truncada, inclui `fullOutputPath`.

O comando `bash` executa imediatamente e retorna um `BashResult`. Internamente, uma `BashExecutionMessage` é criada e armazenada no estado de mensagens do agente. Quando chega o próximo comando `prompt`, o FineCode transforma as mensagens de contexto antes de enviá-las ao modelo. A menos que `excludeFromContext` seja `true`, `BashExecutionMessage` vira uma `UserMessage` neste formato:

````
Ran `ls -la`
```
total 48
drwxr-xr-x ...
```
````

Assim, a saída bash incluída chega ao modelo no **próximo prompt**, não imediatamente. Vários comandos bash podem ser executados antes de um prompt; o FineCode inclui a saída de cada um que não tenha `excludeFromContext`.

**Exemplos adicionais de payload do protocolo:**

```json
{
  "id": "req-1",
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "truncated output...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": true,
    "fullOutputPath": "/tmp/pi-bash-abc123.log"
  }
}
```

### abort_bash

Cancela um comando bash em execução.

```json
{"type":"abort_bash"}
```

**Exemplo adicional de payload do protocolo:**

```json
{"type": "response", "command": "abort_bash", "success": true}
```

<a id="session"></a>
## Sessão

### get_session_stats

Obtém uso de tokens, estatísticas de custo e uso atual da janela de contexto. A resposta inclui `sessionFile`, `sessionId`, contagens de mensagens do usuário e do assistente, chamadas e resultados de ferramentas, `totalMessages`, totais `tokens` e `cost`, e `contextUsage`.

`tokens` e `cost` incluem mensagens do assistente, uso informado por ferramentas e geração de resumos de compactação/ramificação em toda a sessão. `contextUsage` contém a estimativa real da janela atual usada para compactação e exibição no rodapé.

`contextUsage` é omitido quando não há modelo ou janela de contexto disponível. Imediatamente após uma compactação, `contextUsage.tokens` e `contextUsage.percent` são `null` até que uma resposta nova do assistente forneça dados de uso válidos.

```json
{"type":"get_session_stats"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 50000,
      "output": 10000,
      "cacheRead": 40000,
      "cacheWrite": 5000,
      "total": 105000
    },
    "cost": 0.45,
    "contextUsage": {
      "tokens": 60000,
      "contextWindow": 200000,
      "percent": 30
    }
  }
}
```

### export_html

Exporta a sessão para um arquivo HTML. `outputPath` opcional define um caminho personalizado; a resposta retorna o caminho em `data.path`.

```json
{"type":"export_html","outputPath":"/tmp/session.html"}
```

**Exemplos adicionais de payload do protocolo:**

```json
{"type": "export_html"}
```

```json
{
  "type": "response",
  "command": "export_html",
  "success": true,
  "data": {"path": "/tmp/session.html"}
}
```

### switch_session

Carrega outro arquivo de sessão. Um handler de extensão `session_before_switch` pode cancelar. A resposta informa `data.cancelled`.

```json
{"type":"switch_session","sessionPath":"/path/to/session.jsonl"}
```

**Exemplos adicionais de payload do protocolo:**

```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": false}}
```

```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": true}}
```

### fork

Cria um fork a partir de uma mensagem de usuário anterior no ramo ativo. Um handler `session_before_fork` pode cancelar. Retorna o texto da mensagem de origem em `data.text`.

```json
{"type":"fork","entryId":"abc123"}
```

**Exemplos adicionais de payload do protocolo:**

```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": false}
}
```

```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"cancelled": true}
}
```

### clone

Duplica o ramo ativo atual em uma sessão nova na posição atual. Um handler `session_before_fork` pode cancelar. A resposta informa `data.cancelled`.

```json
{"type":"clone"}
```

**Exemplos adicionais de payload do protocolo:**

```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": false}
}
```

```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": true}
}
```

### get_fork_messages

Obtém as mensagens do usuário disponíveis para criar forks. A resposta retorna `data.messages`, cada uma com `entryId` e `text`.

```json
{"type":"get_fork_messages"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_fork_messages",
  "success": true,
  "data": {
    "messages": [
      {"entryId": "abc123", "text": "First prompt..."},
      {"entryId": "def456", "text": "Second prompt..."}
    ]
  }
}
```

### get_entries

Obtém todas as entradas da sessão na ordem em que foram acrescentadas, sem o cabeçalho. A sessão é uma árvore de entradas somente de acréscimo com IDs estáveis; portanto, um ID serve como cursor durável: passe o último ID visto em `since` para obter somente entradas posteriores a ele, inclusive após reiniciar o cliente. Diferentemente de `get_messages`, inclui o histórico anterior à compactação e ramos abandonados.

```json
{"type":"get_entries","since":"abc123"}
```

A resposta contém `data.entries` e `leafId`. `leafId` é o ID da folha atual (`null` para uma sessão vazia), permitindo verificar em uma única ida e volta se o ramo ativo mudou. Se `since` não corresponder a nenhuma entrada, `success` será `false`.

**Exemplos adicionais de payload do protocolo:**

```json
{"type": "get_entries"}
```

```json
{
  "type": "response",
  "command": "get_entries",
  "success": true,
  "data": {
    "entries": [
      {"type": "message", "id": "def456", "parentId": "abc123", "timestamp": "...", "message": {"role": "user", "...": "..."}}
    ],
    "leafId": "def456"
  }
}
```

### get_tree

Obtém a sessão como árvore de entradas. Cada nó tem `{entry, children, label?, labelTimestamp?}`. O resultado é um array, pois APIs de navegação podem criar várias raízes; entradas órfãs com cadeia de pais quebrada também aparecem como raízes. A resposta contém `data.tree` e `leafId`.

```json
{"type":"get_tree"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_tree",
  "success": true,
  "data": {
    "tree": [
      {
        "entry": {"type": "message", "id": "abc123", "parentId": null, "...": "..."},
        "children": [
          {"entry": {"type": "message", "id": "def456", "parentId": "abc123", "...": "..."}, "children": []}
        ]
      }
    ],
    "leafId": "def456"
  }
}
```

### get_last_assistant_text

Obtém o conteúdo textual da última mensagem do assistente. `data.text` é `null` se não houver texto do assistente.

```json
{"type":"get_last_assistant_text"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_last_assistant_text",
  "success": true,
  "data": {"text": "The assistant's response..."}
}
```

### set_session_name

Define um nome de exibição para a sessão atual. O nome aparece nas listas de sessões para ajudar a identificá-las. O nome atual também fica disponível no campo `sessionName` de `get_state`. Para defini-lo ao iniciar o modo RPC, passe `--name <name>` ou `-n <name>` ao processo `finecode --mode rpc`.

```json
{"type":"set_session_name","name":"my-feature-work"}
```

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "set_session_name",
  "success": true
}
```

<a id="discoverable-commands"></a>
## Comandos descobríveis

### get_commands

Obtém comandos disponíveis (comandos de extensão, modelos de prompt e skills). Execute-os por `prompt`, prefixando o nome com `/`.

```json
{"type":"get_commands"}
```

Cada item de `data.commands` contém:

- `name`: nome do comando (use `/name`).
- `description`: descrição legível (opcional para comandos de extensão).
- `source`: tipo do comando: `"extension"` (registrado por `pi.registerCommand()`), `"prompt"` (carregado de um arquivo `.md` de modelo de prompt) ou `"skill"` (carregado de um diretório de skill; o nome tem prefixo `skill:`).
- `sourceInfo`: metadados do recurso que registrou o comando: `path` (caminho absoluto), `source` (como o FineCode o descobriu, por exemplo `"local"`, `"auto"` ou `"cli"`), `scope` (`"user"`, `"project"` ou `"temporary"`), `origin` (`"top-level"` ou `"package"`) e, quando aplicável, `baseDir` do pacote.

Comandos integrados da TUI (`/settings`, `/hotkeys` etc.) não são incluídos. Eles só são tratados no modo interativo e não seriam executados se enviados por `prompt`.

**Exemplo adicional de payload do protocolo:**

```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {
        "name": "fix-tests",
        "description": "Fix failing tests",
        "source": "prompt",
        "sourceInfo": {
          "path": "/home/user/myproject/.pi/agent/prompts/fix-tests.md",
          "source": "local",
          "scope": "project",
          "origin": "top-level"
        }
      }
    ]
  }
}
```

<a id="model-object"></a>
## Objeto Model

Comandos de modelo retornam a definição configurada completa. Custos são em dólares americanos por milhão de tokens.

```json
{
  "id": "claude-sonnet-4-20250514",
  "name": "Claude Sonnet 4",
  "api": "anthropic-messages",
  "provider": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "reasoning": true,
  "input": ["text", "image"],
  "contextWindow": 200000,
  "maxTokens": 16384,
  "cost": { "input": 3.0, "output": 15.0, "cacheRead": 0.3, "cacheWrite": 3.75 }
}
```

Para configurar modelos, consulte [Configurar um endpoint compatível](models.md#configure-a-compatible-endpoint). Em TypeScript, use o tipo exportado `Model` de `@earendil-works/pi-ai`.
