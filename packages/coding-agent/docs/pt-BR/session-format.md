[English](../session-format.md) | **Português (Brasil)**

# Formato dos arquivos de sessão

As sessões são armazenadas como arquivos JSONL (JSON Lines). Cada linha é um objeto JSON com um campo `type`. As entradas da sessão formam uma árvore por meio dos campos `id`/`parentId`, permitindo ramificações no mesmo arquivo.

Para criação programática, persistência e navegação na árvore, consulte a [API `SessionManager`](sdk.md#sessionmanager-api).

## Localização do arquivo

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<session-id>.jsonl
```

Por padrão, `<session-id>` é um UUID. Chamadores podem fornecer um ID personalizado pelo SDK ou com `--session-id`. Para `<path>`, o FineCode remove o separador de caminho inicial e substitui `/`, `\\` e `:` por `-`.

## Excluir sessões

As sessões podem ser removidas apagando seus arquivos `.jsonl` em `~/.pi/agent/sessions/`.

O FineCode também permite excluir sessões de forma interativa em `/resume` (selecione uma sessão, pressione `Ctrl+D` e confirme). Quando disponível, o FineCode usa a CLI `trash` para evitar a exclusão permanente.

## Versão da sessão

As sessões têm um campo de versão no cabeçalho:

- **Versão 1**: sequência linear de entradas (legada; migrada automaticamente ao carregar)
- **Versão 2**: estrutura em árvore com vínculos `id`/`parentId`
- **Versão 3**: papel `hookMessage` renomeado para `custom` (unificação de extensões)

Sessões existentes são migradas automaticamente para a versão atual (v3) ao serem carregadas.

## Arquivos-fonte

Código-fonte no GitHub ([Pi](https://github.com/earendil-works/pi)):

- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) — tipos de entrada da sessão e `SessionManager`
- [Tipos de mensagem](message-types.md) — referência compartilhada de mensagens e blocos de conteúdo
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) — tipos de mensagem estendidos
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) — tipos básicos de mensagem e blocos de conteúdo
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) — união extensível `AgentMessage`

Para definições TypeScript do projeto, examine `node_modules/finecode/dist/` e `node_modules/@earendil-works/pi-ai/dist/`.

## Mensagens

Uma entrada `message` armazena um [`AgentMessage`](message-types.md). Blocos de conteúdo, papéis, uso e timestamps das mensagens estão definidos em [Tipos de mensagem](message-types.md).

Os timestamps das entradas de sessão são strings ISO 8601. O timestamp da mensagem aninhada é um timestamp Unix em milissegundos.

<a id="entry-base"></a>
## Base das entradas

Todas as entradas, exceto `SessionHeader`, estendem `SessionEntryBase`:

```typescript
interface SessionEntryBase {
  type: string;
  id: string;           // Geralmente um ID hexadecimal de 8 caracteres; pode ser um UUID completo
  parentId: string | null;  // ID da entrada pai (null para uma entrada raiz)
  timestamp: string;    // Timestamp ISO
}
```

<a id="entry-types"></a>
## Tipos de entrada

<a id="sessionheader"></a>
### SessionHeader

Primeira linha do arquivo. Contém somente metadados e não faz parte da árvore (sem `id`/`parentId`).

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

Para sessões com uma sessão pai (criadas por `/fork`, `/clone` ou `newSession({ parentSession })`):

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

<a id="sessionmessageentry"></a>
### SessionMessageEntry

Uma mensagem da conversa. O campo `message` contém um `AgentMessage`. Mensagens de sistema carregam o prompt e o conjunto de ferramentas: a primeira solicitação da sessão persiste uma mensagem com todas as seções do prompt e declarações de ferramentas; alterações posteriores são persistidas como mensagens de sistema que atualizam `sections` pelo nome (`null` remove uma seção) e listam `toolsAdded`/`toolsRemoved`. Reproduzi-las em ordem resulta no prompt e nas ferramentas atuais; não há uma entrada separada para o estado do prompt.

```json
{"type":"message","id":"a0b1c2d3","parentId":null,"timestamp":"2024-12-03T14:00:00.000Z","message":{"role":"system","content":"","sections":{"preamble":"You are an expert coding assistant...","tools":"<tools>\n- read: ...\n</tools>","cwd":"/project"},"toolsAdded":[{"name":"read","description":"...","parameters":{}}],"timestamp":1733234400000}}
{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:04:00.000Z","message":{"role":"system","content":"","sections":{"skills":"<skills>...</skills>"},"toolsRemoved":[{"name":"write"}],"timestamp":1733234640000}}
```

Sessões criadas antes de existirem mensagens de sistema não têm uma mensagem de sistema inicial; a primeira solicitação persiste o prompt atual em uma mensagem de sistema posterior, que é reproduzida da mesma maneira.

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello","timestamp":1733234401000}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop","timestamp":1733234402000}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false,"timestamp":1733234403000}}
```

Mensagens do assistente indicam o modelo que as produziu. Mensagens mais recentes também registram `thinkingLevel`, o nível de raciocínio solicitado ao FineCode para aquela resposta.

<a id="modelchangeentry"></a>
### ModelChangeEntry

Emitida quando o usuário troca de modelo durante a sessão. A entrada mais recente indica o modelo selecionado, que pode ser um [modelo virtual](virtual-models.md); as mensagens do assistente indicam então o modelo físico que respondeu.

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```

<a id="thinkinglevelchangeentry"></a>
### ThinkingLevelChangeEntry

Emitida quando o usuário altera o nível de raciocínio.

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

<a id="usageentry"></a>
### UsageEntry

Registra o uso atribuído a um modelo que não é uma mensagem do assistente e não participa do contexto do LLM. `kind` é uma string arbitrária que identifica a operação; por exemplo, o aquecimento de cache usa `"cache_warm"`.

```json
{"type":"usage","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:08:00.000Z","kind":"cache_warm","provider":"anthropic","model":"claude-sonnet-4-5","usage":{"input":0,"output":0,"cacheRead":50000,"cacheWrite":0,"totalTokens":50000,"cost":{"input":0,"output":0,"cacheRead":0.015,"cacheWrite":0,"total":0.015}}}
```

Entradas de uso contribuem para os totais de tokens e custo da sessão. O FineCode as oculta da árvore da conversa. Consumidores devem tratar valores de `kind` desconhecidos como uso normal, em vez de rejeitá-los.

<a id="compactionentry"></a>
### CompactionEntry

Criada quando o contexto é compactado. Armazena um resumo das mensagens anteriores e um checkpoint completo do prompt de sistema e das ferramentas.

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000,"systemMessage":{"role":"system","content":"You are a coding assistant.","toolsAdded":[],"timestamp":1733235000000}}
```

`firstKeptEntryId` é obrigatório. Identifica a primeira entrada anterior à compactação que foi mantida. Ao reconstruir o contexto, o FineCode substitui as entradas antigas resumidas pelo resumo de compactação e mantém o intervalo que começa nessa entrada. Uma compactação que não mantém nenhuma entrada armazena seu próprio ID nesse campo, de modo que nenhuma entrada anterior seja preservada.

Campos opcionais:

- `systemMessage`: seções reproduzidas do prompt e declarações de ferramentas no limite da compactação; torna-se a mensagem de sistema inicial do contexto compactado, e mensagens de sistema entre as entradas mantidas são descartadas em seu favor. Ausente em entradas de sessões antigas.
- `usage`: uso de LLM ao gerar o resumo; incluído nos totais de tokens e custo da sessão.
- `details`: dados específicos da implementação (por exemplo, `{ readFiles: string[], modifiedFiles: string[] }` no padrão, ou dados personalizados para extensões).
- `fromHook`: `true` se gerada por uma extensão; `false`/`undefined` se gerada pelo Pi (nome de campo legado).

<a id="contexteditentry"></a>
### ContextEditEntry

Edição somente de acréscimo de uma entrada anterior que produz contexto. Altera apenas o contexto de futuras solicitações ao modelo; a entrada-alvo e seus metadados permanecem inalterados no histórico bruto, na interface, nas exportações e na contabilização da sessão.

```json
{"type":"context_edit","id":"g6h7i8j9","parentId":"f6g7h8i9","timestamp":"2024-12-03T14:11:00.000Z","targetId":"c3d4e5f6","replacement":null}
```

Os alvos podem ser entradas de usuário, assistente, resultado de ferramenta ou mensagem personalizada. `replacement: null` omite o alvo do contexto do modelo. Um `replacement` não nulo substitui somente o conteúdo da mensagem-alvo. Substituições string para entradas de assistente e resultado de ferramenta são normalizadas para um bloco de texto, pois esses papéis exigem arrays de conteúdo. Se várias edições tiverem o mesmo alvo, vence a mais recente no ramo ativo. Edições são relativas ao ramo: navegar para um ponto anterior à edição revela novamente a contribuição original do alvo.

<a id="branchsummaryentry"></a>
### BranchSummaryEntry

Criada ao trocar de ramo por `/tree`, com um resumo gerado por LLM do ramo abandonado até o ancestral comum. Captura o contexto do caminho deixado para trás.

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```

`parentId` é a entrada a partir da qual o novo ramo continua. `fromId` é a folha anterior cujo caminho abandonado foi resumido.

Campos opcionais:

- `usage`: uso de LLM ao gerar o resumo; incluído nos totais de tokens e custo da sessão.
- `details`: dados de acompanhamento de arquivos (`{ readFiles: string[], modifiedFiles: string[] }`) no padrão, ou dados personalizados para extensões.
- `fromHook`: `true` se gerada por uma extensão; `false`/`undefined` se gerada pelo Pi (nome de campo legado).

<a id="customentry"></a>
### CustomEntry

Persistência de estado de extensão. **Não** participa do contexto do LLM.

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

Use `customType` para identificar as entradas da sua extensão ao recarregá-la. O modo interativo pode renderizar entradas personalizadas por `pi.registerEntryRenderer(customType, renderer)`, mas elas continuam fora do contexto do LLM.

O FineCode armazena o estado do roteador de [modelos virtuais](virtual-models.md) como entradas personalizadas com `customType` `pi.virtual-model-state` e `data` `{ provider, modelId, state }`.

<a id="custommessageentry"></a>
### CustomMessageEntry

Mensagens injetadas por extensões que **participam** do contexto do LLM.

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

Campos:

- `content`: string ou `(TextContent | ImageContent)[]` (igual a `UserMessage`).
- `display`: `true` = exibir na TUI com estilo distinto; `false` = ocultar.
- `details`: metadados opcionais específicos da extensão (não enviados ao LLM).

<a id="labelentry"></a>
### LabelEntry

Marcador ou favorito definido pelo usuário em uma entrada.

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

Defina `label` como `undefined` para limpar um rótulo.

<a id="sessioninfoentry"></a>
### SessionInfoEntry

Metadados da sessão, como um nome de exibição definido pelo usuário. Definido por `/name`, `--name`/`-n` ou `pi.setSessionName()` em extensões.

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

Quando definido, o nome da sessão aparece no seletor de sessões (`/resume`) em vez da primeira mensagem.

## Estrutura da árvore

As entradas normalmente formam uma árvore, mas APIs de navegação podem criar várias raízes:

- Uma entrada raiz tem `parentId: null`; inicialmente, a primeira entrada é a raiz.
- Cada entrada não raiz aponta para sua entrada pai por `parentId`.
- Criar um ramo adiciona filhos a partir de uma entrada anterior.
- A “folha” é a posição atual na árvore.
- Chamar `resetLeaf()` ou `branchWithSummary(null, ...)` permite que uma entrada posterior se torne outra raiz.

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← folha atual
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← ramo alternativo
```

## Construção do contexto

`buildContextEntries()` percorre da folha atual até a raiz e produz a lista de entradas ativas, respeitando a compactação:

1. Coleta todas as entradas do caminho.
2. Se houver uma ou mais entradas `CompactionEntry` no caminho, usa a mais recente:
   - Inclui primeiro a entrada de compactação.
   - Inclui entradas que não sejam de sistema desde `firstKeptEntryId` até, mas sem incluir, a entrada de compactação.
   - Inclui as entradas posteriores à compactação.
3. Preserva entradas que não sejam mensagens no intervalo selecionado para que o modo interativo possa renderizá-las.

`buildSessionProjection()` aplica então o `context_edit` mais recente para cada alvo selecionado. Retorna as mensagens visíveis ao modelo junto às entradas de origem. Alvos omitidos não produzem mensagem; substituições mantêm papel e metadados da entrada de origem, alterando somente o conteúdo. As entradas selecionadas brutas não são modificadas.

`buildSessionContext()` usa essa projeção para produzir a lista de mensagens do LLM:

1. Extrai as configurações atuais de modelo e nível de raciocínio de todo o caminho.
2. Converte as entradas selecionadas em mensagens:
   - `message` → `AgentMessage` armazenada
   - `compaction` → checkpoint de sistema completo seguido por `compactionSummary`
   - `branch_summary` → `branchSummary`
   - `custom_message` → `CustomMessage`
   - `context_edit` → não gera mensagem de contexto própria
   - `usage` e `custom` → não geram mensagem de contexto

O resumo da compactação substitui entradas anteriores a `firstKeptEntryId`. Mensagens de sistema anteriores à compactação são incorporadas ao checkpoint completo, em vez de serem reproduzidas do intervalo mantido. Entradas mantidas que não sejam de sistema e todas as entradas posteriores à compactação continuam disponíveis ao LLM.

## Exemplo de análise

```typescript
import { readFileSync } from "fs";

const lines = readFileSync("session.jsonl", "utf8").trim().split("\n");

for (const line of lines) {
  const entry = JSON.parse(line);

  switch (entry.type) {
    case "session":
      console.log(`Session v${entry.version ?? 1}: ${entry.id}`);
      break;
    case "message":
      console.log(`[${entry.id}] ${entry.message.role}: ${JSON.stringify(entry.message.content)}`);
      break;
    case "compaction":
      console.log(`[${entry.id}] Compaction: ${entry.tokensBefore} tokens summarized`);
      break;
    case "branch_summary":
      console.log(`[${entry.id}] Branch from ${entry.fromId}`);
      break;
    case "usage":
      console.log(`[${entry.id}] Usage (${entry.kind}): ${entry.usage.totalTokens} tokens`);
      break;
    case "custom":
      console.log(`[${entry.id}] Custom (${entry.customType}): ${JSON.stringify(entry.data)}`);
      break;
    case "custom_message":
      console.log(`[${entry.id}] Extension message (${entry.customType}): ${entry.content}`);
      break;
    case "label":
      console.log(`[${entry.id}] Label "${entry.label}" on ${entry.targetId}`);
      break;
    case "model_change":
      console.log(`[${entry.id}] Model: ${entry.provider}/${entry.modelId}`);
      break;
    case "thinking_level_change":
      console.log(`[${entry.id}] Thinking: ${entry.thinkingLevel}`);
      break;
  }
}
```
