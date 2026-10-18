[English](../codemode.md) | **Português (Brasil)**

# Codemode

A ferramenta `codemode` permite que o modelo escreva um script JavaScript que chama outras ferramentas do FineCode e executa modelos que não são LLMs, como classificadores e modelos de imagem. Somente a saída do script chega ao modelo; assim, um script pode executar chamadas em paralelo e filtrar resultados grandes antes de apresentá-los ao modelo. Para ativar o recurso, consulte [Ativar codemode](cli.md#enable-codemode).

## Scripts

A entrada da ferramenta é código-fonte JavaScript bruto, não JSON nem um bloco de código Markdown. Ela é executada como o corpo de uma função assíncrona em um sandbox QuickJS; portanto, `await` e `return` no nível superior funcionam. O sandbox não tem APIs do Node, sistema de arquivos, rede nem temporizadores; os scripts só acessam o mundo externo por meio de ferramentas e de `models`.

Um script pode começar com uma linha de opções. Ela precisa ser a primeira linha; se aparecer em outro lugar, a chamada falha antes da execução do script:

```js
// @options: {"max_output_tokens": 2000, "timeout_ms": 60000}
```

- `max_output_tokens` (padrão 10000) limita a saída. Se ela for maior, o início e o fim são mantidos, e o texto completo é gravado em um arquivo temporário cujo caminho aparece no resultado. O script falha se a saída ultrapassar 16777216 caracteres de texto e dados de imagem base64 ou 100000 chamadas a `text()`, `image()` e `console`; use uma ferramenta para gravar dados grandes em arquivo.
- `timeout_ms` define um prazo rígido para todo o script. Por padrão, não há prazo. A geração de imagens pode levar minutos; não defina um prazo curto para scripts que gerem imagens.

O resultado começa com `Script completed` ou `Script failed`, o tempo de execução e a saída. Itens de texto e imagem aparecem em ordem, cada um em sua própria linha. Quando houver mais de um item de texto (de `text()` ou `return`), cada um começa com uma linha `==> text N/M <==`. Chamadas a `console` aparecem depois, em um bloco `<console_output>`, com uma linha por chamada. Um script com falha mantém a saída parcial, seguida por `Script error:` e o erro. Chamadas de ferramentas são reais: as chamadas feitas antes de uma falha não são desfeitas. Chamadas ainda em execução quando o script termina são canceladas, e promessas não aguardadas são descartadas.

<a id="globals"></a>
## Globais

| Global | Finalidade |
|---|---|
| `tools.<name>(args)` | Chama uma ferramenta. Consulte [Chamar ferramentas](#call-tools). |
| `text(value)` | Adiciona um item de texto à saída. Strings são adicionadas como estão; outros valores são adicionados como JSON. |
| `image(value)` | Adiciona uma imagem à saída: uma URL `data:` em base64, um objeto `{ image_url }` ou um bloco `{ type: "image", data, mimeType }`, como os retornados por ferramentas MCP e `models.generateImages()`. URLs remotas não são aceitas. São aceitos PNG, JPEG, GIF e WebP. Cada imagem também é salva em um arquivo temporário, cujo caminho aparece antes da imagem no resultado. |
| `console.log(...)` | Adiciona uma linha ao bloco `<console_output>` depois dos demais itens. Os argumentos são unidos por espaços; `info`, `warn`, `error` e `debug` fazem o mesmo. |
| `return value` | Um `return` no nível superior adiciona o valor como `text()`. |
| `exit()` | Encerra o script com sucesso. |
| `store(key, value)` / `load(key)` | Mantêm pequenos valores JSON entre chamadas de `codemode`. Consulte [Armazenar valores](#store-values). |
| `ALL_TOOLS` | Todas as ferramentas chamáveis como `{ name, description }`, incluindo ferramentas não listadas na descrição. |
| `searchTools(query, { limit?, namespace? })` | Classifica ferramentas chamáveis por relevância (BM25, limite padrão 8). Retorna `{ name, description }[]`. |
| `describeTool(name)` | Retorna a descrição e declaração TypeScript da ferramenta, ou `undefined`. |
| `describeNamespace(name)` | Retorna `{ name, description?, instructions?, tools }` para um namespace, como um servidor MCP, ou `undefined`. |
| `models` | Lista e executa modelos que não são LLMs. Consulte [Modelos](#models). |

<a id="call-tools"></a>
## Chamar ferramentas

Cada ferramenta que a sessão pode chamar é um método de `tools`, nomeado pelo identificador: caracteres inválidos em um identificador JavaScript são substituídos por `_`, então a ferramenta MCP `mcp__dev-radius__search` fica disponível como `tools.mcp__dev_radius__search`. Cada método recebe um objeto com seus argumentos.

O valor resolvido depende da ferramenta:

- Ferramentas com esquema de saída resolvem para um valor estruturado. `bash` resolve para `{ output, truncated, full_output_path?, exit_code, wall_time_seconds }`, inclusive com códigos de saída diferentes de zero. O campo `output` pode conter até 1 MiB, não se limitando às 2000 linhas ou 50 KB exibidos ao modelo. Para saídas maiores, mantém os primeiros e os últimos 512 KiB ao redor de um marcador de omissão, define `truncated` e grava a saída completa em `full_output_path`.
- Ferramentas MCP resolvem para seu `CallToolResult`, incluindo `isError` e `structuredContent`.
- `read` resolve para o texto do arquivo ou, no caso de uma imagem, para um bloco `{ type: "image", data, mimeType, note }` exibido por `image()`. `data` é a imagem em base64 que o modelo veria; `note` contém informações associadas, como instruções de redimensionamento.
- Outras ferramentas, como `edit` e `write`, resolvem para seu texto de saída.

Uma chamada que falhe, seja bloqueada ou receba argumentos inválidos rejeita com um `Error` que contém o texto do erro da ferramenta. Use `Promise.allSettled()` para manter os resultados das chamadas bem-sucedidas.

A descrição de `codemode` lista ferramentas com suas declarações TypeScript, agrupadas por namespace (por exemplo, um servidor MCP). Ferramentas com exposição `deferred`, incluindo ferramentas MCP com exposição `codemode` padrão, não são listadas; assim, a descrição permanece igual enquanto servidores MCP se conectam. As declarações listadas compartilham um orçamento de 3000 tokens estimados (`codemode.inlineBudget` em [configurações](settings.md#tools)). Os scripts descobrem outras ferramentas com `searchTools()`, `describeTool()`, `describeNamespace()` ou filtrando `ALL_TOOLS`.

Enquanto `codemode` estiver ativo, `codemode.mode` em [configurações](settings.md#tools) determina como as outras ferramentas são apresentadas. Com `on` (padrão), ferramentas declaradas continuam declaradas, e suas descrições explicam como chamá-las nos scripts. Com `only`, elas ficam ocultas para o modelo e aparecem na descrição de `codemode`, para que o modelo as chame pelos scripts. As declarações na descrição de `codemode`, em `describeTool()` e em `ALL_TOOLS` incluem as orientações de prompt das ferramentas, pois as regras do prompt de sistema abrangem somente ferramentas declaradas.

<a id="store-values"></a>
## Armazenar valores

`store(key, value)` mantém um valor JSON sob uma chave string para chamadas futuras de `codemode`; armazenar `undefined` apaga a chave. `load(key)` retorna o valor ou `undefined`. Os dados só são mantidos se o script tiver sucesso: cada script bem-sucedido que armazena valores acrescenta uma entrada personalizada `codemode-store` à sessão. Assim, sessões retomadas preservam os valores e cada ramo vê somente os valores gravados no seu próprio caminho.

O armazenamento serve para estados pequenos, como IDs, cursores ou resumos. Cada valor pode ter no máximo 262144 caracteres em JSON, e o total pode ter no máximo 1048576. Não armazene dados de imagem; exiba imagens com `image()`, que também as salva em um arquivo temporário.

<a id="models"></a>
## Modelos

`models` acessa o catálogo e executa modelos que não são LLMs usando as credenciais da sessão: classificadores, que respondem a perguntas tipadas sobre estado JSON e, em alguns casos, imagens; e modelos de imagem, que geram imagens. Modelos de chat aparecem na lista, mas não podem ser executados por scripts. Consulte [Usar modelos classificadores](models.md#use-classifier-models) e [Usar modelos de imagem](models.md#use-image-models) para saber quais classificadores e modelos de imagem estão disponíveis.

```ts
type ModelType = "chat" | "image" | "classifier";

/** Uma entrada do catálogo. `provider` e `id` a identificam; os demais campos dependem do tipo. */
interface ModelInfo {
  type?: ModelType;
  provider: string;
  id: string;
  name: string;
  api: string;
  input: ("text" | "image")[];
  contextWindow?: number;
  [key: string]: unknown;
}

declare const models: {
  /** Todos os modelos conhecidos de um tipo, opcionalmente de um provedor. */
  getModelsOfType(type: ModelType, provider?: string): Promise<ModelInfo[]>;
  /** Modelos de um tipo cujo provedor tem credenciais funcionais. */
  getAvailableOfType(type: ModelType, provider?: string): Promise<ModelInfo[]>;
  /** Uma entrada do catálogo, ou undefined. */
  getModelOfType(type: ModelType, provider: string, id: string): Promise<ModelInfo | undefined>;
  /** Responde às perguntas de `context.questions` sobre `context.state`; respostas em `result.answers`, por ID de pergunta. */
  classify(model: ModelInfo, context: ClassifierContext): Promise<ClassifierResult>;
  /** Gera imagens a partir do texto e dos blocos de imagem de `context.input`; exiba `result.output` com image(). Pode levar minutos. */
  generateImages(model: ModelInfo, context: ImagesContext): Promise<ImagesResult>;
};
```

`classify()` e `generateImages()` usam somente `provider` e `id` de `model`; portanto, `{ provider, id }` também funciona. Elas não lançam exceções para erros do provedor: verifique `stopReason` e `errorMessage`. No máximo quatro dessas chamadas são executadas simultaneamente por script; as demais aguardam uma vaga, então é seguro usar `Promise.all()` com muitos itens. O uso é acrescentado ao resultado da ferramenta `codemode` e contabilizado no custo da sessão. IDs de modelo variam entre provedores, por exemplo, `typesafe/jev-latest` e `openrouter/typesafe/jev-1.13`. Use `models.getAvailableOfType(type)` para encontrar IDs compatíveis com as credenciais atuais.

<a id="classify"></a>
### Classificar

```ts
interface ClassifierContext {
  /** Os dados a classificar. */
  state: Record<string, unknown>;
  /** Imagens avaliadas junto com `state`. Somente modelos cujo `input` inclua "image" as aceitam. */
  images?: { type: "image"; data: string; mimeType: string }[];
  /** Perguntas identificadas por ID. Uma chamada responde a todas. */
  questions: Record<string, ClassifierQuestion>;
}

type ClassifierQuestion =
  /** Escolhe um rótulo. `criteria` associa cada rótulo ao seu significado. */
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  /** Pontuação em uma escala ordenada. `criteria` descreve os níveis, do menor para o maior. */
  | { type: "score"; instructions: string; criteria: string[] }
  /** Sim ou não. */
  | { type: "bool"; instructions: string; criteria: { true: string; false: string } };

interface ClassifierResult {
  provider: string;
  model: string;
  /** Respostas por ID de pergunta. */
  answers: Record<string, ClassifierAnswer>;
  usage?: ModelUsage;
  stopReason: "stop" | "error" | "aborted";
  errorMessage?: string;
}

type ClassifierAnswer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  /** `score` é o índice esperado do nível, entre 0 e `criteria.length - 1`. */
  | { type: "score"; score: number; confidence: number }
  /** Probabilidade de `true`. */
  | { type: "bool"; probability: number };

/** Contagem de tokens e custo em USD, quando informados pelo serviço. */
type ModelUsage = { input: number; output: number; totalTokens: number; cost: { total: number } };
```

Classifique vários itens chamando `classify()` uma vez para cada item. Este script organiza mensagens de feedback, por exemplo, mensagens retornadas anteriormente por uma ferramenta no mesmo script:

```js
const jev = await models.getModelOfType("classifier", "typesafe", "jev-latest");
const results = await Promise.all(
  messages.map((message) =>
    models.classify(jev, {
      state: { message },
      questions: {
        sentiment: {
          type: "choice",
          instructions: "How does the user feel about the product?",
          criteria: { positive: "Satisfied or happy", negative: "Unhappy or frustrated", neutral: "Neither" },
        },
        urgency: {
          type: "score",
          instructions: "How urgently does this need a reply?",
          criteria: ["no reply needed", "reply this week", "reply today"],
        },
      },
    }),
  ),
);
return results.map((result, i) =>
  result.stopReason === "stop"
    ? { message: messages[i], sentiment: result.answers.sentiment.choice, urgency: result.answers.urgency.score }
    : { message: messages[i], error: result.errorMessage },
);
```

Classificadores cujo `input` inclui `"image"` também avaliam imagens. `tools.read()` retorna arquivos de imagem como blocos que podem ser passados em `images`. Outros classificadores retornam um resultado de erro se `images` não estiver vazio.

```js
const luna = await models.getModelOfType("classifier", "openai", "gpt-6-luna");
const photo = await tools.read({ path: "screenshot.png" });
const result = await models.classify(luna, {
  state: { task: "Settings page redesign" },
  images: [photo],
  questions: {
    broken: {
      type: "bool",
      instructions: "Does the screenshot show a broken layout?",
      criteria: { true: "Overlapping, cut-off, or misaligned elements", false: "Clean layout" },
    },
  },
});
```

<a id="generate-images"></a>
### Gerar imagens

```ts
interface ImagesContext {
  /** O prompt como blocos de texto, além de blocos de imagem para editar ou usar como referência. */
  input: (TextBlock | ImageBlock)[];
}

interface ImagesResult {
  provider: string;
  model: string;
  /** Imagens geradas e blocos de texto para modelos que também retornam texto. */
  output: (TextBlock | ImageBlock)[];
  usage?: ModelUsage;
  stopReason: "stop" | "error" | "aborted";
  errorMessage?: string;
}

type TextBlock = { type: "text"; text: string };
/** `data` está em base64. */
type ImageBlock = { type: "image"; data: string; mimeType: string };
```

Exiba imagens geradas com `image(block)`. Não imprima `data` com `text()`, `console` ou `return`: é grande, e o modelo não consegue interpretá-lo como texto. `image()` também salva cada imagem em um arquivo temporário e inclui o caminho no resultado, para que uma etapa posterior possa copiar ou mover o arquivo.

```js
// @options: {"timeout_ms": 300000}
const painter = await models.getModelOfType("image", "openrouter", "google/gemini-2.5-flash-image");
const result = await models.generateImages(painter, {
  input: [{ type: "text", text: "A red fox in the snow, watercolor" }],
});
if (result.stopReason !== "stop") return result.errorMessage;
for (const block of result.output) {
  if (block.type === "image") image(block);
  else text(block.text);
}
```

<a id="limits"></a>
## Limites

- A VM de um script tem 256 MB de memória. Esgotar a memória lança `InternalError: out of memory`; filtre ou agregue dados grandes em vez de acumulá-los.
- No Bun, interromper um script ou atingir o prazo encerra a chamada prontamente, mas uma função integrada que não verifica o handler de interrupção do QuickJS pode continuar calculando em sua worker até retornar.
- No máximo dois workers de codemode podem estar ativos em todas as sessões de um processo FineCode. Um worker cancelado ocupa sua vaga até terminar. Ao atingir o limite, novos scripts falham imediatamente sem iniciar outro worker; tente novamente quando um worker existente terminar.
- Um script que aguarde uma promessa que nunca pode ser resolvida (sem chamada de ferramenta pendente) falha imediatamente, pois não há temporizadores.
- Scripts não podem iniciar outros scripts `codemode`.
