[English](../environment-variables.md) | **Português (Brasil)**

# Variáveis de ambiente

O FineCode usa variáveis de ambiente de três maneiras:

- Variáveis como `PI_OFFLINE` configuram o processo do FineCode.
- O FineCode define marcadores de processo para que processos filhos identifiquem o FineCode como agente que os iniciou.
- Comandos executados pelas ferramentas de shell chamáveis pelo modelo recebem variáveis `PI_*` que descrevem a sessão atual.

As variáveis de chave de API dos provedores estão documentadas separadamente em [Provedores](providers.md#use-an-api-key-from-the-environment).

## Marcador de processo

Os pontos de entrada da CLI e RPC definem dois marcadores de processo:

- `AI_AGENT=finecode` identifica a distribuição FineCode nos processos filhos; uma compilação upstream do Pi define `pi`.
- `PI_CODING_AGENT=true` é um marcador legado mantido por compatibilidade. O FineCode continua definindo-o; portanto, ele não distingue o FineCode do Pi upstream.

Os processos filhos herdam ambos os marcadores. Eles não são específicos da sessão e não são definidos automaticamente quando o FineCode é incorporado pelo SDK.

## Ambiente de sessão das ferramentas de shell

Comandos executados pelas ferramentas `bash` e `powershell` recebem o estado da sessão atual do FineCode:

| Variável | Descrição |
|---|---|
| `PI_SESSION_ID` | ID da sessão atual |
| `PI_SESSION_FILE` | Caminho absoluto para o arquivo JSONL da sessão atual; não definido em sessões temporárias |
| `PI_PROVIDER` | Provedor do modelo selecionado no momento |
| `PI_MODEL` | ID do modelo selecionado no momento |
| `PI_REASONING_LEVEL` | Nível efetivo de raciocínio: `off`, `minimal`, `low`, `medium`, `high`, `xhigh` ou `max` |

Os valores são resolvidos quando cada comando começa. Portanto, trocar de modelo ou de nível de raciocínio afeta o próximo comando de shell sem reiniciar o FineCode. `PI_PROVIDER` e `PI_MODEL` identificam o modelo selecionado no FineCode, não outro modelo que um roteador possa escolher internamente.

Quando perguntarem qual modelo ou provedor está em execução, inspecione estas variáveis em vez de deduzir a resposta pelo prompt de sistema:

```bash
printf '%s/%s\n' "$PI_PROVIDER" "$PI_MODEL"
printf 'reasoning=%s session=%s\n' "$PI_REASONING_LEVEL" "$PI_SESSION_ID"
```

O arquivo da sessão pode ser inspecionado diretamente quando a sessão é persistente:

```bash
if [ -n "$PI_SESSION_FILE" ]; then
  tail -n 1 "$PI_SESSION_FILE"
fi
```

Essas variáveis são injetadas nas ferramentas `bash` e `powershell` chamáveis pelo modelo. Não são injetadas em comandos `!` ou `!!` digitados pelo usuário.

### Ferramentas de shell personalizadas

Ferramentas criadas com `createBashTool()` ou `createPowerShellTool()` expõem o ambiente da sessão por padrão quando registradas no FineCode. A injeção ocorre antes de `spawnHook`, portanto o hook recebe as variáveis em `ctx.env`:

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

Desative os metadados da sessão independentemente do spawn hook:

```typescript
const powershellTool = createPowerShellTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

Quando desativada, o FineCode remove os valores herdados dessas variáveis para que processos FineCode aninhados não exponham metadados obsoletos da sessão pai.

<a id="pi-process-configuration"></a>
## Configuração do processo FineCode

Estas variáveis são lidas pelo FineCode. Nomes legados `PI_*` continuam aceitos por compatibilidade:

| Variável | Descrição |
|---|---|
| `FINECODE_CODING_AGENT_DIR` | Substitui o diretório de configuração; o padrão é `~/.pi/agent`. `PI_CODING_AGENT_DIR` continua como alias legado |
| `FINECODE_CODING_AGENT_SESSION_DIR` | Substitui o armazenamento de sessões; `--session-dir` tem prioridade. `PI_CODING_AGENT_SESSION_DIR` continua como alias legado |
| `PI_PACKAGE_DIR` | Substitui o diretório de pacotes; útil para caminhos do Nix/Guix store |
| `PI_OFFLINE` | Desativa atividades automáticas de rede, inclusive a atualização do catálogo de modelos |
| `PI_SKIP_VERSION_CHECK` | Desativa a verificação automática da versão mais recente do pacote |
| `PI_TELEMETRY` | Substitui a telemetria e os cabeçalhos de atribuição de provedores. O FineCode não envia relatórios de instalação/atualização ao Pi upstream; a atribuição de provedor identifica o FineCode e esta opção controla cabeçalhos específicos: `1`/`true`/`yes` ou `0`/`false`/`no` |
| `PI_CACHE_RETENTION` | Defina como `long` para retenção prolongada de cache de prompt do provedor, quando houver suporte |
| `PI_SHARE_VIEWER_URL` | Substitui o URL base do visualizador usado por `/share`; o padrão é o visualizador do Pi upstream em `https://pi.dev/session/` |
| `PI_RADIUS_GATEWAY` | Substitui a origem do gateway Radius usada nos envios de `/bug` |
| `PI_HARDWARE_CURSOR` | Defina como `1` para mostrar o cursor de hardware; consulte [Configuração do terminal](terminal-setup.md) |
| `PI_CLIPBOARD_OSC52` | Defina como `1` para também enviar o texto copiado ao terminal com OSC 52 depois de gravá-lo na área de transferência local, como o FineCode faz por SSH. Use quando um cliente remoto acessar o FineCode sem variáveis SSH, por exemplo, um multiplexador conectado de outra máquina ou um daemon de IDE remoto |
| `PI_HYPERLINKS` | Substitui a detecção de hyperlinks OSC 8 com `1`, `0` ou `auto` |
| `PI_PROGRAM_STATUS` | Substitui a detecção do status de processo OSC 7501: `1` sempre envia, `0` nunca envia; caso contrário, o FineCode só envia após confirmação de suporte pelo terminal. Consulte [Configuração do terminal](terminal-setup.md#program-status) |
| `PI_IMAGE_PROTOCOL` | Substitui a detecção de imagens em linha com `kitty`, `iterm2`, `none` ou `auto` |
| `PI_TRUE_COLOR` | Substitui a detecção de truecolor com `1`, `0` ou `auto` |
| `PI_TUI_ESC_TIMEOUT` | Tempo de espera após um ESC isolado antes de tratá-lo como Escape, em milissegundos; o padrão é `100` por SSH e `10` nos demais casos. Aumente-o se entradas com Alt forem interpretadas incorretamente como Escape |
| `VISUAL`, `EDITOR` | Alternativas para o editor externo quando `externalEditor` não está definido |
| `HTTP_PROXY`, `HTTPS_PROXY` | Proxy para solicitações HTTP de saída |

Credenciais de provedores, como `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` e configurações específicas de provedores, estão listadas em [Provedores](providers.md#use-an-api-key-from-the-environment).
