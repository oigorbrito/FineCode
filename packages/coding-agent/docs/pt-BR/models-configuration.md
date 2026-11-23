[English](../models-configuration.md) | **Português (Brasil)**

# Configuração de Modelos

Esta referência lista todos os campos aceitos em `models.json`. Consulte [Configurar um endpoint compatível](models.md#configurar-um-endpoint-compatível) para exemplos e [Configuração](configuration.md#diretório-do-agente) para a localização do arquivo.

Adicione `"$schema": "https://pi.dev/schemas/models.schema.json"` ao seu `models.json` para validação e autocompletar no editor.

## Provedores (`providers`)

Cada chave sob `providers` é o identificador de um provedor. Um ID de provedor integrado substitui as configurações desse provedor. Qualquer outro ID adiciona um novo provedor personalizado, exigindo `baseUrl` e uma `api` no nível do provedor ou de cada modelo.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `name` | string |  | Nome de exibição. |
| `baseUrl` | string |  | URL base da API. Também se aplica aos modelos integrados do provedor. |
| `apiKey` | string |  | Chave literal, interpolação de variável de ambiente `"$NOME"`, ou saída de comando `"!comando"`. |
| `api` | string |  | API usada para os modelos do provedor, como `"openai-completions"`, `"openai-responses"`, `"anthropic-messages"`, ou `"google-generative-ai"`. |
| `oauth` | `"radius"` |  | Fluxo de autenticação OAuth. Requer `baseUrl`. |
| `headers` | object |  | Cabeçalhos HTTP adicionais para a requisição. Valores resolvem como `apiKey`. |
| `compat` | [object](#compatibilidade) |  | Substituições de compatibilidade do provedor e modelo. |
| `authHeader` | boolean | `false` | Se deve enviar a chave de API resolvida no cabeçalho `Authorization: Bearer`. |
| `models` | [`object[]`](#modelos) |  | Lista de modelos fornecidos por este provedor. |
| `modelOverrides` | [object](#substituições-de-modelos-modeloverrides) |  | Sobrescritas para modelos existentes. |

## Modelos (`models`)

Cada entrada em `models` adiciona um modelo ao provedor. Uma entrada cujo `id` coincida com um modelo existente o substitui.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `id` | string |  | Obrigatório. ID do modelo enviado à API. |
| `name` | string |  | Nome de exibição, também correspondido por padrões `--model`. |
| `api` | string |  | Substitui a `api` configurada no nível do provedor. |
| `baseUrl` | string |  | Substitui a `baseUrl` configurada no nível do provedor. |
| `reasoning` | boolean | `false` | Se o modelo oferece suporte a pensamento / raciocínio (*thinking*). |
| `thinkingLevelMap` | object |  | Valor do provedor enviado para cada nível de raciocínio. `null` indica nível não suportado. |
| `input` | `("text" \| "image")[]` | `["text"]` | Modalidades de entrada suportadas pelo modelo. |
| `inputLimits` | [object](#limites-de-entrada-inputlimits) |  | Limites de requisição e redimensionamento de imagem. |
| `cost` | object |  | Configurações de custo de tokens. |
| `cost.input` | number |  | Obrigatório. Custo de entrada em USD por milhão de tokens. |
| `cost.output` | number |  | Obrigatório. Custo de saída em USD por milhão de tokens. |
| `cost.cacheRead` | number |  | Obrigatório. Custo de leitura de cache em USD por milhão de tokens. |
| `cost.cacheWrite` | number |  | Obrigatório. Custo de escrita de cache em USD por milhão de tokens. |
| `cost.tiers` | `object[]` |  | Faixas de preço para a requisição inteira. |
| `cost.tiers[].inputTokensAbove` | number |  | Obrigatório. Usa esta faixa quando a entrada exceder esta contagem de tokens. |
| `cost.tiers[].input` | number |  | Obrigatório. Custo de entrada em USD por milhão de tokens na faixa. |
| `cost.tiers[].output` | number |  | Obrigatório. Custo de saída em USD por milhão de tokens na faixa. |
| `cost.tiers[].cacheRead` | number |  | Obrigatório. Custo de leitura de cache em USD por milhão de tokens na faixa. |
| `cost.tiers[].cacheWrite` | number |  | Obrigatório. Custo de escrita de cache em USD por milhão de tokens na faixa. |
| `promptCache` | object |  | Tempo de vida estimado do cache de prompt em segundos para retenção curta e longa. |
| `contextWindow` | number | `128000` | Janela de contexto em tokens. |
| `maxTokens` | number | `16384` | Limite máximo de tokens de saída. |
| `samplingParams` | object |  | Campos mesclados no corpo de cada requisição (APIs compatíveis com OpenAI). |
| `samplingParamsByThinkingLevel` | object |  | `samplingParams` definidos por nível de pensamento. |
| `headers` | object |  | Cabeçalhos de requisição específicos para este modelo. |
| `compat` | [object](#compatibilidade) |  | Sobrescritas de compatibilidade específicas para este modelo. |

## Substituições de modelos (`modelOverrides`)

Cada chave de `modelOverrides` é o identificador de um modelo integrado ou de extensão. IDs desconhecidos são ignorados. Campos do tipo objeto (como `cost`) são mesclados campo a campo; outros valores substituem o original.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `name` | string |  | Nome de exibição, correspondido por padrões `--model`. |
| `reasoning` | boolean |  | Se o modelo suporta raciocínio (*thinking*). |
| `thinkingLevelMap` | object |  | Mapeamento de valor de raciocínio por nível. |
| `input` | `("text" \| "image")[]` |  | Modalidades de entrada. |
| `inputLimits` | [object](#limites-de-entrada-inputlimits) |  | Limites de requisição e imagens. |
| `cost` | object |  | Configurações de custo de tokens. |
| `promptCache` | object |  | Parâmetros de tempo de vida de cache de prompt. |
| `contextWindow` | number |  | Janela de contexto em tokens. |
| `maxTokens` | number |  | Limite máximo de tokens de saída. |
| `samplingParams` | object |  | Parâmetros de amostragem mesclados na requisição. |
| `samplingParamsByThinkingLevel` | object |  | Parâmetros de amostragem por nível de raciocínio. |
| `headers` | object |  | Cabeçalhos adicionais de requisição. |
| `compat` | [object](#compatibilidade) |  | Sobrescritas de compatibilidade. |

## Limites de entrada (`inputLimits`)

Consulte [Descrever entrada e cache de modelo](models.md#descrever-entrada-e-cache-do-modelo).

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `maxRequestBytes` | integer |  | Tamanho máximo da requisição serializada em bytes. |
| `images` | object |  | Configurações de imagem. |
| `images.resize` | object |  | Perfil de redimensionamento seguro aplicado antes de uma imagem entrar no histórico. |
| `images.resize.maxWidth` | integer |  | Largura máxima em pixels. |
| `images.resize.maxHeight` | integer |  | Altura máxima em pixels. |
| `images.resize.maxBytes` | integer |  | Tamanho máximo da imagem codificada em base64 em bytes. |
| `images.resize.jpegQuality` | integer |  | Qualidade de compressão JPEG (1 a 100). |
| `images.maxPerMessage` | integer |  | Número máximo de imagens aceitas por mensagem. |
| `images.maxPerRequest` | integer |  | Número máximo de imagens aceitas na requisição inteira. |

## Compatibilidade (`compat`)

O objeto `compat` descreve diferenças verificadas em relação ao comportamento padrão de requisição e resposta de uma API. Os valores no nível do modelo substituem os valores no nível do provedor. Os campos aplicáveis dependem da `api` utilizada.

### `openai-completions`

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `supportsStore` | boolean |  | Se o provedor suporta o campo `store`. Padrão: auto-detectado pela URL. |
| `supportsDeveloperRole` | boolean |  | Se deve enviar mensagens de sistema de modelos de raciocínio com o papel `developer` em vez de `system`. |
| `supportsReasoningEffort` | boolean |  | Se o provedor suporta `reasoning_effort`. |
| `supportsUsageInStreaming` | boolean | `true` | Se o provedor suporta `stream_options.include_usage` para contagem de tokens em streaming. |
| `supportsFinishReason` | boolean | `true` | Se as respostas em streaming incluem `finish_reason`. |
| `maxTokensField` | `"max_completion_tokens" \| "max_tokens"` |  | Nome do campo para limitar tokens de saída. |
| `requiresToolResultName` | boolean |  | Se os resultados de ferramentas exigem o campo `name`. |
| `requiresAssistantAfterToolResult` | boolean |  | Se uma mensagem de usuário após resultados de ferramenta exige uma mensagem de assistente intermediária. |
| `requiresNonNullAssistantContent` | boolean |  | Se mensagens de assistente sem texto devem enviar `""` em vez de `null`. |
| `requiresToolsWithToolHistory` | boolean |  | Se requisições sem ferramentas devem enviar `"tools": []` quando o histórico contém chamadas de ferramentas. |
| `requiresThinkingAsText` | boolean |  | Se blocos de raciocínio devem ser convertidos em texto delimitado por `<thinking>`. |
| `requiresReasoningContentOnAssistantMessages` | boolean |  | Se mensagens de assistente reexibidas exigem o campo `reasoning_content` mesmo vazio. |
| `thinkingFormat` | string |  | Formato de parâmetros de raciocínio (`"openai"`, `"openrouter"`, `"deepseek"`, `"together"`, `"baseten"`, `"zai"`, `"qwen"`, etc.). |
| `chatTemplateKwargs` | object |  | Argumentos passados como `chat_template_kwargs` quando `thinkingFormat` é `"chat-template"`. |
| `chatTemplateArgs` | object |  | Argumentos passados como `chat_template_args` quando `thinkingFormat` é `"baseten"`. |
| `openRouterRouting` | object |  | Preferências de roteamento de provedor no OpenRouter. |
| `vercelGatewayRouting` | object |  | Preferências de roteamento no Vercel AI Gateway. |
| `zaiToolStream` | boolean | `false` | Se z.ai suporta `tool_stream` para deltas de chamadas de ferramentas em streaming. |
| `thinkingTokenBudgetField` | string |  | Campo de requisição de nível superior para limitar tokens de raciocínio. |
| `supportsStrictMode` | boolean | `false` | Se o provedor suporta o campo `strict` nas definições de ferramentas JSON Schema. |
| `cacheControlFormat` | `"anthropic"` |  | Convenção de controle de cache de prompt. |
| `supportsLongCacheRetention` | boolean |  | Se o provedor suporta retenção longa de cache de prompt. |

### `openai-responses`

Aplica-se também a `azure-openai-responses` e `openai-codex-responses`.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `supportsDeveloperRole` | boolean | `true` | Se o provedor suporta o papel `developer` em vez de `system`. |
| `supportsMidConvoSystemMessages` | boolean | `false` | Se o modelo aceita mensagens de sistema no meio da conversa. |
| `supportsLongCacheRetention` | boolean | `true` | Se o provedor suporta retenção longa de cache (TTL de 30m ou 24h). |
| `supportsStrictMode` | boolean |  | Se suporta ferramentas estritas com validação JSON Schema. |
| `supportsMaxOutputTokens` | boolean | `true` | Se aceita o parâmetro `max_output_tokens`. |

### `anthropic-messages`

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `supportsEagerToolInputStreaming` | boolean | `true` | Se o provedor aceita `eager_input_streaming` por ferramenta. |
| `supportsLongCacheRetention` | boolean | `true` | Se o provedor suporta retenção longa de cache via `cache_control.ttl`. |
| `supportsCacheControlOnTools` | boolean | `true` | Se o provedor suporta marcadores `cache_control` nas definições de ferramentas. |
| `supportsTemperature` | boolean | `true` | Se o modelo aceita o parâmetro `temperature`. |
| `forceAdaptiveThinking` | boolean | `false` | Se força raciocínio adaptativo independentemente do ID do modelo. |
| `supportsStrictTools` | boolean | `false` | Se o provedor suporta esquemas estritos de ferramentas da Anthropic. |
| `supportsMessageThreads` | boolean |  | Se o endpoint suporta tópicos de mensagens da Anthropic. |

### `google-generative-ai`

Aplica-se também a `google-vertex`.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `supportsStrictMode` | boolean |  | Se o modelo aplica ferramentas estritas através do modo de chamada de função `VALIDATED` do Gemini (padrão `true` para Gemini 3+). |
