# Evidências observadas — 20/10/2026 (GitHub remoto)

Este relatório fixa os identificadores consultados. **Resultado de comando/API não é prova de comportamento além de seu escopo.** Fontes: GitHub REST API / Git e contrato em `docs/git-github-reconciliation-evidence-contract.md`.

## Estado remoto confirmado

- Repositório: `oigorbrito/FineCode`.
- `main` observada: `86349f1041a486d177d9f539d03f9e22313ff23f`.
- Comparação via GitHub compare API `base=main;head=feat/full-upstream-tree-migration`: `ahead_by=0`, `behind_by=75`, `status=behind`. **Conclusão restrita:** ausência de commits exclusivos nessa branch remota; não afirma paridade de conteúdo de worktrees nem upstream vivo.
- Workflow CI de `main`, run [39499816122](https://github.com/oigorbrito/FineCode/actions/runs/39499816122), `head_sha=86349f1041a486d177d9f539d03f9e22313ff23f`, conclusão `success`. **Conclusão restrita:** jobs executados no SHA final concluíram segundo os checks; não demonstra cobertura completa.

## Auditoria retrospectiva dos merges

| PR | SHA de merge GitHub | Merged at (UTC) | Reviews REST registrados | Evidência autorizada |
|---|---|---|---|---|
| [#500](https://github.com/oigorbrito/FineCode/pull/500) | `12e6f11d325e1fb5757420939ee80330e3735f22` | 2026-10-20 21:10:49 | 0 | Merge manual ocorrido; **sem aprovação formal registrada** |
| [#501](https://github.com/oigorbrito/FineCode/pull/501) | `9df8ebe8f3ae30c3773fdc1fec15018be686d2a2` | 2026-10-20 21:15:54 | 0 | Merge manual ocorrido; **sem aprovação formal registrada** |
| [#502](https://github.com/oigorbrito/FineCode/pull/502) | `86349f1041a486d177d9f539d03f9e22313ff23f` | 2026-10-20 21:22:23 | 0 | Merge manual ocorrido; **sem aprovação formal registrada** |

A autorização do proprietário e a revisão técnica descrita no histórico não criam automaticamente eventos de review `APPROVED` no GitHub. É preciso distinguir ambos. A CI pós-merge do último SHA foi positiva; jobs de `main` nos SHAs intermediários foram cancelados, portanto não há aprovação de CI pós-merge demonstrada isoladamente para cada SHA intermediário.

## PRs ainda não integradas (snapshot da consulta)

- [#503](https://github.com/oigorbrito/FineCode/pull/503) `head=9215918e7058fa22680e01a6e5538cd8bc438358`: draft, `build-check-test` em execução; segurança do importador, MCP e reconciliação upstream com `success`.
- [#504](https://github.com/oigorbrito/FineCode/pull/504) `head=a0d97270e10eeb1f03ef7dddb00e40fbe6c74f79` antes deste relatório: draft; build/check/test e MCP em execução na consulta, demais aprovações parciais.
- Nenhum merge adicional executado.

## Evidência local recebida — limites

Inventários produzidos no Windows sobre referências **históricas** da main registraram 578 arquivos equivalentes e 2 divergentes no worktree da PR #476, 7 divergências no bloco 17, 4 no bloco 19; 21 alterações visuais permanecem isoladas. Esses relatórios não comparam a totalidade dos objetos ignorados, stashes ou a proveniência atual da branch canônica. Não transformar contagens de nomes em equivalência sem análise por blob/patch e testes.

## Itens que permanecem indeterminados

1. Qual ref local é **canônica e modificada** para sincronização futura; branch `pi-upstream/main` local é apenas snapshot, não comprova atualização atual.
2. Reconciliação funcional completa com o HEAD contemporâneo upstream: não demonstrada.
3. Conteúdo de alterações locais contra a `main` de merge #502: relatórios históricos devem ser atualizados para essa base.
4. Cobertura de regressões dos Blocos 17/19 e PR #503: revisão e checks pendentes.

**Classificação geral:** histórico de integração e checks pós-merge do último SHA comprovados; paridade integral **NÃO COMPROVADA**.
