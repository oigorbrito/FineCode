[English](../virtual-models.md) | **Português (Brasil)**

# Modelos virtuais

Um modelo virtual é um modelo selecionável que escolhe um modelo físico para cada solicitação. Use-o para rotear por tarefa, custo ou estado da conversa. Por exemplo, um roteador pode enviar perguntas simples a um modelo pequeno e problemas difíceis a um modelo maior, enquanto o usuário seleciona um único modelo.

Registre modelos virtuais em uma [extensão](extensions.md). Eles aparecem em `/model`, `--model`, modelos com escopo e configurações como qualquer outro modelo. Um modelo virtual pode ser listado em qualquer provedor, inclusive um que também tenha modelos físicos, como `openai-codex/auto`.

## Seleção e encaminhamento

Um modelo virtual seleciona um modelo e um nível de raciocínio. Para cada solicitação, um roteador mapeia esse par a um par físico:

```
selecionado (modelo virtual, nível virtual)  ->  encaminhado (modelo físico, nível físico)
jev/auto:low                                ->  anthropic/claude-sonnet-4-5:high
```

O nível de raciocínio virtual é uma entrada para o roteador. Seu significado fica a critério do roteador; ele não precisa corresponder a um orçamento de raciocínio.

O FineCode mantém os dois pares separados:

| | Seleção | Encaminhamento |
|---|---|---|
| Registrado em | Entradas `model_change` e `thinking_level_change` | Cada mensagem do assistente: `provider`, `api`, `model`, `thinkingLevel` |
| Visível como | `ctx.model`, `ctx.thinkingLevel`, `PI_MODEL`, `PI_REASONING_LEVEL`, `/model` | Mensagem do assistente em cada resposta |

Provedores recebem somente modelos físicos. As mensagens do assistente identificam o modelo físico, então reproduzir uma conversa entre diferentes modelos físicos funciona da mesma forma que após uma troca manual de modelo. Ao retomar uma sessão, o FineCode restaura a seleção virtual da entrada `model_change` mais recente. Se o modelo virtual não estiver mais registrado, o FineCode volta ao modelo físico que respondeu por último.

No modo interativo, o rodapé mostra o modelo roteado ao lado da seleção, por exemplo, `auto • high → gpt-5.6-luna • medium`. `/session` lista o custo de cada modelo físico.

O uso de contexto considera os limites do modelo físico que produziu a resposta mais recente, mesmo que ela seja anterior à seleção do modelo virtual. Sem uma resposta desse tipo, usa os limites declarados no modelo virtual, se houver. A compactação verifica os mesmos limites e também os limites do modelo escolhido pelo roteador para cada solicitação. Se a janela de contexto desse modelo for pequena demais para a conversa, o FineCode compacta antes de enviar a solicitação; a rota continua sendo a escolhida pelo roteador.

## Registre um modelo virtual

```typescript
import type { ExtensionAPI } from "finecode";

export default function (pi: ExtensionAPI) {
  pi.registerVirtualModel({
    provider: "router",
    id: "auto",
    name: "Auto",
    thinkingLevels: ["low", "high"],
    route(request, ctx) {
      // Tool follow-ups and retries stay on the model that handled the turn.
      const sticky = request.failed ?? request.previous;
      if (request.reason !== "user" && sticky) {
        return { model: sticky.model, thinkingLevel: sticky.thinkingLevel ?? "medium" };
      }
      const id = request.thinkingLevel === "high" ? "claude-sonnet-4-5" : "claude-haiku-4-5";
      return { model: ctx.modelRegistry.find("anthropic", id)!, thinkingLevel: "medium" };
    },
  });
}
```

- `provider` é o provedor em que o modelo é listado. Pode ser qualquer ID de provedor. Um provedor pode listar vários modelos virtuais junto aos físicos. Em um provedor físico, o modelo virtual fica disponível quando há credenciais para esse provedor. Sob um ID que nenhum provedor usa, fica sempre disponível.
- `id` não pode ser o ID de um modelo físico desse provedor. Se uma atualização do catálogo adicionar depois um modelo físico com o mesmo ID, o modelo virtual o oculta.
- `thinkingLevels` lista os níveis oferecidos para seleção. O padrão é `["off"]`.
- `contextWindow` e `maxTokens` são exibidos antes da primeira resposta. Limites não definidos são desconhecidos.
- `input` lista os tipos de entrada oferecidos para seleção. O padrão é texto e imagens; modelos físicos sem suporte a imagens recebem marcadores substitutos.

O registro segue as mesmas regras de enfileiramento e recarga que `pi.registerProvider()`. Registrar novamente o mesmo provedor e ID substitui o modelo virtual. `pi.unregisterVirtualModel(provider, id)` o remove; `pi.unregisterProvider()` não. Código do SDK pode registrar um modelo sem extensão: `modelRuntime.registerVirtualModel(definition)`.

<a id="route-requests"></a>
## Roteie solicitações

`route(request, ctx)` é executado antes de cada solicitação feita com o modelo virtual e retorna `{ model, thinkingLevel }`. O modelo pode ser qualquer modelo físico do catálogo cujo provedor tenha credenciais; procure-o com `ctx.modelRegistry`. Um modelo virtual não pode rotear para outro modelo virtual. O FineCode limita o nível de raciocínio ao que o modelo retornado aceita.

| Campo | Significado |
|---|---|
| `model`, `thinkingLevel` | Modelo virtual e nível selecionados |
| `reason` | Motivo da solicitação, explicado abaixo |
| `previous` | Modelo físico e nível de raciocínio da resposta bem-sucedida mais recente em `messages` |
| `failed` | Em `retry`: modelo físico, nível de raciocínio e mensagem do assistente da solicitação com falha, que não está mais em `messages`. A mensagem contém `stopReason` e `errorMessage`. Ausente quando o próprio roteamento falha |
| `state` | Estado do roteador retornado por último neste ramo da sessão, explicado abaixo |
| `messages` | Conversa desta solicitação, incluindo mensagens de sistema |
| `signal` | Sinal de cancelamento da solicitação |

| `reason` | Solicitação |
|---|---|
| `user` | Primeira solicitação depois de uma mensagem escrita pelo usuário, incluindo mensagens de orientação e acompanhamento |
| `continuation` | Qualquer outra solicitação no ciclo do agente, como após resultados de ferramentas ou mensagens de extensão |
| `retry` | Nova tentativa automática após uma solicitação com falha, inclusive após compactação por excesso de contexto |
| `direct` | Solicitação fora do ciclo do agente, como resumo de compactação ou extensão que chama `ctx.modelRegistry.streamSimple()` |

Retornar `previous` em `continuation` e `failed` em `retry` mantém válidas as caches de prompt e assinaturas de raciocínio. É permitido trocar de modelo entre turnos, mas isso perde a cache de prompt. Uma nova tentativa também pode trocar de modelo, por exemplo, quando `failed.message.errorMessage` informa que o provedor está sobrecarregado ou que houve excesso de contexto.

Se `route()` lançar uma exceção, retornar um modelo virtual ou um modelo sem credenciais, a solicitação termina com uma resposta de erro.

## Mantenha o estado de roteamento

`route()` pode retornar `state` junto ao modelo. O FineCode o armazena no ramo da sessão e o fornece em `request.state` nas solicitações seguintes. Use-o para decisões que a transcrição não registra, como resultados de classificadores ou uma etapa de roteamento:

```typescript
pi.registerVirtualModel<{ phase: "plan" | "build" }>({
  provider: "router",
  id: "phased",
  name: "Phased",
  route(request, ctx) {
    const state = request.state ?? { phase: "plan" };
    const id = state.phase === "plan" ? "claude-opus-4-5" : "claude-haiku-4-5";
    return { model: ctx.modelRegistry.find("anthropic", id)!, thinkingLevel: "medium", state };
  },
});
```

- O estado precisa ser serializável em JSON. Retornar `undefined` ou o próprio `request.state` mantém o estado atual.
- O FineCode armazena qualquer outro objeto retornado como novo estado antes de enviar a solicitação, mesmo quando ele é igual ao estado atual. Retorne um novo objeto somente quando o estado mudar. O estado continua armazenado se a solicitação falhar depois.
- O estado acompanha a árvore da sessão; forks e a navegação por `/tree` usam o estado do próprio ramo. Ele sobrevive à compactação.
- Solicitações `direct` não têm estado, e o FineCode ignora o estado que retornarem.

A transcrição já registra a seleção e cada modelo encaminhado, e `ctx.sessionManager.getBranch()` expõe ambos.

Roteadores podem chamar outros modelos por meio de `ctx.modelRegistry`, por exemplo, `ctx.modelRegistry.classify()` com um modelo classificador de `ctx.modelRegistry.findOfType("classifier", provider, id)`. A chamada acrescenta latência antes do primeiro token do turno.

Consulte [`jev-router.ts`](../../examples/extensions/jev-router.ts) para ver um roteador completo. Ele planeja com um modelo forte do OpenAI Codex escolhido pelo classificador Jev, deixa esse modelo fazer a primeira edição e então troca uma vez para um modelo mais barato, aceitando uma única falta de cache de prompt. A etapa é mantida como estado do roteador.
