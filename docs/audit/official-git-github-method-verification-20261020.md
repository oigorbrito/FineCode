# Verificação formal do método — Git e GitHub (2026-10-20)

Objetivo: comparar **a implementação real** de `scripts/audit_canonical_tree.py`, os resultados de reconciliação e a governança observada com os contratos da documentação oficial. Não constitui certificação de fidelidade upstream nem teste de produto.

## Contratos implementados, evidências e limites

| Requisito | Implementação examinada | Fonte oficial | Conclusão estrita |
|---|---|---|---|
| Fixar os dois lados antes de comparar | `git rev-parse --verify <ref>^{commit}` em `pin()`, salvo em `manifest.json` | https://git-scm.com/docs/git-rev-parse | Compara commits determinados; não atualiza referências remotas nem identifica automaticamente a origem canônica modificada |
| Percorrer arquivos versionados da árvore inteira | `git ls-tree -rz --full-tree <sha>` em `tree()` | https://git-scm.com/docs/git-ls-tree | `-r` é recursivo; `-z` separa registros por NUL, preservando espaços e quebras de linha; não acessa alterações não commitadas |
| Comparar arquivo, tipo e modo | `compare()` confronta caminho → `(mode, type, object ID)` | https://git-scm.com/docs/git-ls-tree | Identidade de objeto implica identidade do objeto Git; diferença de objeto **não determina** regressão ou melhoria |
| Distinguir comparação de árvores e evolução desde ancestral comum | Comparação integral por árvores fixas, sem empregar notação `A...B` | https://git-scm.com/docs/git-diff | `git diff A B` e `git diff A...B` têm semânticas diferentes; não usar histórico para alegar paridade |
| Revisão humana versus checks | API de checks e API de reviews são superfícies distintas | https://docs.github.com/en/rest/checks/runs ; https://docs.github.com/en/rest/pulls/reviews | CI `success` não cria review `APPROVED`; merge com SHA esperado não comprova revisão |
| Merge controlado | Merge REST com parâmetro `sha`; `merge_method=squash` nos merges recentes | https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request | A opção `sha` protege contra mudança do HEAD da PR, não contra falhas não cobertas |
| Governança | Ruleset via REST e legacy branch-protection consultados separadamente | https://docs.github.com/en/rest/repos/rules ; https://docs.github.com/en/rest/branches/branch-protection | Governança efetiva depende da aplicação das regras e eventuais exceções, não do nome do ruleset |

## Consulta real à governança (não inferência)

Repositório: `oigorbrito/FineCode`.

- `GET /repos/oigorbrito/FineCode/rulesets?includes_parents=true`: retornou ruleset `Main`, ID **25283306**, `enforcement=active`.
- `GET /repos/oigorbrito/FineCode/rulesets/25283306`: `pull_request.parameters.required_approving_review_count=0`, `allowed_merge_methods=["squash"]`, `required_review_thread_resolution=false`; regras adicionais `deletion` e `non_fast_forward`. **Não apareceu regra de status checks obrigatórios nessa resposta.**
- O campo de condições retornou `ref_name.include=[]` e `exclude=[]`. **A aplicabilidade efetiva à branch `main` não foi demonstrada apenas por esses campos**; não presumir que o nome “Main” significa abrangência da `main`.
- `GET /repos/oigorbrito/FineCode/branches/main/protection`: **403 Resource not accessible by integration**. Classificar a proteção legacy como **INDETERMINADA por falta de acesso**, não como ausente.
- Implicação de engenharia: implementar um gate verificável que não dependa apenas da configuração de regras; exigir CI relevante, revisão técnica identificável, SHA esperado e verificação pós-merge. Se a organização desejar aprovações formais ou checks obrigatórios, isso requer configuração própria de regras com acesso apropriado.

## Falhas de escopo ainda abertas

1. `audit_canonical_tree.py` examina **apenas árvores commitadas**. Para uma conclusão de árvore canônica integral, é necessário combinar seu CSV com inventário de índice, working tree, stashes, não rastreados e worktrees existentes; diretórios ausentes são indeterminados, não limpos.
2. `--canonical` recebe uma referência indicada pelo operador. A identificação da **branch interna modificada** exige evidência independente, não pode ser inferida de `feat/full-upstream-tree-migration` ou `sync/pi-upstream-1402973a` por nome.
3. O workflow usa branches históricas como **fixtures**, não como provas de que o upstream atual esteja totalmente incorporado.
4. `review_priority` é apenas triagem de arquivos, **não** uma decisão semântica.
5. A integridade operacional (instalação, CLI, execução de ferramentas, sessões, Desktop e distribuição) precisa de validação end-to-end separada.
6. Caminhos Git com bytes de nome não UTF-8: corrigido no auditor deste PR. A coluna `path` usa exibição UTF-8 segura com bytes inválidos escapados; `path_bytes_hex` preserva a identidade exata dos bytes do nome. Teste de regressão dedicado foi adicionado. A análise semântica dos nomes continua distinta da comparação de objetos.

**Resultado:** semântica central de `ls-tree` e `rev-parse` compatível com a documentação; governança insuficientemente demonstrada para aprovação formal; prova de paridade estrutural completa ou operacional **não estabelecida**.
