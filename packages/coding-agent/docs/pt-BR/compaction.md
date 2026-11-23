[English](../compaction.md) | **Português (Brasil)**

# Referência de compactação

Esta referência descreve compactação automática, resumos de ramificações, entradas persistidas e hooks de extensões. Para o fluxo de uso, consulte [Sessões e contexto](sessions.md#manage-conversation-context).

**Arquivos-fonte** ([Pi upstream](https://github.com/earendil-works/pi)):

- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) — lógica de compactação automática.
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) — resumo de ramificações.
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) — utilitários compartilhados (rastreamento de arquivos, serialização).
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) — tipos de entrada (`CompactionEntry`, `BranchSummaryEntry`).
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) — tipos de evento de extensão.

Para definições TypeScript do projeto, examine `node_modules/finecode/dist/`.

## Visão geral

O FineCode tem dois mecanismos de resumo:

| Mecanismo | Gatilho | Finalidade |
|---|---|---|
| Compactação | O contexto ultrapassa o limite ou é usado `/compact` | Resumir mensagens antigas para liberar contexto. |
| Resumo de ramificação | Navegação por `/tree` | Preservar contexto ao trocar de ramo. |

Ambos usam formatos estruturados semelhantes e acompanham operações de arquivo de forma cumulativa. Solicitações de resumo desativam gravações no cache de prompt, pois é improvável que esses prompts pontuais sejam reutilizados.

## Compactação

### Quando é acionada

A compactação automática é acionada quando:

```
contextTokens > contextWindow - reserveTokens
```

Por padrão, `reserveTokens` é 16384 tokens (configurável em `~/.pi/agent/settings.json` ou `<project-dir>/.pi/settings.json`). Ele determina somente quando a compactação começa. Solicitações de resumo usam o limite de saída do modelo, reduzido quando necessário para que entrada e saída caibam na janela de contexto.

Durante uma execução do agente com vários turnos, o FineCode verifica o contexto projetado canônico depois que as ferramentas terminam e seus resultados são acrescentados, antes de iniciar a próxima resposta do assistente. Se o limite tiver sido ultrapassado, compacta durante `prepareNextTurn` e então executa a consulta de acompanhamento da fila de orientação existente antes de `turn_start`. A verificação entre turnos é ignorada quando o lote concluído de ferramentas encerra a execução e nenhuma mensagem enfileirada exige outra resposta. O FineCode também verifica antes de um novo prompt do usuário e executa a recuperação final de excesso de contexto depois que a execução de baixo nível termina.

Um erro de estouro de contexto do provedor ou um `stopReason: "length"` final antecipado pode selecionar uma tentativa de recuperação que compacta e repete. Respostas de limite que contenham chamadas de ferramentas mantêm os resultados sintéticos de ferramenta com falha e seguem o agendador normal de ferramentas e filas, em vez de encerrar a execução à força.

Também é possível acionar a compactação manualmente com `/compact [instructions]`; as instruções opcionais direcionam o resumo.

### Como funciona

1. **Encontrar o ponto de corte**: percorre a projeção final da sessão de trás para frente, acumulando estimativas de tokens até atingir `keepRecentTokens` (padrão 20 mil, configurável em `~/.pi/agent/settings.json` ou `<project-dir>/.pi/settings.json`).
2. **Extrair mensagens**: coleta mensagens projetadas do limite anterior mantido (ou do início da sessão) até o ponto de corte.
3. **Gerar resumo**: chama o LLM com um formato estruturado, passando o resumo anterior como contexto iterativo, se houver.
4. **Acrescentar entrada**: salva `CompactionEntry` com o resumo e `firstKeptEntryId`.
5. **Reconstruir contexto**: a sessão reconstrói o contexto da próxima solicitação usando o resumo e as mensagens a partir de `firstKeptEntryId`.

```
Antes da compactação:

  entrada: 0     1     2     3      4     5     6      7      8     9
         ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
         │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
         └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                 └────────┬───────┘ └──────────────┬──────────────┘
                mensagens a resumir           mensagens mantidas
                                    ↑
                         firstKeptEntryId (entrada 4)

Depois da compactação (nova entrada acrescentada):

  entrada: 0     1     2     3      4     5     6      7      8     9     10
         ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┬─────┐
         │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
         └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
                └──────────┬──────┘ └──────────────────────┬───────────────────┘
                   não enviado ao LLM              enviado ao LLM
                                                          ↑
                                                começa em firstKeptEntryId

O que o LLM vê:

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   da comp.          mensagens a partir de firstKeptEntryId
```

Em compactações repetidas, o trecho resumido começa no limite mantido pela compactação anterior (`firstKeptEntryId`), não na própria entrada de compactação; se essa entrada mantida não for encontrada no caminho, usa-se a entrada posterior à compactação anterior. Uma compactação que não mantém nenhuma entrada registra seu próprio ID como `firstKeptEntryId`; a compactação seguinte começa depois dela. Isso preserva mensagens sobreviventes da compactação anterior, incluindo-as também na próxima etapa de resumo. Antes de gravar a nova `CompactionEntry`, o FineCode recalcula `tokensBefore` a partir da projeção reconstruída da sessão com edições de contexto, para refletir o contexto real substituído. Entradas brutas omitidas continuam armazenadas, mas não afetam a seleção do corte, os resumos, os checkpoints nem as estimativas de tokens.

### Ordem da recuperação de excesso e limite

A recuperação preserva o ciclo de vida e a ordem existentes da fila. A tentativa concluída continua visível em `turn_end` e `agent_end`; depois da execução, a recuperação corrige o contexto persistido do modelo antes de uma nova tentativa:

```text
persistir resposta final do assistente
→ turn_end de extensão/público
→ agent_end de extensão/público
→ acrescentar omissões context_edit para a tentativa selecionada
→ em caso de excesso/limite: executar session_before_compact e acrescentar compactação se houver sucesso
→ iniciar a nova tentativa como uma execução nova
```

Se a compactação de recuperação falhar ou for cancelada, o FineCode mantém as edições de omissão, não acrescenta compactação e não agenda nova tentativa interna. O trabalho já enfileirado continua sujeito às regras normais de orientação e acompanhamento. `agent_before_settle` vê a projeção corrigida depois do processamento de recuperação. O histórico bruto da transcrição, as exportações, os totais de cobrança e extensões de busca no histórico ainda podem inspecionar a tentativa omitida.

### Trechos divididos de mensagem do usuário

Um trecho de mensagem do usuário começa com uma mensagem do usuário e inclui todos os turnos até a próxima mensagem do usuário. Normalmente, a compactação corta nos limites entre mensagens do usuário.

Quando um trecho ultrapassa `keepRecentTokens`, o ponto de corte cai dentro dele, em uma mensagem do assistente. Esse é um trecho dividido de mensagem do usuário:

```
Trecho dividido (um trecho ultrapassa o limite):

  entrada: 0     1     2      3     4      5      6     7      8
         ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
         │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
         └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                 ↑                                     ↑
          turnStartIndex = 1                  firstKeptEntryId = 7
                 │                                     │
                 └──── mensagens de prefixo (1–6) ────┘
                                                       └── mantidas (7–8)

  isSplitTurn = true
  messagesToSummarize = []  (nenhum trecho anterior de mensagem do usuário)
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

Para trechos divididos, o FineCode gera dois resumos e os combina:

1. **Resumo do histórico**: contexto anterior, se houver.
2. **Resumo do prefixo do trecho da mensagem do usuário**: a parte inicial do trecho dividido.

### Regras para o ponto de corte

Pontos de corte válidos:

- Mensagens do usuário.
- Mensagens do assistente.
- Mensagens `BashExecution`.
- Mensagens personalizadas (`custom_message`, `branch_summary`).

Nunca corte em resultados de ferramentas; eles precisam permanecer junto à chamada correspondente.

A preparação avança o limite mantido para dentro de um sufixo invisível ao contexto somente quando esse sufixo contém uma tentativa omitida do assistente e não contém entradas que produzam contexto e não tenham sido omitidas. Omissões `context_edit` de recuperação satisfazem essa regra; metadados intrinsecamente invisíveis ao contexto podem coexistir com elas. Metadados sozinhos e novas mensagens personalizadas não movem o corte. Uma edição de substituição que afete a entrada candidata ou o prefixo resumido também impede o avanço, pois o assistente omitido respondeu à entrada anterior à edição; substituições de entradas de sufixo que serão omitidas são seguras. Isso permite resumir uma entrada recuperada acima do limite mantendo as edições que omitem a tentativa abandonada, sem deixar que alterações administrativas mudem se uma nova entrada do modelo é preservada literalmente.

### Estrutura de CompactionEntry

Definida em [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts):

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // Uso de LLM que gerou o resumo
  fromHook?: boolean;  // true se fornecido por extensão (nome legado)
  details?: T;         // Dados específicos da implementação
}

// A compactação padrão usa isto em details (de compaction.ts):
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

Extensões podem armazenar em `details` quaisquer dados serializáveis em JSON. A compactação padrão acompanha operações de arquivos, mas implementações personalizadas podem usar sua própria estrutura. Resumos gerados e fornecidos por extensões armazenam o `usage` do LLM quando disponível, para que o total da sessão inclua o trabalho de sumarização.

Consulte [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) e [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) para ver a implementação. Para gerar resumos diretamente por código, `generateSummary()` retorna o texto do resumo e `generateSummaryWithUsage()` retorna `{ text, usage }`.

## Resumo de ramificações

### Quando é acionado

Ao usar `/tree` para navegar até outro ramo, o FineCode oferece resumir o trabalho que está sendo deixado. Isso injeta o contexto do ramo abandonado no novo ramo.

### Como funciona

1. **Encontrar o ancestral comum**: o nó mais profundo compartilhado pelas posições antiga e nova.
2. **Coletar entradas**: percorre da folha antiga até o ancestral comum.
3. **Preparar com limite**: inclui mensagens até o limite de tokens, começando pelas mais recentes.
4. **Gerar resumo**: chama o LLM com formato estruturado.
5. **Acrescentar entrada**: salva `BranchSummaryEntry` no ponto de navegação.

```
Árvore antes da navegação:

         ┌─ B ─ C ─ D (folha antiga, será abandonada)
    A ───┤
         └─ E ─ F (destino)

Ancestral comum: A
Entradas a resumir: B, C, D

Depois da navegação com resumo:

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [resumo de B,C,D] (nova folha)
```

### Rastreamento cumulativo de arquivos

A compactação padrão e o resumo de ramificações acompanham arquivos de forma cumulativa. Ambos extraem operações de arquivos das chamadas de ferramentas nas mensagens resumidas. A compactação também carrega listas de arquivos da compactação anterior gerada pelo FineCode. O resumo de ramificações carrega listas dos resumos de ramificações gerados pelo FineCode nas entradas que resume.

Assim, o rastreamento de arquivos se acumula entre compactações padrão e resumos de ramificações padrão aninhados. O FineCode não carrega automaticamente listas de arquivos de resumos gerados por extensões cujo campo `fromHook` seja `true`; as extensões gerenciam seu próprio formato em `details`.

### Estrutura de BranchSummaryEntry

Definida em [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts):

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  fromId: string;      // Entrada de onde navegamos
  usage?: Usage;       // Uso de LLM que gerou o resumo
  fromHook?: boolean;  // true se fornecido por extensão (nome legado)
  details?: T;         // Dados específicos da implementação
}

// O resumo padrão de ramificações usa isto em details (de branch-summarization.ts):
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

Assim como na compactação, extensões podem armazenar dados personalizados em `details`.

Consulte [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts), [`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) e [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) para ver a implementação.

## Formato do resumo

Ambos os formatos incluem Goal, Constraints & Preferences, Progress, Key Decisions e Next Steps. Resumos de compactação também incluem Critical Context. Resumos de ramificação terminam depois de Next Steps. O FineCode acrescenta listas de arquivos a ambos os formatos quando pertinente.

Resumos de compactação usam este formato:

```markdown
## Goal
[O que o usuário está tentando realizar]

## Constraints & Preferences
- [Requisitos mencionados pelo usuário]

## Progress
### Done
- [x] [Tarefas concluídas]

### In Progress
- [ ] [Trabalho atual]

### Blocked
- [Problemas, se houver]

## Key Decisions
- **[Decisão]**: [Justificativa]

## Next Steps
1. [O que deve acontecer a seguir]

## Critical Context
- [Dados necessários para continuar]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### Serialização de mensagens

Antes da sumarização, mensagens são serializadas como texto por [`serializeConversation()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts):

```
[User]: O que foi dito
[Assistant]: Texto da resposta
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Saída da ferramenta
```

Isso impede que o modelo trate o conteúdo como uma conversa a continuar.

Blocos de raciocínio são omitidos. Provedores retornam resumos do raciocínio real, e o raciocínio reproduzido muitas vezes não faz parte do contexto ativo do modelo; incluí-lo poderia tornar a solicitação de resumo maior que o contexto resumido.

Resultados de ferramentas são truncados em 2000 caracteres durante a serialização. O conteúdo excedente é substituído por um marcador com a quantidade de caracteres omitidos. Isso mantém as solicitações de resumo dentro de limites razoáveis de tokens, pois resultados de ferramentas (especialmente `read` e `bash`) costumam ser os maiores contribuintes para o contexto.

## Sumarização personalizada por extensões

Extensões podem interceptar e personalizar tanto a compactação quanto o resumo de ramificações. Consulte [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) para as definições dos tipos de evento.

### session_before_compact

Disparado antes da compactação automática ou de `/compact`. Pode cancelar a operação ou fornecer um resumo personalizado. Consulte `SessionBeforeCompactEvent` e `CompactionPreparation` no arquivo de tipos.

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - mensagens a resumir
  // preparation.turnPrefixMessages - prefixo do trecho de mensagem do usuário (se isSplitTurn)
  // preparation.previousSummary - resumo da compactação anterior
  // preparation.fileOps - operações de arquivo extraídas
  // preparation.tokensBefore - tokens de contexto antes da compactação
  // preparation.firstKeptEntryId - início das mensagens mantidas
  // preparation.settings - configurações efetivas após aplicar substituições do modelo

  // branchEntries - todas as entradas do ramo atual (para estado personalizado)
  // reason - "manual" (/compact), "threshold" ou "overflow"
  // willRetry - se o turno cancelado será repetido após a compactação (recuperação de excesso)
  // signal - AbortSignal (passe para chamadas LLM)

  // Cancelar:
  return { cancel: true };

  // Resumo personalizado:
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // Opcional; incluído nos totais da sessão
      details: { /* dados personalizados */ },
    }
  };
});
```

#### Converter mensagens em texto

Para gerar um resumo com seu próprio modelo, converta as mensagens em texto usando `serializeConversation`:

```typescript
import { convertToLlm, serializeConversation } from "finecode";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;

  // Converte AgentMessage[] em Message[] e depois serializa como texto
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // Retorna:
  // [User]: texto da mensagem
  // [Assistant]: texto da resposta
  // [Assistant tool calls]: read(path="..."); bash(command="...")
  // [Tool result]: texto da saída

  // Agora envie ao seu modelo para resumir
  const { summary, usage } = await myModel.summarize(conversationText);

  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      usage,
    }
  };
});
```

Consulte [custom-compaction.ts](../../examples/extensions/custom-compaction.ts) para um exemplo completo usando outro modelo.

### session_compact_failed

Disparado quando a compactação manual ou automática falha ou é cancelada. É útil para extensões de telemetria que precisam associar tentativas de `session_before_compact` aos resultados finais.

```typescript
pi.on("session_compact_failed", async (event, ctx) => {
  const { reason, errorMessage, aborted, willRetry, fromExtension } = event;
  // reason - "manual" (/compact), "threshold" ou "overflow"
  // errorMessage - presente em falhas que não sejam cancelamentos
  // aborted - true para compactações canceladas/interrompidas
  // willRetry - se o turno cancelado seria repetido após a compactação
  // fromExtension - se estava sendo usado conteúdo de compactação fornecido por extensão
});
```

### session_before_tree

Disparado antes da navegação por `/tree`. Sempre ocorre, independentemente de o usuário escolher resumir. Pode cancelar a navegação ou fornecer um resumo personalizado.

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - destino da navegação
  // preparation.oldLeafId - posição atual (a abandonar)
  // preparation.commonAncestorId - ancestral comum
  // preparation.entriesToSummarize - entradas que seriam resumidas
  // preparation.userWantsSummary - se o usuário escolheu resumir

  // Cancelar navegação:
  return { cancel: true };

  // Fornecer resumo personalizado (usado apenas se userWantsSummary for true):
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        // usage: summaryResponse.usage, // Opcional; incluído nos totais da sessão
        details: { /* dados personalizados */ },
      }
    };
  }
});
```

Consulte `SessionBeforeTreeEvent` e `TreePreparation` no arquivo de tipos.

## Configurações

Configure a compactação em `~/.pi/agent/settings.json` ou `<project-dir>/.pi/settings.json`:

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| Configuração | Padrão | Descrição |
|---|---|---|
| `enabled` | `true` | Ativa a compactação automática. |
| `reserveTokens` | `16384` | Quantidade de tokens livres de contexto abaixo da qual a compactação automática começa. |
| `keepRecentTokens` | `20000` | Tokens recentes a manter sem resumir. |

Desative a compactação automática com `"enabled": false`. Ainda será possível compactar manualmente com `/compact`.

### Substituições por modelo

Use `compaction.modelOverrides` para ajustar limites de tokens para modelos diferentes:

```json
{
  "compaction": {
    "reserveTokens": 16384,
    "keepRecentTokens": 20000,
    "modelOverrides": {
      "some-provider/big-model": {
        "reserveTokens": 400000
      }
    }
  }
}
```

Para um modelo com janela de contexto de 1 milhão, essa substituição aciona a compactação acima de 600 mil tokens e mantém os 20000 tokens recentes usuais. Outros modelos continuam com a reserva padrão de 16384 tokens.

As chaves são valores exatos e diferenciam maiúsculas de minúsculas no formato `provider/modelId`, incluindo barras que façam parte do ID do modelo. Cada valor `reserveTokens` e `keepRecentTokens` recua de forma independente da substituição do modelo para a configuração comum e, depois, para o padrão integrado. Valores precisam ser inteiros seguros não negativos. Valores inválidos na substituição correspondente geram erro ao serem lidos; somente campos omitidos usam a configuração comum. Entradas de substituição de modelo precisam ser objetos. Configurações comuns inválidas de tokens geram erro ao serem lidas, mesmo quando o modelo ativo tem uma substituição válida. Somente valores comuns omitidos usam os padrões integrados. `enabled` é global, não específico por modelo.

Esses valores resolvidos são usados na compactação manual, em todas as verificações automáticas de limite, na recuperação de excesso e em `preparation.settings` visível a extensões. Trocas de modelo afetam verificações e compactações posteriores sem alterar as configurações comuns. Uma compactação já em andamento usa o modelo e as configurações capturados para aquela operação. As configurações de resumo de ramificações não são afetadas.

As substituições funcionam tanto nas configurações globais quanto nas do projeto. Os arquivos são mesclados recursivamente antes da consulta; portanto, um valor global específico de modelo prevalece sobre uma alternativa geral do projeto. Para alterá-lo, o projeto precisa substituir a entrada daquele modelo. Consulte [Configurações](settings.md#per-model-compaction-overrides) para detalhes.
