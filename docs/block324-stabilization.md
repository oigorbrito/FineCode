# Bloco 324 — Durable e regressão consolidada

## Escopo

Worktree `D:/finecode-block318-full-upstream`, branch `feat/full-upstream-tree-migration`, HEAD `b35a2acfd6272ea67ec935024e137624edf79c1c`. Windows nativo, Node **22.23.3**, npm **10.9.9**. Execuções em HOME/USERPROFILE/TEMP isolados, sem credenciais pessoais, com `CI=1`. Não equivale à certificação Linux/macOS; a CI oficial usa Ubuntu.

## Correções

### Durable: contenção e execução multiplataforma

Testes identificados no relatório anterior:

- `packages/durable/test/env-node.test.ts` → `settles after the shell exits when a detached descendant retains inherited stdio` (3.000 ms).
- `packages/durable/test/harness-ownership.test.ts` → `tracks ownership chains deeper than the call stack` (90.000 ms).

A reprodução selecionando apenas os dois testes, em processos de teste isolados, passou com **2 PASS**, sem alterar seus prazos/asserts, saída natural **0** em 27,819 s. A cadeia profunda trabalha com 20.000 tarefas; o outro teste inclui inicialização de shell/processos nativos. As falhas anteriores apareciam sob concorrência, não isoladamente. Não foi demonstrado deadlock, dependência de rede ou vazamento de produção nesses testes.

`packages/durable/vitest.config.ts` limita os forks a **dois no Windows**, reduzindo contenção de CPU/SQLite e inicialização nativa, em vez de aumentar prazos ou reduzir o cenário. Outras plataformas mantêm o padrão do Vitest. A linha de comando continua permitindo configurar a concorrência.

`packages/durable/scripts/test.mjs` lança as três configurações diretamente com o executável Node atual:

1. Retenção padrão.
2. `PI_DURABLE_DOCUMENT_RETENTION_MS=0` no ambiente do filho, sem atribuição POSIX no cmd.
3. Configuração Workers existente.

Preserva a ordem e o comportamento fail-fast da cadeia `&&`; um filho que falha impede as configurações seguintes e seu status é propagado. Não usa `npm.cmd`, shell ou importação dinâmica. Dois testes em `scripts/durable-test-runner.test.mjs` verificam ordem, argumentos, isolamento da variável, caminho com espaços e propagação de status **7**.

Na primeira execução consolidada deste bloco, as três configurações de Durable terminaram: **1.272 PASS/7 SKIP**, **1.272 PASS/7 SKIP**, **29 PASS/0 SKIP**. Os dois timeouts originais não reapareceram.

### Fixture xAI desatualizada

A primeira regressão consolidada encontrou um FAIL de AI, não de Durable: `test/xai-responses.test.ts`, `routes every built-in xAI model through Responses`. Após regeneração, o catálogo anuncia `xhigh` para Grok 4.3 e 4.5, mas o teste ainda esperava sua ausência.

As fontes oficiais confirmam esse suporte:

- https://docs.x.ai/developers/models/grok-4.3.md — `none`, `low`, `medium`, `high`, `xhigh`.
- https://docs.x.ai/developers/models/grok-4.5.md — `low`, `medium`, `high`, `xhigh`.
- https://docs.x.ai/developers/models/grok-4.6.md — `low`, `medium`, `high`, `xhigh`.

Foram atualizadas as listas exatas esperadas, sem alterar produção/gerador. O teste de payload xhigh foi ampliado de Grok 4.7 para 4.3/4.5/4.6/4.7, mantendo os asserts de endpoint, modelo, esforço e reasoning criptografado. Grupo: **14 PASS**, saída **0**.

## Encerramento do runner

A primeira invocação de `./test.sh` neste bloco encerrou **naturalmente**, com status **1**, em **614,070 s**, devido à expectativa xAI posteriormente corrigida. Executou todos os workspaces e as três configurações Durable; não houve interrupção manual.

Durante Coding Agent, a inspeção do processo mostrou sete workers ativos, pipes IPC, dois timers do runner e nenhuma requisição nativa pendente. Os PIDs dos workers mudavam enquanto os testes avançavam. Coding Agent terminou com **2.683 PASS/57 SKIP**, em **145,12 s**. Não foi encontrado um vazamento que justificasse modificar teardown ou forçar `process.exit(0)`. O limite externo anterior de 200 s interrompia uma cadeia que precisa de aproximadamente dez minutos neste ambiente.

O launcher externo desta validação registra `close`, status, sinal e duração de cada processo; os testes não são aprovados por silêncio ou por interrupção.

## Instalação limpa e integridade

Executado `npm ci --ignore-scripts`: status **0**. SHA-256 de `package-lock.json` antes/depois idêntico. O diff de dependências local recebido foi preservado, sem atualização de versões nem lifecycle scripts.

Avisos classificados, não ocultados:

- Gondolin 0.12.0 declara Node >=23.6.0, incompatível com o runtime Node 22 exigido para esta validação; exemplo privado, não carregado pelo smoke FineCode.
- autoevals declara npm `please-use-pnpm`; npm emite EBADENGINE.
- Depreciações transitivas de prebuild-install, inflight, glob e node-domexception.
- `npm audit --omit=dev --json`: duas entradas high, ambas da mesma causa, **GHSA-86w9-cpqp-85rv**, node-forge via exemplo Gondolin, sem fix disponível. Já existe avaliação/allowlist específica em `scripts/npm-audit.mjs`. O audit bruto retorna **1**; isso não é contado como PASS nem como duas causas independentes. Não foi adicionada uma exceção nova.

Depois da instalação limpa: build **0**, check **0** (saída integral, sem fixes), daemon Env recompilado com `cargo build --manifest-path daemon/Cargo.toml --locked --offline` **0**, smoke CLI **0**, smoke RPC `get_state` e shutdown por EOF **0**. O smoke RPC não usa provedor, não substitui os e2e dependentes de credenciais e não mata o processo para produzir PASS.

## Regressão final

`./test.sh`, depois da instalação limpa, encerrou **naturalmente com código 0**, sinal **null**, em **586,333 s** (9 min 46,333 s). Nenhuma interrupção manual ou saída forçada foi usada.

| Escopo/configuração | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| Scripts raiz, incluindo os dois testes novos do runner | 49 | 0 | 0 |
| Agent | 91 | 0 | 0 |
| AI | 1390 | 0 | 863 |
| Chord | 579 | 0 | 0 |
| Codemode | 223 | 0 | 3 |
| Coding Agent | 2683 | 0 | 57 |
| Durable, padrão | 1272 | 0 | 7 |
| Durable, retenção zero | 1272 | 0 | 7 |
| Durable, Workers | 29 | 0 | 0 |
| Env | 63 | 0 | 18 |
| Evals, configuração unitária | 55 | 0 | 0 |
| MCP | 44 | 0 | 1 |
| Telemetry | 47 | 0 | 0 |
| TUI | 1067 | 0 | 1 |
| **Total** | **8864** | **0** | **957** |

**9.821 casos contabilizados**, sem somar reruns. Configurações obrigatórias de Durable não executadas: **0**. O reporter dot do TUI não fornece contagem de skips; uma execução auxiliar TAP, também com saída 0, confirmou 1.067 PASS/1 SKIP (1.068 testes, 162 suites), sem duplicá-la no total.

Os 957 SKIP são casos descobertos e ignorados, não PASS. Incluem os 46 e2e Coding Agent sem credenciais e 11 condições de plataforma/capacidade já descritos no Bloco 323; suites AI/recursos opcionais; SSH/terminal/host externo de Env no Windows; e demais skips das configurações listadas. A ausência de credenciais/serviços que bloqueia esses casos está representada no SKIP, não é somada novamente como uma categoria de testes executados. Não houve falha ou bloqueio não classificado na cadeia final dos workspaces.

## Classificação dos 438 caminhos

`docs/block324-upstream-classification.tsv` cobre **exatamente os 438 caminhos** de `git diff --name-status --no-renames b35a2acfd6272ea67ec935024e137624edf79c1c e86b054753b544600693384d3db4e3281ba86b60`, com status original e hashes baseline/upstream/local. Nenhum blob upstream foi aplicado nesta classificação.

| Categoria estrutural | Caminhos |
| --- | ---: |
| Blob upstream incorporado | 261 |
| Mudança FineCode deliberada/preservação contra remoção upstream | 79 |
| Diferença editorial/identidade | 1 |
| Conflito funcional ou certificação pendente | 81 |
| Arquivo excluído por decisão explícita | 16 |
| **Total** | **438** |

As seis exclusões lógicas representam 16 caminhos: Doom Overlay (11), Pirate, Rainbow Editor, Snake, Space Invaders e Tic-Tac-Toe. Permanecem ausentes.

**Limite da classificação:** igualdade de blob prova incorporação de conteúdo, não aprovação semântica de identidade. Os 81 pendentes incluem 22 diferenças apenas de modo Git (Windows não certifica o bit executável por hash de conteúdo), cinco arquivos de governança upstream, nove superfícies de identidade/telemetria e outras 45 divergências funcionais/testes/empacotamento. A tabela não é apresentada como revisão manual concluída de todos os conflitos.

Não foi certificado `FINECODE_IDENTITY_PRESERVED`: permanecem diferenças herdadas, como o título `Pi session` no compartilhamento Radius e `AI_AGENT=pi` no RPC. `finecode --help`, variáveis FineCode, proveniência e nomes de dependências upstream continuam presentes; nenhuma identidade, protocolo ou atribuição foi renomeada em lote nesta sessão.

Os gates upstream de aprovação de contribuidores permanecem arquivos locais não rastreados. Devem ser reconciliados com a manutenção solo, não ativados automaticamente. Não foram removidos, sobrescritos ou publicados neste bloco.

## Preservação e entrega

O patch binário de todos os arquivos rastreados preexistentes foi comparado antes/depois, excluindo somente os três arquivos rastreados editados neste bloco: **idêntico**. Nenhum caminho não rastreado da lista inicial ficou ausente. Nenhum reset, checkout, stash, limpeza Git ou staging foi executado. As correções de 321–323 permanecem, inclusive os testes de compartilhamento `gh`. Build não deixou diff rastreado adicional no catálogo gerado.

Arquivos funcionais desta sessão:

- `packages/durable/package.json`.
- `packages/durable/vitest.config.ts`.
- `packages/durable/scripts/test.mjs`.
- `scripts/durable-test-runner.test.mjs`.
- `packages/ai/test/xai-responses.test.ts`.

Unidades propostas para commit: execução/estabilidade Durable; fixture xAI com fonte oficial; documentação/classificação. **Sem commits ou PR draft**, pois identidade e revisão semântica dos caminhos pendentes não estão aprovadas. Não houve merge.

## Critérios

| Critério | Estado |
| --- | --- |
| `DURABLE_TESTS_PASS` | PASS, três configurações |
| `MONOREPO_TESTS_PASS` | PASS no escopo offline/Windows acima, 957 skips explícitos |
| `RUNNER_EXIT_ZERO` | PASS, saída natural 0 |
| `CODING_AGENT_SUITE_PASS` | PASS, 2.683/0/57 |
| `BUILD_PASS` | PASS após npm ci, incluindo daemon Env |
| `CHECK_PASS` | PASS após npm ci |
| `FINECODE_IDENTITY_PRESERVED` | PENDENTE: divergências herdadas não certificadas |
| `UPSTREAM_DIFF_CLASSIFIED` | 438 categorizados estruturalmente; revisão semântica dos 81 pendentes não concluída |
| `LOCAL_CHANGES_PRESERVED` | PASS, patch preexistente idêntico e caminhos não rastreados mantidos |

A estabilização técnica avançou até o gate completo com saída zero. A migração integral e a entrega via PR continuam bloqueadas pelos critérios de identidade/revisão semântica, não por Durable ou pelo runner.

## Evidências

`%TEMP%/finecode-block324/`:

- `durable-pair.log` / `.exit.json`.
- `consolidated-baseline.log` / `.exit.json` — execução natural com o FAIL xAI anterior à correção.
- `consolidated-final.log` / `.exit.json` — regressão após instalação limpa.
- `clean-install.log`, `clean-build.log`, `clean-check.log`, `smoke.log`, com seus `.exit.json`.
- `xai-regression.log`, `audit.log`, `daemon-build.log`, `tui-counts.log`, `lock-before-ci.sha256`.
- `preexisting.patch` / `preexisting-after.patch`, `status-before.txt`.

As execuções não receberam credenciais pessoais; as evidências locais não foram publicadas. Os launchers/sondagens temporários desta sessão foram removidos após a validação. Skips não equivalem a testes executados com sucesso.
