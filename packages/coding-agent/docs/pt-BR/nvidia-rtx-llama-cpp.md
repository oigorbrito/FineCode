[English](../nvidia-rtx-llama-cpp.md) | **Português (Brasil)**

# Execute o FineCode com NVIDIA RTX e llama.cpp

A [coleção NVIDIA Local AI Inference Recipes](https://nvidia.github.io/local-ai-inference-recipes/index.html) oferece configurações do llama.cpp ajustadas a hardwares e modelos NVIDIA específicos. Cada receita fornece um comando `llama-server` para um único modelo. O FineCode usa o roteador do llama.cpp, que pode servir e gerenciar vários modelos; portanto, este guia converte o comando da receita em uma predefinição do roteador.

Os exemplos abaixo usam Windows PowerShell. Consulte [Modelos locais com llama.cpp](llama-cpp.md) para ver a referência completa do roteador e do gerenciamento de modelos no FineCode.

## Antes de começar

1. Abra o [catálogo de receitas](https://nvidia.github.io/local-ai-inference-recipes/index.html), selecione seu hardware, sistema operacional e modelo e escolha **llama.cpp**. Confira os pré-requisitos e os requisitos de memória. Guarde o comando de inicialização da receita para convertê-lo abaixo.
2. Instale o llama.cpp seguindo as instruções da receita. As configurações podem depender da compilação, por exemplo, do suporte a CUDA ou de opções de decodificação especulativa.
3. Execute `llama-server --help` e confirme que a lista inclui `--models-preset`. Sem essa opção, a compilação não pode carregar a receita como predefinição de roteador. Use uma compilação mais recente que ainda satisfaça os requisitos da receita.
4. Instale o FineCode seguindo o [Guia rápido](quickstart.md). No Windows nativo, consulte também [Execute o FineCode no Windows](windows.md).

## Converta a receita em uma predefinição

Uma predefinição lista as configurações de um ou mais modelos. O nome de cada seção se torna o ID do modelo exibido no FineCode. Salve a predefinição ao lado de `llama-server` ou informe o caminho completo ao iniciar o roteador.

Converta cada opção do comando da receita em uma linha da predefinição:

- Remova os traços iniciais: `--ctx-size 65536` vira `ctx-size = 65536`.
- Escreva opções sem valor como `true`: `--jinja` vira `jinja = true`.
- Remova aspas e crases de continuação de linha do PowerShell dos valores.
- Omita `--host` e `--port`; eles pertencem à linha de comando do roteador.
- Acrescente `load-on-startup = true` para carregar o modelo quando o roteador iniciar.
- Substitua opções curtas de arquivo de modelo pelas chaves longas da predefinição:

| Opção da receita | Chave da predefinição |
|---|---|
| `-hf` | `hf-repo` |
| `-hff` | `hf-file` |
| `-hfrd` | `hf-repo-draft` |
| `--spec-draft-model` | `spec-draft-model` |

Por exemplo, este comando de receita:

```powershell
llama-server.exe -hf "unsloth/Qwen3.8-27B-GGUF" `
  -hff "Qwen3.8-27B-UD-Q4_K_M.gguf" `
  -hfrd "z-lab/Qwen3.8-27B-DFlash2-GGUF" `
  --spec-draft-model "Qwen3.8-27B-DFlash2-Q4_K_M.gguf" `
  --no-mmproj `
  --host 127.0.0.1 `
  --port 9931 `
  --batch-size 4096 `
  --ubatch-size 1024 `
  --ctx-size 65536 `
  --parallel 1 `
  -ngl 999 `
  --jinja `
  --chat-template-kwargs '{"preserve_thinking":true}' `
  --spec-type draft-dflash `
  --spec-draft-n-max 7 `
  --spec-draft-backend-sampling
```

vira `qwen3.8-27b.ini`:

```ini
version = 1

[qwen3.8-27b]
load-on-startup = true
hf-repo = unsloth/Qwen3.8-27B-GGUF
hf-file = Qwen3.8-27B-UD-Q4_K_M.gguf
hf-repo-draft = z-lab/Qwen3.8-27B-DFlash2-GGUF
spec-draft-model = Qwen3.8-27B-DFlash2-Q4_K_M.gguf
no-mmproj = true
batch-size = 4096
ubatch-size = 1024
ctx-size = 65536
parallel = 1
ngl = 999
jinja = true
chat-template-kwargs = {"preserve_thinking":true}
spec-type = draft-dflash
spec-draft-n-max = 7
spec-draft-backend-sampling = true
```

## Inicie o roteador

Abra o PowerShell na pasta do llama.cpp e execute:

```powershell
.\llama-server.exe --models-preset qwen3.8-27b.ini --host 127.0.0.1 --port 8080
```

Se a receita exigir um token Hugging Face, defina `$env:HF_TOKEN` na mesma janela do PowerShell antes de iniciar o roteador. Na primeira inicialização, o roteador baixa os arquivos do modelo.

Use as [verificações de integridade do roteador](llama-cpp.md#troubleshooting) para confirmar que o servidor está pronto. No Windows PowerShell, use `curl.exe` em vez de `curl`, que o PowerShell associa a outro comando. O modelo está pronto quando `/models` lista `qwen3.8-27b` com o estado `loaded`.

## Use o modelo no FineCode

Siga [Configure o FineCode](llama-cpp.md#configure-finecode) e conecte-se a `http://127.0.0.1:8080`. O nome da seção da predefinição é o ID do modelo; neste exemplo, selecione `qwen3.8-27b` em `/model`.

As configurações de memória das receitas NVIDIA presumem que somente o modelo selecionado usa a GPU. Se `/llama` mostrar outros modelos carregados, descarregue-os antes de usar o modelo da receita.
