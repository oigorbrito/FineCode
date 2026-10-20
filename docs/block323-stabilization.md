# Bloco 323 — estabilização do Coding Agent

## Estado e escopo

- Worktree: `D:/finecode-block318-full-upstream`.
- Branch: `feat/full-upstream-tree-migration`.
- HEAD verificado: `b35a2acfd6272ea67ec935024e137624edf79c1c`.
- Runtime: Node **22.23.3**, npm **10.9.9**, Windows; executáveis em `%TEMP%/node22-finecode/node-v22.23.3-win-x64`.
- Execuções sem credenciais pessoais, com HOME/USERPROFILE/TEMP isolados. Não houve instalação/reconciliação de dependências, commit, push ou PR nesta sessão.
- O worktree já continha alterações extensas, inclusive no arquivo de produção modificado nesta sessão. Essas alterações não são atribuídas a este bloco.

## Inventário reproduzido

As 43 falhas citadas na solicitação **não foram reproduzidas** no estado local recebido. Não há evidência suficiente para atribuir nomes/erros individuais às 43 falhas históricas. A primeira execução integral do Coding Agent apresentou **2.680 PASS / 0 FAIL / 57 SKIP**; a execução final, com três regressões adicionais, apresentou **2.683 PASS / 0 FAIL / 57 SKIP**.

| Categoria obrigatória | Evidência atual | Decisão |
| --- | --- | --- |
| Identidade FineCode versus Pi | Testes passam; porém o diff local preexistente de `src/modes/interactive/session-share.ts` troca o título Radius de FineCode para `Pi session` | Não certificar preservação integral de identidade; requer revisão do diff herdado |
| Documentação pt-BR e referências órfãs | `test/documentation.test.ts` aprovado na suíte; já existia mudança local tratando raízes localizadas | Não atribuir a correção a esta sessão; não equivale à auditoria de toda a navegação |
| Windows e caminhos | Suíte aprovada; sondagem independente reproduziu as limitações de spawn de npm abaixo | Não confundir resolução de `.cmd` com PATH ausente |
| Instalação/atualização de pacotes | Testes de package manager, caminhos e atualização Git aprovados na suíte completa | Nenhuma reconciliação de dependências repetida |
| Configuração inicial | `test/first-time-setup.test.ts` aprovado; já existia alteração local de expectativa | Não atribuir a correção a esta sessão |
| Filtragem de recursos | Testes aprovados na suíte completa; implementação já alterada localmente | Nenhum assert enfraquecido nesta sessão |
| Ambiente/credenciais | 46 skips por ausência de credenciais; 11 por condições de plataforma/capacidade | SKIP, não PASS; não foram usados tokens pessoais |

### Skips do Coding Agent

Credenciais: branching 3, compaction de sessão 5, tree navigation 10, compaction extensions 8, sumarização LLM 2, RPC e2e 18 (**46**).

Plataforma/capacidade: auth storage 2, config 1, suspend 2, MCP 1, models store 1, tools 3, symlink regression 1 (**11**).

## Grupo corrigido: execução de GitHub CLI

Arquivos:

- `packages/coding-agent/src/modes/interactive/session-share.ts`.
- `packages/coding-agent/test/session-share.test.ts`.

Duas causas funcionais distintas:

1. `spawnSync("gh", ...)` retorna `error: ENOENT`, sem lançar exceção. A implementação tratava `status: null` como falta de login. Agora verifica `error` antes do status.
2. `spawn("gh", ...)` pode emitir `error` antes de `close`. A promessa não tinha listener de erro. Agora rejeita a promessa e usa o tratamento de falha/restauração da interface existente.

Três regressões adicionadas: CLI ausente, CLI sem autenticação e erro ao iniciar upload. O grupo completo passou com **6 PASS / 0 FAIL / 0 SKIP**. Os mocks dispensam autenticação real e não publicam gists. Os testes existentes foram preservados.

## Ambiente: npm e gh

Sondagem com o runtime exigido e ambiente isolado:

| Chamada | Resultado |
| --- | --- |
| `spawnSync("npm", ["--version"])` | `ENOENT`, status null |
| `spawnSync("npm.cmd", ["--version"])` | `EINVAL`, status null |
| `crossSpawn.sync("npm", ["--version"])` | status 0, versão 10.9.9 |
| `gh auth status` | status 1, sem hosts autenticados |

`where.exe` localizou npm e npm.cmd; portanto não é simplesmente falta de PATH. O Coding Agent já usa `spawnProcess`/`spawnProcessSync` de `src/utils/child-process.ts`, que selecionam cross-spawn no Windows. Trocar apenas `npm` por `npm.cmd` em spawn nativo não resolve a reprodução observada.

## Gates executados

O `./test.sh` foi iniciado. Scripts, Agent, AI, Chord e Codemode terminaram; a passagem pelo Coding Agent não encerrou. A execução foi interrompida, sem contar os pontos parciais como testes aprovados. O Coding Agent foi validado integralmente por execução direta isolada, e os demais workspaces foram executados separadamente.

| Escopo | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| Scripts raiz | 47 | 0 | 0 |
| Agent | 91 | 0 | 0 |
| AI | 1387 | 0 | 863 |
| Chord | 579 | 0 | 0 |
| Codemode | 223 | 0 | 3 |
| Coding Agent final | 2683 | 0 | 57 |
| Durable, primeira configuração | 1270 | 2 | 7 |
| Env | 63 | 0 | 18 |
| Evals, configuração unitária | 55 | 0 | 0 |
| MCP | 44 | 0 | 1 |
| Telemetry | 47 | 0 | 0 |
| TUI, contagem TAP | 1067 | 0 | 1 |
| **Consolidado por escopo, sem duplicar reruns** | **7556** | **2** | **950** |

Não é resultado de uma única execução integral bem-sucedida. TUI foi reexecutado com TAP porque o reporter dot não distingue skips nem fornece os totais necessários.

### Bloqueios Durable

- `test/env-node.test.ts`: `settles after the shell exits when a detached descendant retains inherited stdio`, timeout de 3.000 ms. Passou isoladamente sem alteração de timeout/asserts.
- `test/harness-ownership.test.ts`: `tracks ownership chains deeper than the call stack`, timeout de 90.000 ms. Passou isoladamente: 25,47 s de testes.

São falhas dependentes de carga observadas no gate, não falhas externas comprovadas. Os reruns isolados **não apagam os dois FAIL**. A configuração de retenção zero e os testes Workers de Durable não foram executados: a cadeia `&&` parou na primeira configuração. Não foram contabilizados como SKIP. Além disso, o script usa atribuição POSIX `PI_DURABLE_DOCUMENT_RETENTION_MS=0`, incompatível com o cmd padrão do npm no Windows; permanece um bloqueio de execução a corrigir.

Outros gates:

- `npm run build`: concluído até o bundle FineCode, 80 arquivos, 8,8 MiB.
- `npm run check`: aprovado, incluindo TypeScript, install-lock, entry graphs e browser smoke; execução final com saída integral, sem fixes.
- `git diff --check`: aprovado.
- CLI bundled `--help`: aprovado, comando `finecode` e variáveis FineCode presentes.
- RPC bundled: `get_state` retornou response com `success: true`, sem provedor/credenciais; não substitui os 18 e2e RPC pulados.

## Decisão de entrega

- `CODING_AGENT_SUITE_PASS`: **sim, suíte offline**, com 57 skips explicitados.
- `MONOREPO_REGRESSION_PASS`: **não**; dois FAIL observados, execução integral não encerrada e configurações Durable pendentes.
- `BUILD_PASS`: **sim**.
- `CHECK_PASS`: **sim**.
- `FINECODE_IDENTITY_PRESERVED`: **não certificado**, devido ao diff local herdado de identidade.
- `LOCAL_CHANGES_PRESERVED`: nenhuma operação Git destrutiva/staging foi feita; mudanças locais herdadas foram mantidas. O build não deixou diff rastreado no catálogo gerado.

Governança não foi alterada nesta sessão. Existem arquivos locais não rastreados de gates de contribuidores em `.github/`, que precisam ser revisados contra a manutenção solo antes de qualquer PR. A classificação dos 438 caminhos continua independente e não foi certificada.

**Sem commits ou PR draft:** os pré-requisitos de entrega integral não foram atendidos. Próximo gate específico: resolver estabilidade sob carga e execução multiplataforma do Durable, o encerramento da invocação integral e revisar identidade/governança do diff herdado.

## Evidências locais

Em `%TEMP%`:

- `finecode-block323/agent-baseline.json` e `agent-final.json` (resultados estruturados).
- `block323-agent-baseline.log`, `block323-agent-final.log`.
- `block323-monorepo.log` (execução interrompida).
- `block323-remaining.log` (demais workspaces, incluindo as duas falhas).
- `block323-tui-counted.log` (TAP, totais exatos).
- `block323-durable-depth.log` (reprodução isolada da cadeia profunda).
- `block323-build.log` (build completo).

Os auxiliares temporários de sondagem/lançamento desta sessão foram removidos ao final; os logs e JSONs de evidência foram mantidos.
