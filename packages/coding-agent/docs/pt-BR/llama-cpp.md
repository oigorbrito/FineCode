[English](../llama-cpp.md) | **Português (Brasil)**

# Modelos locais com llama.cpp

O FineCode oferece suporte ao servidor roteador do [llama.cpp](https://github.com/ggml-org/llama.cpp). O roteador descobre vários modelos GGUF e os carrega ou descarrega sob demanda.

Use uma compilação atual do llama.cpp com suporte a roteador. Siga as [instruções de compilação](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) ou instale uma [versão pré-compilada](https://github.com/ggml-org/llama.cpp/releases) para sua plataforma.

## Inicie o roteador

Inicie `llama-server` sem `--model` ou `-m`. Informar um modelo inicia o modo de modelo único em vez do modo roteador.

```bash
llama-server \
  --models-dir ~/models \
  --no-models-autoload \
  --jinja \
  --host 127.0.0.1 \
  --port 8080 \
  -ngl 999 \
  -c 32768
```

Opções importantes:

- `--models-dir ~/models` descobre arquivos GGUF locais.
- `--no-models-autoload` exige carregamento explícito por `/llama`.
- `--jinja` habilita modelos de chat compatíveis e chamadas de ferramentas.
- `-ngl 999` transfere para a GPU o máximo possível de camadas.
- `-c 32768` define a janela de contexto de cada modelo carregado. Omita a opção para usar o contexto nativo do modelo, que pode exigir bem mais memória.

Um modelo de arquivo único pode ficar diretamente no diretório de modelos. Coloque modelos multimodais e divididos em várias partes em subdiretórios separados:

```text
~/models/
├── llama-3.2-1b-Q4_K_M.gguf
├── gemma-3-4b-it-Q4_K_M/
│   ├── gemma-3-4b-it-Q4_K_M.gguf
│   └── mmproj-F16.gguf
└── large-model-Q4_K_M/
    ├── large-model-Q4_K_M-00001-of-00003.gguf
    ├── large-model-Q4_K_M-00002-of-00003.gguf
    └── large-model-Q4_K_M-00003-of-00003.gguf
```

Reinicie o roteador depois de adicionar arquivos manualmente. Para definir tamanhos de contexto por modelo e outras opções, use [predefinições de modelos do llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets). Para configurações ajustadas a uma GPU e modelo NVIDIA específicos, consulte [Execute o FineCode com NVIDIA RTX e llama.cpp](nvidia-rtx-llama-cpp.md).

<a id="configure-finecode"></a>
## Configure o FineCode

Inicie o FineCode e configure o provedor:

```text
/login llama.cpp
```

Informe o URL do roteador e, opcionalmente, uma chave de API. O URL padrão é `http://127.0.0.1:8080`.

Se iniciar o roteador com `--no-models-autoload`, `/login llama.cpp` apenas salva a conexão. Execute `/llama` para carregar um modelo e, em seguida, `/model` para selecioná-lo na sessão atual.

Variáveis de ambiente podem configurar os mesmos valores sem `/login`:

```bash
export LLAMA_BASE_URL=http://127.0.0.1:8080
export LLAMA_API_KEY=optional-secret
finecode
```

Se o servidor usar uma chave de API, inicie `llama-server` com o valor correspondente em `--api-key`. Mantenha `--host 127.0.0.1` para permitir acesso somente local.

## Gerencie modelos

Execute:

```text
/llama
```

- Selecione um modelo descarregado para carregá-lo.
- Selecione um modelo carregado para descarregá-lo.
- Selecione **Download model…**, pesquise no Hugging Face e escolha um repositório e uma quantização. Também são aceitos valores exatos `owner/repository[:quant]`.
- Pressione Escape durante um carregamento ou download para confirmar o cancelamento.

A busca no Hugging Face usa `HF_TOKEN` quando definido; em seguida, consulta `$HF_TOKEN_PATH`, `$HF_HOME/token`, `$XDG_CACHE_HOME/huggingface/token` e `~/.cache/huggingface/token`. A busca também funciona sem autenticação, sujeita a limites de requisição mais baixos. O FineCode avisa antes de baixar repositórios restritos e fornece um link para a página de acesso. O download é feito pelo servidor llama.cpp; portanto, o processo dele também precisa de `HF_TOKEN` quando o repositório selecionado exige acesso.

Se outros modelos estiverem carregados, o FineCode pergunta se deve descarregá-los primeiro ou mantê-los carregados. O FineCode não descarrega modelos silenciosamente nem exclui arquivos de modelo. O roteador pode ser compartilhado com outros clientes; por isso, `/llama` sempre mostra o estado atual dele.

Modelos carregados e suspensos aparecem em `/model`. Modelos suspensos são reativados automaticamente quando selecionados. Com o carregamento automático do roteador habilitado, modelos de predefinição descarregados também aparecem e são carregados quando selecionados. Com `--no-models-autoload`, carregue primeiro o modelo por `/llama`.

Se o roteador se desconectar, `/llama` exibe **Retry** e **Close**. Retry reconecta e atualiza o estado dos modelos sem repetir a operação interrompida.

<a id="classification"></a>
## Classificação

Modelos classificadores respondem a perguntas tipadas `choice`, `bool` e `score` sobre um estado JSON, como os modelos Jev da TypeSafe. O modelo pode ser acessado por scripts [`codemode`](cli.md#enable-codemode) e por extensões usando `ctx.modelRegistry.classify()`; consulte [Modelos classificadores](models.md#use-classifier-models). O FineCode lista modelos llama.cpp como classificadores de duas maneiras:

- **Modelos de decisão**, como [Julia-1, Laya, Kev, lev e OpenJev](https://huggingface.co/collections/ggml-org/decision-models-6abf80cca3c83f127060a769), respondem nativamente pelo endpoint `/v1/systemone` do llama.cpp. Aparecem somente como classificadores, com a API `typesafe-system-one`, e não em `/model`.
- **Modelos de chat** também aparecem como classificadores com o mesmo ID e a API `llama-cpp-classify`, que lê as respostas das probabilidades dos próximos tokens, como descrito abaixo.

llama.cpp 0.6.0 e versões posteriores informam modelos de decisão na lista do roteador: `architecture.output_modalities` contém `decisions`. O roteador lê essa informação dos metadados GGUF sem carregar o modelo; assim, o FineCode também reconhece modelos de decisão descarregados ou suspensos. Compilações antigas do llama.cpp não informam esse campo, e o FineCode lista os modelos de decisão como modelos de chat.

### Use modelos de chat como classificadores

O modelo não gera uma resposta em texto. Cada pergunta vira um prompt de chat: o estado, todas as perguntas da solicitação, o estado novamente e, em seguida, a pergunta com as respostas identificadas por rótulos de um token. Os rótulos são letras para uma escolha (até 62 opções), `Yes`/`No` para um booleano e dígitos para uma pontuação (até 10 níveis). A segunda cópia do estado é lida com as perguntas à vista, o que melhorou a precisão no JevBench com modelos pequenos. O FineCode lê as probabilidades dos rótulos como próximo token e as normaliza. Uma escolha retorna a probabilidade de cada opção e uma confiança de `(n * peak - 1) / (n - 1)`; uma pontuação retorna o nível esperado.

- As probabilidades brutas dos rótulos costumam ser excessivamente confiantes. A opção `temperature` por solicitação divide os logits dos rótulos antes da normalização; valores acima de 1 suavizam a distribuição. A resposta não muda.
- As perguntas são executadas uma após a outra. Tudo que precede a pergunta final é igual para todas as perguntas da solicitação; assim, o cache de prompt do servidor avalia esse conteúdo uma única vez. O estado aparece duas vezes e, portanto, ocupa o dobro do contexto.
- Modelos pequenos podem seguir instruções contidas no estado. O prompt orienta o modelo a tratar o estado como dados, mas isso não é garantido.
- Modelos híbridos, como Qwen3.5, não conseguem voltar atrás em um prompt parcialmente armazenado em cache sem checkpoints de contexto. Se cada pergunta reprocessar todo o estado, inicie o roteador com `--ctx-checkpoints 32 --checkpoint-min-step 0`.

<a id="troubleshooting"></a>
## Solução de problemas

Verifique se o roteador está acessível:

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **Nenhum modelo em `/llama`:** confira `--models-dir`, a estrutura de diretórios e reinicie o roteador.
- **Modelo ausente em `/model` com `--no-models-autoload`:** carregue-o primeiro com `/llama`.
- **Falha ao carregar ou uso excessivo de memória:** reduza `-c` ou descarregue outro modelo.
- **Servidor fora do modo roteador:** inicie-o sem `--model`, `-m` ou `-hf`.

Para remover o provedor `llama.cpp` e `/llama`, desative `llama.cpp` em Built-in no `finecode config` ou defina `"extensions": ["-builtin:llama.cpp"]` em [configurações](settings.md#resources).
