# Bloco 325 — reconciliação semântica upstream

## Estado

- Worktree: `D:/finecode-block318-full-upstream`.
- Branch: `feat/full-upstream-tree-migration`.
- Baseline da revisão: `b35a2acfd6272ea67ec935024e137624edf79c1c`.
- Snapshot Pi: `e86b054753b544600693384d3db4e3281ba86b60`.
- Primeiro commit: `60d4b6c8115855fedc465c4c53f8de474c4efa28` — `fix: apply upstream executable modes`; preservado sem alterações.
- A autorização explícita para incluir as alterações herdadas e correlatas foi concedida no Bloco 326.
- Gate técnico do worktree: aprovado. O relatório foi atualizado durante a consolidação; a suíte integral descrita abaixo precede a reconciliação adicional da identidade Pi na logo TUI e os commits finais.

A lista completa de SHAs, reconciliação da `main`, validações finais e resultado da PR estão registrados em [block326-delivery.md](block326-delivery.md). Nenhuma edição feita nesta sessão alterou os blobs dos 22 arquivos de modo executável.

## Inventário canônico

[block324-upstream-classification.tsv](block324-upstream-classification.tsv) continua sendo a única matriz dos 438 caminhos; não foi criado outro inventário. Suas categorias anteriores foram convertidas para o vocabulário final, com delta revisado, evidência, hashes baseline/Pi/local, hash local anterior ao Bloco 325 e modos Git.

A tabela abaixo registra o fechamento histórico do Bloco 325. O Bloco 326 atualizou os hashes e duas categorias por integração adicional; a matriz canônica final contém 270 `UPSTREAM_APPLIED`, 38 `SEMANTICALLY_INTEGRATED`, 114 `FINECODE_PRESERVED` e 16 `INTENTIONALLY_EXCLUDED`, sem pendentes.

| Classificação no Bloco 325 | Caminhos |
|---|---:|
| `UPSTREAM_APPLIED` | 272 |
| `SEMANTICALLY_INTEGRATED` | 36 |
| `FINECODE_PRESERVED` | 114 |
| `INTENTIONALLY_EXCLUDED` | 16 |
| `PENDING_FUNCTIONAL_CONFLICT` | 0 |
| `UNRELATED_LOCAL_CHANGE` | 0 |
| **Total** | **438** |

Dos 81 pendentes originais, 23 foram classificados como `UPSTREAM_APPLIED` (22 modos e a lista upstream inerte de contribuidores), 33 como `SEMANTICALLY_INTEGRATED` e 25 como `FINECODE_PRESERVED`. Além deles, foram reconciliadas integrações diretas: metadados dos cinco exemplos, fixtures, catálogo dos exemplos e READMEs operacionais. A ausência de `UNRELATED_LOCAL_CHANGE` nesta matriz não autoriza incluir todas as alterações locais em commits.

`local_blob` registra o conteúdo efetivamente revisado do worktree; `modo_index` registra o índice na classificação. Eles não afirmam que todos esses conteúdos já foram commitados. Todos os `UPSTREAM_APPLIED` tiveram igualdade de blob com o snapshot verificada. Nos demais caminhos, igualdade de hash não foi usada como substituto da decisão semântica documentada.

## Conflitos comprovados e soluções

### Identidade e distribuição

- CLI e RPC usam `AI_AGENT=APP_NAME`; `PI_CODING_AGENT=true` permanece como marcador de interoperabilidade.
- FineCode consulta `https://registry.npmjs.org/finecode/latest` para atualizações e exige nome canônico, semver e marcador de runtime. Metadados sem marcador, inclusive com `--force`, não autorizam instalação; `packageName` remoto não redireciona o fork para outro pacote.
- Exemplo: `{ name: "finecode", version: "9.9.9" }` sem marcador não produz atualização automática nem chamada de reinstalação. Isso evita tratar um pacote homônimo/bootstrap como runtime FineCode.
- APIs explicitamente Pi continuam usando o endpoint e os metadados Pi, incluindo rename/note; testes próprios verificam essa compatibilidade.
- Onboarding usa wordmark e copy FineCode, aceita a distribuição FineCode e respeita overrides FineCode e Pi. A promoção `/dementedelves` continua disponível somente para Pi, como na distribuição FineCode anterior à importação.
- Compartilhamento usa prefixo temporário e título `FineCode session`, sem alterar `pi.share`, Radius ou o viewer upstream. Não houve compartilhamento público real.
- Os cinco exemplos mantêm nomes `finecode-extension-*`. Locks foram regenerados com `--ignore-scripts`; versões/integridades de entradas externas não foram trocadas. Não houve upgrade de `undici` nem nova exceção de lifecycle scripts.
- O gerador do install-lock conserva a identidade FineCode e verifica cada pacote interno contra a versão real do respectivo workspace: CLI 0.0.3 não implica componentes Pi 0.0.3.
- READMEs inglês/português deixam claro que o npm expõe somente `finecode`, que o runtime npm ainda é previsto para publicação e que documentação/serviços Pi são upstream. Os aliases técnicos Nix e a atribuição Pi não foram removidos.
- A atribuição de provedores FineCode e a proibição de pings de instalação Pi foram preservadas. Não houve substituição global de referências Pi.

### Execução e isolamento

- Editor externo mantém o parser de argumentos e usa `spawnProcess`, sem shell Windows: espaços, aspas, argumento vazio e metacaracteres são passados ao executável, não interpretados como comandos.
- Evals e bootstrap Docker definem ambos `FINECODE_CODING_AGENT_DIR` e `PI_CODING_AGENT_DIR`. Um override FineCode herdado não pode desviar a avaliação para o perfil do host; a restauração posterior também é testada.
- Evals reconhece marcas documentais FineCode/Pi sem remover os casos negativos ou as restrições de sandbox.
- Normalizações Windows de caminhos, fronteiras de diretório, fixtures npm, MCP e telemetria foram comparadas contra baseline/Pi/local. Não foram removidos asserts, ampliados deadlines ou acrescentados skips.
- As correções de estabilidade dos Blocos 321–324 foram preservadas, incluindo o runner Durable portátil, concorrência Windows limitada a dois workers e fixtures xAI atualizadas.

### Governança

`approve-contributor`, `issue-gate`, `pr-gate` e `issue-triage-labels` têm condição de job `github.repository == 'earendil-works/pi'`. Assim, não fecham issues/PRs, aplicam lista de aprovados ou atribuem mantenedores Pi no FineCode. A lista `.github/APPROVED_CONTRIBUTORS` foi preservada como dado upstream sem consumidor ativo no fork. Os READMEs do pacote agora refletem a manutenção solo e revisão manual já descritas no CONTRIBUTING raiz.

### Exclusões e modos

Os seis exemplos continuam excluídos: `doom-overlay/`, `pirate.ts`, `rainbow-editor.ts`, `snake.ts`, `space-invaders.ts` e `tic-tac-toe.ts`. Seus 16 caminhos estão ausentes e não aparecem no catálogo como exemplos instalados. O catálogo preserva referência explícita à origem upstream, sem reintroduzir os arquivos.

Os 22 caminhos com modo divergente agora têm `100755` no índice/commit. Baseline, snapshot e worktree têm os mesmos blobs nesses caminhos, inclusive nos prebuilds nativos; nenhum binário foi substituído. A comprovação é por metadados Git, não por permissões observadas no filesystem Windows.

## Validação

Runtime: Node **22.23.3**, npm **10.9.9**. Runners usaram HOME/TEMP isolados, sem credenciais de provedores herdadas. Não houve chamadas pagas, autenticação real de provedores ou execução real de Evals em Docker.

| Escopo | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| Scripts | 56 | 0 | 0 |
| Agent | 91 | 0 | 0 |
| AI | 1.390 | 0 | 863 |
| Chord | 579 | 0 | 0 |
| Codemode | 223 | 0 | 3 |
| Coding Agent | 2.701 | 0 | 57 |
| Durable padrão | 1.272 | 0 | 7 |
| Durable retenção zero | 1.272 | 0 | 7 |
| Durable Workers | 29 | 0 | 0 |
| Env | 63 | 0 | 18 |
| Evals | 57 | 0 | 0 |
| MCP | 44 | 0 | 1 |
| Telemetry | 47 | 0 | 0 |
| TUI | 1.067 | 0 | 1 |
| **Total** | **8.891** | **0** | **957** |

Uma única rodada completa de `./test.sh` foi necessária após mudanças nos contratos centrais de startup, atualização e isolamento. Terminou naturalmente em **624,882 s**, exit **0**, signal **null**. Não houve encerramento forçado. O gate do Bloco 324 (8.864/0/957) permanece histórico; a diferença é de 27 novos testes: scripts +7, Coding Agent +18 e Evals +2.

O reporter dot do TUI não fornece contagem de folhas/skips. Uma execução TAP específica confirmou 1.067 PASS/1 SKIP; seus testes não foram somados novamente. Reruns focados, incluindo as asserções finais do catálogo, também não foram duplicados no total.

Outros gates: build exit 0; check completo exit 0, sem fixes finais ou diagnósticos; install-lock `--check` atualizado; CLI `--version` = 0.0.3, `--help` com `finecode`; RPC `get_state` respondeu com sucesso e terminou por EOF natural, exit 0/signal null. `git diff --check` passou. A instalação limpa do Bloco 324 não foi repetida: as correções atuais de locks são de identidade/pinning de especificadores, sem mudança do grafo externo de versões/integridades.

## Preservação e entrega

- Patches binários/textuais de **274 arquivos rastreados protegidos**, fora dos caminhos alterados nesta sessão, permanecem idênticos ao snapshot inicial.
- Os **25 caminhos inicialmente não rastreados** continuam presentes. Os seis exemplos excluídos continuam ausentes.
- Evidências locais em `%TEMP%/finecode-block325/`: `canonical-before.tsv`, deltas baseline/Pi/local, logs/exit JSONs, `gate-summary.json`, `preservation.json`, `owned-paths.json` e snapshot Git inicial. Logs temporários não foram adicionados ao repositório.
- Nenhuma mudança não relacionada foi staged ou commitada. O índice ficou vazio após o commit exclusivo de modos.
- A autorização do Bloco 326 permitiu consolidar as alterações correlatas nos commits funcionais registrados no relatório de entrega.
- A integração com `origin/main` é documentada no relatório do Bloco 326. A decisão evita force push e não fecha nem faz merge da PR.
