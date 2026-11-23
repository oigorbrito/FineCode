[English](../cli-integration.md) | **Português (Brasil)**

# Integração com a CLI

Por padrão, executar `finecode` abre a interface interativa de terminal (`pi` continua disponível como alias de compatibilidade). Quando a entrada ou a saída é redirecionada por pipe ou para um arquivo, o FineCode usa o modo print. Você também pode selecionar explicitamente os modos print, JSON ou RPC para scripts e aplicações.

Os quatro modos usam o mesmo agente, sessões, recursos e ferramentas. O modo determina como a entrada chega ao FineCode, como a saída é exposta e se o processo continua disponível para receber outros comandos.

O SDK não é um modo da CLI: ele incorpora o agente diretamente em um processo Node.js ou Bun. Consulte o [SDK](../sdk.md) quando o acesso direto por TypeScript for preferível a uma fronteira entre processos.

## Escolha um modo

| Modo | Interface | Duração | Use quando |
|---|---|---|---|
| Interativo | Interface de terminal | Até o usuário sair | Uma pessoa trabalha diretamente com o FineCode |
| Print | Texto final em stdout | Uma execução | Um script precisa da resposta final do assistente |
| JSON | Eventos JSONL em stdout | Uma execução | Um processo precisa acompanhar o andamento estruturado da execução |
| RPC | Comandos, respostas e eventos JSONL | Processo de longa duração | Um processo precisa de controle bidirecional |

As opções da CLI selecionam o diretório de trabalho, modelo, ferramentas, recursos e persistência de sessão independentemente do modo. Consulte [Linha de comando](cli.md) para ver todas as opções de inicialização.

## Envie texto por stdout

O modo print executa os prompts fornecidos, grava o texto final do assistente em stdout e encerra:

```bash
finecode --print "Resuma as alterações neste repositório"
```

Use o modo print quando precisar somente do texto final, inclusive em substituições de comandos, pipelines e tarefas executadas uma única vez. Eventos intermediários não são expostos.

O modo print grava erros em stderr. Uma resposta final do assistente com motivo de parada `error` ou `aborted` resulta em código de saída diferente de zero. Uma resposta interrompida pelo limite de tokens de saída do modelo (motivo `length`) ainda grava o texto parcial em stdout, exibe um aviso em stderr e retorna código diferente de zero.

Se nenhum modo for selecionado explicitamente, stdin ou stdout sem TTY também seleciona o modo print. Assim, é possível usar entrada e saída redirecionadas sem acrescentar `--print`.

## Transmita eventos JSON

O modo JSON grava um cabeçalho de sessão seguido por eventos do agente e da sessão, em JSON delimitado por novas linhas:

```bash
finecode --mode json "Revise este repositório" > events.jsonl
```

Esta é uma saída de eventos estruturados, não um único resultado JSON nem uma restrição ao formato da resposta do modelo.

Todos os prompts são fornecidos ao iniciar o processo. Ele transmite os eventos dessa execução e, em seguida, encerra; não aceita comandos posteriores.

Uma resposta do assistente com falha ou cancelada aparece no fluxo de eventos, mas, por si só, não resulta em código de saída diferente de zero. Inspecione os eventos quando o sucesso ou a falha forem importantes. O FineCode ainda retorna código diferente de zero se a invocação gerar uma exceção.

Registros `message_update` transmitidos contêm deltas, não snapshots crescentes da mensagem. Monte a saída em tempo real a partir dos eventos delta e depois substitua-a pela mensagem definitiva de `message_end`.

`agent_end` pode ser seguido por recuperação automática ou trabalho enfileirado. `agent_settled` marca o fim do trabalho automático da execução atual.

Stdout fica reservado para JSONL. Diagnósticos e logs da aplicação são gravados em stderr. Consulte [Fluxo de eventos JSON](../json.md) para conhecer o enquadramento, os formatos de evento e as regras de reconstrução.

## Controle o FineCode por RPC

O modo RPC mantém o FineCode em execução enquanto outro processo envia comandos e recebe respostas e eventos:

```bash
finecode --mode rpc --no-session
```

Comandos são objetos JSON gravados em stdin. Respostas e eventos são objetos JSON gravados em stdout. Cada registro ocupa uma linha.

Inclua um `id` nos comandos que precisam ser correlacionados. A resposta correspondente repete esse ID. Em geral, eventos não têm ID de comando, pois descrevem atividade da sessão, e não uma única solicitação.

Uma resposta de sucesso a `prompt` significa que o prompt foi aceito, enfileirado ou tratado; não significa que a execução terminou. Continue consumindo eventos até `agent_settled` quando o término for importante.

Comandos RPC podem alterar modelos, inspecionar estado, gerenciar sessões, executar comandos de shell e responder a solicitações da interface de extensões.

Diálogos de extensões formam um subprotocolo de solicitação e resposta. Outras atualizações da interface de extensões são notificações que o cliente pode mostrar ou ignorar. Recursos exclusivos da TUI não estão disponíveis ou têm comportamento reduzido fora do modo interativo.

Para integrações Node.js ou TypeScript, prefira `RpcClient` do pacote `finecode`. Ele inicia um processo filho FineCode em RPC, correlaciona solicitações, oferece métodos tipados para comandos e entrega eventos da sessão a listeners.

O [exemplo de cliente RPC](../../examples/rpc-client.ts) envia um prompt, transmite texto e atividade de ferramentas, aguarda `agent_settled` e encerra o processo filho. Ele faz parte das verificações TypeScript do repositório.

`RpcClient.promptAndWait()` instala o listener de eventos antes de enviar o prompt, evitando uma corrida com conclusões rápidas. Para operações separadas, inscreva-se antes de chamar `prompt()` e use `waitForIdle()` somente enquanto houver uma execução ativa.

O cliente precisa do caminho para uma CLI FineCode executável. O exemplo do repositório aponta para `dist/cli.js`; portanto, o pacote precisa ser compilado antes de executar o exemplo a partir de um checkout.

Se estiver criando um cliente sem `RpcClient`, comece por [Protocolo RPC](../rpc.md) e use [Comandos RPC](../rpc-commands.md) e [Fluxo de eventos JSON](../json.md) como referências do protocolo.

## Faça fork e altere a identidade do FineCode

Um fork do código-fonte pode alterar o nome da CLI e o diretório de configuração por meio de `package.json`:

```json
{
  "piConfig": {
    "name": "my-agent",
    "configDir": ".my-agent"
  }
}
```

Altere o campo de nível superior `bin` para definir o nome do executável. Essas configurações afetam o banner da CLI, os caminhos de configuração e os nomes de variáveis de ambiente derivados.

## Exemplos e referências

- [Cliente RPC](../../examples/rpc-client.ts): integração Node.js tipada
- [Interface RPC de extensões](../../examples/rpc-extension-ui.ts): cliente de terminal personalizado com diálogos de extensões
- [Linha de comando](cli.md): opções de inicialização e seleção de modo
- [Fluxo de eventos JSON](../json.md): referência de eventos JSON
- [Protocolo RPC](../rpc.md): ciclo de vida RPC, enquadramento, erros e encerramento
- [Comandos RPC](../rpc-commands.md): referência de comandos e respostas
- [Interface RPC de extensões](../rpc-extension-ui.md): subprotocolo de interação com extensões
- [Exemplos do SDK](../../examples/sdk/): integrações TypeScript no mesmo processo
