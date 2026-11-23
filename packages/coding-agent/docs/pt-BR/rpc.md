[English](../rpc.md) | **Português (Brasil)**

# Modo RPC

O modo RPC executa o FineCode como subprocesso de longa duração, controlado por registros JSON em stdin e stdout. Use-o para integrações independentes de linguagem, isolamento de processos, IDEs e interfaces personalizadas.

Para integrações Node.js ou Bun no mesmo processo, prefira o [SDK](sdk.md). Para integrações TypeScript por subprocesso, prefira o `RpcClient` exportado, que inicia o FineCode, correlaciona respostas, oferece métodos tipados para comandos e entrega eventos a listeners.

| Interface | Fronteira de processo | Modelo de controle | Mais indicada para |
|---|---|---|---|
| [SDK](sdk.md) | Mesmo processo | Métodos e eventos TypeScript diretos | Hosts Node.js ou Bun que precisam de acesso completo à API |
| RPC | Processo filho | Comandos, respostas e eventos JSONL | Outras linguagens, processos isolados, IDEs ou clientes personalizados |

## Inicie o modo RPC

```bash
finecode --mode rpc --no-session
```

As opções normais da CLI continuam selecionando a pasta de trabalho, o modelo, as ferramentas, os recursos e o comportamento das sessões. Entre as opções comuns estão `--provider`, `--model`, `--name`, `--no-session` e `--session-dir`. Consulte [Linha de comando](cli.md) para ver a interface completa e específica da versão; `finecode --help` é a referência definitiva da versão instalada.

O modo RPC rejeita argumentos de prompt `@file`. Envie prompts pelo comando [`prompt`](../rpc-commands.md#prompt).

## Registros do protocolo

O protocolo tem quatro famílias de registros:

| Direção | Registro | Finalidade |
|---|---|---|
| stdin | Comando | Solicita ao FineCode que envie prompts, inspecione o estado, altere configurações ou gerencie a sessão |
| stdout | `response` | Informa se um comando teve sucesso e retorna seus dados |
| stdout | Evento da sessão | Transmite atividade de execução, mensagens, ferramentas, filas, compactação e novas tentativas |
| Ambos | Registro de interface de extensão | Encaminha interações compatíveis entre o FineCode e o cliente |

Consulte [Comandos RPC](../rpc-commands.md), [Fluxo de eventos JSON](../json.md) e [Interface RPC de extensões](../rpc-extension-ui.md) para ver as definições oficiais dos registros.

### Correlacione comandos e respostas

Todo comando aceita um `id` opcional do tipo string. A resposta correspondente repete esse ID:

```json
{"id":"req-1","type":"get_state"}
{"id":"req-1","type":"response","command":"get_state","success":true,"data":{"...":"..."}}
```

Use IDs únicos sempre que puder haver mais de um comando em andamento. Como o tratamento dos comandos é assíncrono, correlacione-os pelo ID, não pela ordem das respostas.

Em geral, eventos de sessão não têm ID de comando porque descrevem atividade da sessão. `bash_execution_update` é a exceção: se o comando [`bash`](../rpc-commands.md#bash) de origem tiver um ID, os eventos de saída repetem esse ID.

Um `extension_ui_response` usa o ID fornecido por `extension_ui_request`. Ele não gera uma resposta normal de comando.

## Enquadramento

RPC usa enquadramento JSONL estrito. Escreva um objeto JSON completo por registro e encerre-o com LF (`\n`). Leia stdout como fluxo de bytes ou UTF-8 e separe os registros somente por LF. Para aceitar entrada CRLF, remova um eventual carriage return anterior.

Não use um leitor de linhas genérico que trate separadores Unicode de linha ou parágrafo como limites de registros. Em particular, `readline` do Node.js também divide em `U+2028` e `U+2029`, que são válidos em strings JSON.

Leia stdout continuamente. O FineCode respeita o backpressure de stdout, mas um cliente que pare de ler pode bloquear o processo. Respeite o backpressure de stdin ao escrever comandos. Stdout é reservado para registros do protocolo; diagnósticos e logs da aplicação vão para stderr.

## Ciclo de vida da execução

Uma resposta bem-sucedida a `prompt` significa que o prompt foi aceito, enfileirado ou tratado. Não significa que o trabalho do modelo terminou:

```json
{"id":"req-2","type":"prompt","message":"Review this repository"}
{"id":"req-2","type":"response","command":"prompt","success":true,"data":{"disposition":"started"}}
```

`data.disposition` informa o que aconteceu com o prompt. Se for `"handled"`, nenhuma execução foi iniciada para esse prompt; portanto, não aguarde `agent_settled`. Consulte [Comandos RPC](../rpc-commands.md#prompt) para ver todos os valores possíveis.

Continue consumindo [eventos](../json.md) após essa resposta. `agent_end` marca o fim de uma execução de baixo nível do agente, mas ainda podem ocorrer novas tentativas, recuperação de excesso de contexto, compactação, orientação ou trabalho de acompanhamento. Aguarde `agent_settled` quando o cliente precisar saber que o FineCode não continuará automaticamente.

Inscreva-se antes de enviar um prompt para evitar perder uma conclusão rápida. `RpcClient.promptAndWait()` faz isso internamente. Se usar chamadas separadas de `RpcClient`, instale o listener antes de `prompt()` e chame `waitForIdle()` somente enquanto houver uma execução ativa.

## Erros

Um comando com falha retorna uma resposta com `success: false`:

```json
{"id":"req-3","type":"response","command":"set_model","success":false,"error":"Model not found: invalid/model"}
```

JSON malformado gera uma resposta de análise sintática sem ID de solicitação:

```json
{"type":"response","command":"parse","success":false,"error":"Failed to parse command: Unexpected token..."}
```

Uma resposta de sucesso se refere somente ao tratamento do comando. Falhas do provedor e cancelamentos ocorridos depois que um prompt é aceito aparecem na mensagem e no fluxo de eventos.

Os clientes também precisam tratar falhas ao iniciar o processo filho, encerramentos inesperados, diagnósticos em stderr, cancelamento e os próprios prazos limite. Não interprete stderr como dados do protocolo.

## Encerramento

Feche stdin do processo filho para solicitar um encerramento ordenado. O FineCode libera o runtime ativo antes de sair. Ainda assim, os clientes devem tratar sinais do processo e encerramentos inesperados.

Uma extensão também pode solicitar o encerramento por meio de seu contexto. O FineCode conclui o encerramento depois do comando atual ou depois que a execução ativa emitir `agent_settled`.

## Cliente mínimo

Este exemplo Python usa um leitor de pipe binário, que separa por LF sem tratar separadores Unicode como limites do protocolo:

```python
import json
import subprocess

process = subprocess.Popen(
    ["finecode", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
)

assert process.stdin is not None
assert process.stdout is not None

command = {"id": "prompt-1", "type": "prompt", "message": "Hello"}
process.stdin.write(json.dumps(command).encode("utf-8") + b"\n")
process.stdin.flush()

while line := process.stdout.readline():
    record = json.loads(line)
    if record.get("type") == "message_update":
        update = record["assistantMessageEvent"]
        if update["type"] == "text_delta":
            print(update["delta"], end="", flush=True)
    elif record.get("type") == "agent_settled":
        print()
        break

process.stdin.close()
process.wait()
```

Para clientes TypeScript mantidos pelo projeto, use o [exemplo de cliente RPC](../../examples/rpc-client.ts), que exige uma CLI FineCode compilada porque aponta para `dist/cli.js`.

## Referência

Os links para o código-fonte do Pi upstream abaixo são referências de implementação e podem diferir deste checkout do FineCode.

- [Comandos RPC](../rpc-commands.md): todos os comandos de stdin e suas respostas
- [Fluxo de eventos JSON](../json.md): eventos de sessão compartilhados em stdout e reconstrução de transmissões
- [Interface RPC de extensões](../rpc-extension-ui.md): diálogos, notificações, respostas e limitações
- [Tipos de mensagem](../message-types.md): mensagens e blocos de conteúdo usados por respostas e eventos
- [Formato de arquivo de sessão](../session-format.md): entradas retornadas por comandos de sessão
- [`rpc-types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-types.ts): definições TypeScript do protocolo exportadas pelo upstream Pi
- [`RpcClient`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-client.ts): implementação do cliente de subprocesso upstream

## Âncoras de referência movidas

As referências detalhadas que antes estavam nesta página agora têm páginas próprias. Estas âncoras preservam links existentes.

<a id="prompt"></a>
<a id="steer"></a>
<a id="follow_up"></a>
<a id="abort"></a>
<a id="clear_queue"></a>
<a id="new_session"></a>
<a id="get_state"></a>
<a id="get_messages"></a>
<a id="set_model"></a>
<a id="cycle_model"></a>
<a id="get_available_models"></a>
<a id="set_thinking_level"></a>
<a id="cycle_thinking_level"></a>
<a id="get_available_thinking_levels"></a>
<a id="set_steering_mode"></a>
<a id="set_follow_up_mode"></a>
<a id="compact"></a>
<a id="set_auto_compaction"></a>
<a id="set_auto_retry"></a>
<a id="abort_retry"></a>
<a id="bash"></a>
<a id="abort_bash"></a>
<a id="get_session_stats"></a>
<a id="export_html"></a>
<a id="switch_session"></a>
<a id="fork"></a>
<a id="clone"></a>
<a id="get_fork_messages"></a>
<a id="get_entries"></a>
<a id="get_tree"></a>
<a id="get_last_assistant_text"></a>
<a id="set_session_name"></a>
<a id="get_commands"></a>

Os detalhes dos comandos estão em [Comandos RPC](../rpc-commands.md).

<a id="message_update-streaming"></a>
<a id="bash_execution_update"></a>
<a id="compaction_start--compaction_end"></a>
<a id="summarization_retry_scheduled--summarization_retry_attempt_start--summarization_retry_finished"></a>

Os detalhes dos eventos estão em [Fluxo de eventos JSON](../json.md).

<a id="extension-ui-protocol"></a>

Os detalhes das interações de extensões estão em [Interface RPC de extensões](../rpc-extension-ui.md).
