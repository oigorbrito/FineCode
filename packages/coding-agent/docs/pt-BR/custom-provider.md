[English](../custom-provider.md) | **Português (Brasil)**

# Provedores personalizados

Uma extensão de provedor conecta o FineCode a um serviço de modelos que exige autenticação, descoberta de modelos, tratamento de solicitações ou streaming personalizados. Se o serviço já oferecer uma API compatível, configure-o em `models.json`.

Extensões de provedores são executadas dentro do FineCode e podem inspecionar credenciais, prompts, definições de ferramentas, respostas de modelos e dados de uso. Trate-as como código confiável e evite registrar segredos ou payloads do provedor em logs.

## Escolha a integração mais simples

| Requisito | Use |
|---|---|
| Adicionar modelos por trás de uma API compatível | [`models.json`](models.md#configure-a-compatible-endpoint) |
| Alterar o endpoint ou os cabeçalhos de um provedor existente | `models.json` ou uma extensão de provedor pequena |
| Descobrir modelos dinamicamente | Um provedor com `refreshModels` |
| Adicionar um fluxo `/login` | Um provedor com configuração OAuth nativa ou legada |
| Implementar um protocolo de comunicação não compatível | Um provedor com `stream` ou `streamSimple` |

Uma extensão de provedor é uma [extensão](extensions.md) e, portanto, segue o mesmo comportamento de carregamento, confiança, recarga e erros.

## Registre um provedor

Chame `pi.registerProvider()` na fábrica da extensão. O FineCode aguarda a conclusão das fábricas assíncronas antes de prosseguir com a inicialização; assim, os provedores registrados ficam disponíveis para a seleção inicial de modelo e para `finecode --list-models`.

Há duas formas de registro:

- Registrar um `Provider` completo de `@earendil-works/pi-ai` para obter autenticação, filtragem, descoberta, atualização e streaming nativos.
- Registrar um nome de provedor com `ProviderConfig` para usar o formato de configuração legado empregado por extensões existentes.

Em novas integrações que controlam mais do que metadados estáticos de endpoint e modelo, prefira um provedor completo. O FineCode aplica as substituições de `models.json` sobre um provedor nativo registrado.

Registrar somente `baseUrl` ou `headers` para um provedor existente mantém seus modelos integrados. Fornecer `models` no formato legado substitui os modelos desse provedor para operações de chat, imagem e classificação. Quando `type` é omitido, seu valor é `"chat"`; modelos de imagem e classificação exigem discriminantes explícitos e implementações associadas aos valores de `api` por meio dos campos `images` e `classifiers`.

Por exemplo, um provedor com vários tipos de operação pode registrar modelos que não são de chat e suas implementações juntos:

```typescript
pi.registerProvider("media-tools", {
  apiKey: "$MEDIA_TOOLS_API_KEY",
  models: [
    {
      type: "image",
      id: "image-v1",
      name: "Image V1",
      api: "media-images",
      baseUrl: "https://media.example.com/v1",
      input: ["text"],
      output: ["image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
    {
      type: "classifier",
      id: "classifier-v1",
      name: "Classifier V1",
      api: "media-classifier",
      baseUrl: "https://media.example.com/v1",
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 64000,
    },
  ],
  images: {
    "media-images": { generateImages: async (model, context, options) => result },
  },
  classifiers: {
    "media-classifier": { classify: async (model, context, options) => result },
  },
});
```

Valores de `baseUrl` definidos no modelo têm prioridade sobre o endpoint do provedor. Se a lista `models` não for fornecida, os modelos integrados de todos os tipos de operação continuam registrados. IDs iguais em operações diferentes continuam sendo distintos, inclusive seus cabeçalhos específicos de modelo.

Chamadas feitas depois do carregamento inicial das extensões têm efeito imediato. Use `pi.unregisterProvider()` para remover o provedor dinâmico e restaurar o comportamento integrado que ele substituiu.

Consulte o [provedor GitLab Duo](../../examples/extensions/custom-provider-gitlab-duo/) validado para ver um registro completo que delega o streaming às implementações de API integradas.

## Forneça autenticação

Provedores estáticos podem resolver uma chave de API a partir de um valor literal, interpolação de variável de ambiente ou comando. Esses valores usam a mesma sintaxe de `models.json`:

- `$NAME` e `${NAME}` leem variáveis de ambiente.
- Um comando iniciado por `!command` usa a saída do comando.
- `$$` produz um `$` literal.
- `$!` produz um `!` literal no início do valor.

Use autenticação nativa do provedor quando a integração precisar de credenciais armazenadas, resolução personalizada, ambiente específico do provedor ou vários métodos de login.

Um provedor OAuth fornece um nome de exibição, fluxo de login, atualização de tokens e resolução de token de acesso. Depois de registrado, ele aparece em `/login`, e o FineCode salva as credenciais retornadas em `~/.pi/agent/auth.json`.

Os callbacks OAuth não dependem da interface. Eles podem abrir um URL de autorização, exibir um código de dispositivo, informar o progresso, solicitar dados ou pedir ao usuário que escolha um método de login. Respeite o cancelamento e o sinal de aborto fornecido durante solicitações de rede.

Nunca grave tokens de acesso, tokens de atualização, cabeçalhos de autorização ou respostas completas do provedor em logs comuns.

## Forneça e atualize modelos

Todo modelo precisa de um ID, nome de exibição, recursos de entrada e metadados de custo. Modelos de chat e de classificação também precisam de uma janela de contexto; modelos de chat precisam de um limite de saída e indicação de suporte a raciocínio; modelos de imagem declaram suas modalidades de saída. Escolha a implementação de API no nível do provedor, a menos que um modelo exija uma substituição.

Defina `promptCache.short` ou `promptCache.long` com o tempo de vida de cache, em segundos, que o provedor oferece como melhor esforço, caso o FineCode deva manter aquecido um cache de prompt ocioso. Deixe esses campos sem definição para desativar o aquecimento de cache nesse nível de retenção.

Sinalizadores de compatibilidade descrevem diferenças verificadas em uma API que, de resto, é compatível. Não os habilite apenas porque um endpoint declara compatibilidade.

Confirme os campos das solicitações e o comportamento das respostas com o servidor real.

Use `refreshModels` quando o catálogo disponível vier de um serviço ativo. Passe `context.signal` para operações de E/S bloqueantes para permitir que os chamadores cancelem as atualizações.

As duas formas de registro têm contratos de atualização diferentes:

- Um `Provider` completo não retorna dados. Ele chama `context.publish({ update })` para instalar o estado dos modelos do provedor; depois disso, seu `getModels()` síncrono expõe a lista mais recente.
- `ProviderConfig.refreshModels` no formato legado retorna definições de modelos de vários tipos de operação. O FineCode substitui os modelos ativos desse registro pela lista retornada e aplica a persistência solicitada.

Persista dados do catálogo somente quando eles precisarem permanecer disponíveis entre execuções. Um serviço ativo, como o llama.cpp, pode atualizar sua lista em memória sem persistência; um catálogo remoto pode manter um snapshot para inicializações offline.

## Reutilize uma API de streaming compatível

Sempre que o protocolo do provedor corresponder a uma implementação existente, use uma das APIs de IA do FineCode.

As implementações compatíveis abrangem Anthropic Messages, OpenAI Chat Completions e Responses, Google Generative AI e Vertex, Azure OpenAI Responses, Mistral Conversations e Bedrock Converse.

O provedor ainda pode personalizar autenticação, URLs base, cabeçalhos, filtragem e descoberta de modelos, delegando a conversão de solicitações e o streaming a uma implementação de API existente.

Isso é mais seguro do que copiar uma implementação de streaming porque preserva a conversão de mensagens, o tratamento de ferramentas, a contabilização de uso, o cancelamento e o comportamento de compatibilidade do FineCode.

## Implemente streaming personalizado

Implemente `streamSimple` somente quando nenhuma implementação de API existente puder representar o serviço. Como referência, estude primeiro as implementações do Pi upstream em [`packages/ai/src/api`](https://github.com/earendil-works/pi/tree/main/packages/ai/src/api).

O stream recebe um `TranscriptContext` normalizado. Os prompts de sistema e as declarações de ferramentas ficam nas mensagens de sistema da transcrição; leia-os com `getCurrentSystemPrompt(context.messages)` e `getCurrentTools(context.messages)`, em vez de esperar `context.systemPrompt` ou `context.tools`. Um modelo que aceite mensagens de sistema no meio da conversa pode recebê-las nessa posição; caso contrário, chame `collapseSystemMessages(context)` para incorporá-las à mensagem inicial.

Um stream personalizado deve:

1. Criar uma mensagem do assistente com provedor, modelo, horário, motivo de parada pendente, conteúdo e uso zerado.
2. Depois que a configuração da solicitação for concluída, emitir um evento `start` antes dos eventos de conteúdo.
3. Atualizar a mensagem enquanto emite eventos equilibrados de texto, raciocínio e chamadas de ferramentas.
4. Finalizar o uso, o custo, o conteúdo e o motivo de parada.
5. Emitir exatamente um evento terminal `done` ou `error` e fechar o stream.
6. Converter cancelamentos em um resultado abortado.

A configuração da solicitação pode falhar antes de `start`; nesse caso, o stream pode terminar diretamente com `error`. A ausência de autenticação da solicitação também pode causar uma exceção síncrona antes de o stream ser retornado.

Os índices de conteúdo referem-se aos blocos da mensagem do assistente. Atualize cada bloco antes de emitir o evento cujo campo `partial` expõe esse estado. Os argumentos de chamadas de ferramentas devem conter entrada analisada válida em `toolcall_end`.

O stream também deve respeitar a instrumentação de solicitações fornecida por `SimpleStreamOptions`:

- Chame `options.onPayload` antes de enviar a solicitação ao provedor e use o payload substituto retornado, se houver.
- Chame `options.onResponse` depois de receber a resposta, mas antes de consumir seu corpo.
- Aguarde `options.onProviderStreamEvent?.(providerEvent, model)` para cada evento analisado do provedor antes de normalizá-lo.
- Encaminhe o sinal de aborto e o ambiente específico do provedor.

Esses hooks dão suporte à inspeção de solicitações por extensões, a eventos de cabeçalho de resposta e à observação do stream do provedor. Se forem omitidos, o provedor terá um comportamento diferente do dos provedores integrados do FineCode.

## Relate falhas e uso

Defina um motivo de parada terminal concreto. Mensagens com erro ou abortadas precisam de `errorMessage`; mensagens bem-sucedidas precisam de valores precisos de entrada, saída, cache, total de tokens e custo.

O FineCode pode compactar e repetir a solicitação após erros reconhecidos de limite de contexto. Se o serviço usar uma mensagem desconhecida, normalize somente a resposta de excesso de contexto daquele provedor para `context_length_exceeded` em um handler protegido de `message_end`.

Não transforme limites de taxa nem falhas transitórias do provedor em erros de excesso de contexto. Essas falhas usam o comportamento normal de novas tentativas do FineCode.

## Teste a integração

Teste, no mínimo:

- respostas de texto comuns e vazias
- chamadas de ferramentas e resultados de ferramentas
- entrada de imagem e resultados de ferramentas com imagens, quando houver suporte
- contabilização de uso e custo
- comportamento de aborto
- excesso de contexto
- streams malformados ou parciais
- limites de Unicode
- transferência de sessão entre provedores
- atualização e cancelamento da autenticação

Os testes de provedores do Pi upstream em [`packages/ai/test`](https://github.com/earendil-works/pi/tree/main/packages/ai/test) são referências úteis para o comportamento dos provedores integrados. Adapte os testes relevantes em vez de depender somente de prompts manuais.

Durante o desenvolvimento, execute a extensão diretamente; depois, mova-a para um local de extensões descoberto ou distribua-a por um [pacote FineCode](../packages.md). Use `/reload` depois de alterar uma extensão de provedor descoberta durante uma sessão ativa.
