[English](../models.md) | **Português (Brasil)**

# Escolha um modelo

Para usar um provedor integrado, comece com `/login` e depois escolha um modelo com `/model`. Configure modelos personalizados somente quando o FineCode ainda não incluir o provedor ou endpoint de que você precisa.

## Escolha uma conexão

| O que você tem | Configuração recomendada |
|---|---|
| Uma assinatura compatível | Entre usando `/login` |
| Uma chave de API de um provedor | Salve-a com `/login` ou defina sua variável de ambiente |
| Um modelo GGUF local | Conecte o FineCode ao roteador llama.cpp |
| Um endpoint compatível com OpenAI, Anthropic ou Google | Adicione-o a `models.json` |
| Um provedor com protocolo ou fluxo de autenticação personalizado | Crie ou instale uma extensão de provedor |

Consulte o [catálogo de modelos do Pi upstream](https://pi.dev/models) para ver provedores, IDs de modelos, recursos, limites de contexto e preços atuais. O FineCode começa com o catálogo incluído no pacote e pode complementá-lo com dados mais recentes desse serviço upstream. Os dados em cache continuam disponíveis offline; execute `finecode update --models` para forçar uma atualização.

## Autentique-se

Execute `/login` e selecione um provedor. O FineCode salva as credenciais em [`auth.json`](configuration.md#agent-directory). Execute `/logout` para remover as credenciais salvas de um provedor.

Você também pode fornecer uma chave de API pela variável de ambiente do provedor. Isso é útil em CI e em outros ambientes nos quais o FineCode não deve gravar credenciais. [Provedores](providers.md) lista as variáveis e as instruções específicas de cada provedor.

Quando há várias fontes de credenciais configuradas, o FineCode usa primeiro a opção `--api-key` em tempo de execução, depois uma credencial salva em `auth.json`, uma `apiKey` de `models.json` e, por fim, as variáveis de ambiente do provedor ou as credenciais de nuvem disponíveis no ambiente. Extensões de provedores podem definir seu próprio comportamento de autenticação.

Mantenha `auth.json` e todos os comandos de credenciais em sigilo. Configurações e extensões do projeto podem ser executadas dentro do processo do FineCode depois que você confia no projeto. Consulte [Segurança](security.md) antes de carregar configurações de um diretório não confiável.

## Selecione um modelo

Execute `/model` para pesquisar os modelos disponíveis. O seletor mostra os modelos cujos provedores têm autenticação utilizável. Pressione `Ctrl+S` em um modelo para salvá-lo como padrão das novas sessões.

Execute `/thinking` para selecionar o nível de raciocínio do modelo atual. Pressione `Ctrl+S` nesse seletor para salvar o nível inicial. O FineCode limita as opções aos níveis compatíveis com o modelo selecionado.

`Ctrl+P` alterna entre os modelos disponíveis. Use `/scoped-models` para controlar essa alternância e salvar a seleção, ou configure padrões de modelos em [Configurações](settings.md#model-cycling).

Uma sessão registra as alterações de modelo e de nível de raciocínio. Ao retomá-la, essas opções são restauradas sem alterar os padrões das novas sessões.

## Conecte modelos locais

O FineCode se integra diretamente ao roteador llama.cpp. O roteador localiza arquivos GGUF e carrega modelos sob demanda. O comando `/llama` do FineCode gerencia o roteador, enquanto `/model` seleciona um dos modelos carregados.

Siga [Modelos locais com llama.cpp](llama-cpp.md) para instruções sobre inicialização do servidor, organização dos modelos, downloads e solução de problemas de conexão.

Para Ollama, LM Studio, vLLM, SGLang e outros servidores compatíveis, [configure um endpoint compatível](#configure-a-compatible-endpoint) em `models.json`.

<a id="configure-a-compatible-endpoint"></a>
## Configure um endpoint compatível

Use [`models.json`](configuration.md#agent-directory) quando um endpoint oferecer uma API já compatível com o FineCode. Isso inclui a maioria das implantações com Ollama, LM Studio, vLLM, SGLang e proxies. O FineCode inclui o [schema de modelos](../../schemas/models.schema.json); o URL `$schema` do exemplo está hospedado pelo Pi upstream e é mantido por compatibilidade.

```json
{
  "$schema": "https://pi.dev/schemas/models.schema.json",
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

A chave fictícia disponibiliza o modelo para o FineCode; o Ollama a ignora. Para um endpoint que exige autenticação, `apiKey` e os valores dos cabeçalhos podem usar interpolação de variáveis de ambiente com `$NAME` ou `${NAME}`, um valor literal ou um comando iniciado por `!`. Os comandos em `models.json` são executados a cada solicitação e não são armazenados em cache pelo FineCode.

Ao abrir `/model`, o arquivo é recarregado. Uma entrada em `models` adiciona ou substitui um modelo com o mesmo ID naquele provedor. Use `modelOverrides` para alterar metadados de um modelo integrado ou fornecido por uma extensão sem substituir a lista de modelos do provedor. IDs desconhecidos em `modelOverrides` são ignorados.

### Descreva a entrada de modelos e o cache

Use `inputLimits.images.resize` para controlar como o FineCode codifica novos anexos de imagem, resultados de `read` e imagens resultantes de ferramentas antes de armazená-los no histórico da conversa:

```json
{
  "id": "vision-model",
  "input": ["text", "image"],
  "inputLimits": {
    "images": {
      "resize": {
        "maxWidth": 1568,
        "maxHeight": 1568,
        "maxBytes": 524288,
        "jpegQuality": 75
      }
    }
  }
}
```

`maxBytes` limita o payload codificado em base64. Os campos de redimensionamento omitidos usam padrões conservadores de 2000 por 2000 pixels, 4,5 MiB codificados e qualidade JPEG 80. As imagens são codificadas uma única vez; trocar de modelo não reescreve imagens históricas. O catálogo também pode descrever limites rígidos de solicitação com `inputLimits.maxRequestBytes`, `images.maxPerMessage` e `images.maxPerRequest`, mas o FineCode ainda não reescreve nem rejeita o histórico com base nesses limites.

<a id="prompt-cache-lifetimes"></a>

Use `promptCache` para declarar, em segundos, o tempo de vida de cache que o provedor oferece como melhor esforço para os níveis de retenção `short` ou `long`:

```json
{ "id": "claude-sonnet-5", "promptCache": { "short": 300, "long": 3600 } }
```

Escolha o limite mais conservador de qualquer intervalo publicado. Um modelo sem tempo de vida definido para o nível ativo não pode participar do aquecimento de cache. Uma entrada em `modelOverrides` pode definir `inputLimits` ou `promptCache` para um modelo integrado ou de extensão, inclusive um acessado por meio de um proxy validado. Consulte [`cacheWarming`](settings.md#model-and-thinking).

### Configure parâmetros de amostragem por nível de raciocínio

APIs compatíveis com OpenAI aceitam padrões livres de modelo em `samplingParams` e substituições em `samplingParamsByThinkingLevel`. Esta última usa as chaves de nível de raciocínio do FineCode (`off`, `minimal`, `low`, `medium`, `high`, `xhigh` e `max`), não os valores do provedor definidos em `thinkingLevelMap`:

```json
{
  "id": "qwen-thinking-model",
  "reasoning": true,
  "samplingParams": {
    "temperature": 1.0,
    "top_p": 0.95
  },
  "samplingParamsByThinkingLevel": {
    "off": {
      "temperature": 0.7,
      "top_p": 0.8
    },
    "high": {
      "top_k": 20
    }
  }
}
```

Primeiro, o FineCode limita níveis de raciocínio não compatíveis; depois, mescla `samplingParams` do modelo, a substituição do nível efetivo e `samplingParams` da solicitação, nessa ordem. Em cada chave, prevalece o valor aplicado por último. Níveis não definidos herdam os padrões do modelo. `modelOverrides` mescla cada chave das entradas por nível com o modelo base. Esses campos se aplicam somente a `openai-completions`, `openai-responses` e `azure-openai-responses`; outras APIs os ignoram.

As configurações de compatibilidade devem descrever diferenças verificadas no comportamento de solicitação ou resposta do endpoint. Não as habilite apenas porque um endpoint declara ser compatível com OpenAI ou Anthropic.

<a id="use-classifier-models"></a>
## Use modelos classificadores

Modelos classificadores não conversam. Eles respondem a perguntas tipadas sobre estados JSON: escolhem uma entre várias opções, respondem sim ou não ou fornecem uma pontuação, cada uma com probabilidades. O FineCode inclui o modelo Jev da TypeSafe nesses provedores, os modelos Clef e Clef Flash da Cloudflare Workers AI e o GPT-6 Luna da OpenAI pela [API Decisions](https://developers.openai.com/api/docs/guides/decisions):

| Provedor | IDs de modelos | Autenticação |
|---|---|---|
| `typesafe` | `jev-latest` | `TYPESAFE_API_KEY` |
| `openrouter` | `typesafe/jev-1.13`, `~typesafe/jev-latest` | `OPENROUTER_API_KEY` ou `/login` |
| `cloudflare-workers-ai` | `typesafe/jev`, `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash` | `CLOUDFLARE_API_KEY` e `CLOUDFLARE_ACCOUNT_ID` |
| `vercel-ai-gateway` | `typesafe-ai/jev` | `AI_GATEWAY_API_KEY` |
| `opencode` | `jev-1.13`, `jev-1.13-free` | `OPENCODE_API_KEY` |
| `openai` | `gpt-6-luna` | `OPENAI_API_KEY` |

Modelos de chat em um roteador [llama.cpp](llama-cpp.md#classification) também aparecem como modelos classificadores.

A API Decisions da OpenAI exige uma chave de API. Credenciais de login do ChatGPT não funcionam nela. Por isso, `gpt-6-luna` não aparece como disponível quando `openai` está autenticado pelo `/login`, mesmo que `OPENAI_API_KEY` esteja definida; encerre a sessão de `openai` para usar a chave. O GPT-6 Luna também avalia imagens passadas em `images` (consulte [Codemode](../codemode.md#classify)); outros modelos classificadores retornam um erro para elas. A API rejeita entradas acima de 922 mil tokens, mas solicitações que levam mais de cerca de cinco segundos — atualmente, acima de aproximadamente 600 mil tokens de entrada — falham com timeout no gateway.

Modelos classificadores não aparecem em `/model`. O acesso é feito pela ferramenta [`codemode`](cli.md#enable-codemode), desativada por padrão, a menos que um servidor MCP a habilite. Ative-a com `"defaultTools": ["+codemode"]` em [configurações](settings.md#tools). Os scripts listam então os modelos classificadores com `models.getAvailableOfType("classifier")` e os chamam com `models.classify(model, { state, questions })`:

```js
const jev = await models.getModelOfType("classifier", "typesafe", "jev-latest");
const result = await models.classify(jev, {
  state: { message: "The change works, thanks." },
  questions: {
    approved: {
      type: "bool",
      instructions: "Does the user approve of the result?",
      criteria: { true: "Approval", false: "No approval" },
    },
  },
});
return result.answers;
```

[Codemode](../codemode.md#classify) descreve os tipos de perguntas e respostas.

Quando o serviço informa contagens de tokens, como fazem todos os serviços System One, `result.usage` inclui essas contagens e o custo. O FineCode adiciona ao resultado da ferramenta `codemode` o uso das chamadas classificadoras feitas pelo script, contabilizando-o no custo da sessão mostrado no rodapé e em `/session`. O custo usa o preço do modelo no catálogo; modelos sem preço, como o `jev-latest` direto da TypeSafe, exibem os tokens sem custo.

Extensões chamam classificadores por meio de `ctx.modelRegistry.classify()`, sem codemode. [Modelos virtuais](virtual-models.md#route-requests) podem usá-los para rotear solicitações; consulte o exemplo `jev-router.ts`.

<a id="use-image-models"></a>
## Use modelos de imagem

Modelos de imagem geram imagens a partir de um prompt e de imagens de entrada opcionais. O FineCode lista os modelos de imagem do OpenRouter, como `google/gemini-2.5-flash-image` e `black-forest-labs/flux.2-pro`, no provedor `openrouter`; eles usam as mesmas credenciais `OPENROUTER_API_KEY` ou `/login` dos modelos de chat desse provedor.

Assim como os modelos classificadores, os modelos de imagem não aparecem em `/model`; o acesso é feito pela ferramenta [`codemode`](cli.md#enable-codemode). Os scripts os listam com `models.getAvailableOfType("image")` e os chamam com `models.generateImages(model, { input })`. O campo `output` do resultado contém blocos de imagem em base64, que `image()` anexa ao resultado de `codemode` para que o modelo possa vê-los:

```js
const painter = await models.getModelOfType("image", "openrouter", "google/gemini-2.5-flash-image");
const result = await models.generateImages(painter, {
  input: [{ type: "text", text: "A red fox in the snow, watercolor" }],
});
if (result.stopReason !== "stop") return result.errorMessage;
for (const block of result.output) if (block.type === "image") image(block);
```

`input` também pode conter blocos `{ type: "image", data, mimeType }` para editar imagens ou usá-las como referência. O FineCode adiciona ao resultado da ferramenta `codemode` o uso das chamadas de geração de imagens feitas pelo script, assim como faz com as chamadas classificadoras. As imagens geradas não são salvas em disco. [Codemode](../codemode.md#generate-images) descreve a API completa.

Extensões geram imagens com `ctx.modelRegistry.generateImages()`, sem codemode.

## Adicione um provedor personalizado

Use uma extensão quando o provedor exigir comportamento personalizado de streaming, descoberta de modelos ou autenticação. Consulte [Provedores personalizados](custom-provider.md) para conhecer o fluxo de trabalho com extensões.

## Solução de problemas

### Um modelo não aparece

Confirme se o provedor tem autenticação utilizável. Modelos personalizados podem ser carregados de `models.json`, mas continuam indisponíveis em `/model` até que o FineCode consiga resolver as credenciais. No caso do llama.cpp, aparecem somente os modelos carregados no momento pelo roteador.

### A autenticação funciona somente em um shell

Verifique se a chave veio de uma variável de ambiente, e não de `auth.json`. As variáveis de ambiente precisam estar disponíveis no processo que inicia o FineCode.

### O login abre um navegador em uma máquina remota

Quando disponível, conclua o fluxo de autenticação sem interface gráfica do provedor. Alguns provedores permitem colar no FineCode a URL de redirecionamento final ou o código de autorização. Consulte [Autentique-se interativamente](providers.md#authenticate-interactively).

### Um endpoint compatível rejeita solicitações

Verifique o tipo de API e as configurações de compatibilidade em `models.json`. O servidor upstream precisa aceitar os campos e comportamentos de solicitação correspondentes.
