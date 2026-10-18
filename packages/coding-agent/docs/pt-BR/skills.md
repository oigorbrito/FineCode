[English](../skills.md) | **Português (Brasil)**

# Skills

Skills fornecem ao FineCode instruções especializadas e arquivos de apoio para determinados tipos de trabalho. O FineCode anuncia cada skill disponível pelo nome e pela descrição e só carrega as instruções completas quando a tarefa exige.

Use uma skill quando um fluxo de trabalho precisar de mais contexto do que um modelo de prompt oferece, mas não exigir um novo ponto de integração executável. Uma skill pode agrupar scripts, referências e recursos junto às instruções.

O FineCode implementa a [especificação Agent Skills](https://agentskills.io/specification). A maioria dos campos inválidos gera avisos, em vez de interromper a inicialização.

## Crie uma skill

Uma skill é um diretório que contém `SKILL.md`:

```text
pdf-tools/
├── SKILL.md
├── scripts/
│   └── extract.sh
├── references/
│   └── formats.md
└── assets/
    └── template.json
```

Comece `SKILL.md` com frontmatter seguido de instruções diretas:

```markdown
---
name: pdf-tools
description: Extract text and tables from PDF files. Use when reading, converting, or inspecting PDFs.
---

# PDF tools

Read `references/formats.md` before converting a document. Run scripts relative to this skill directory.
```

A descrição determina quando o modelo considera carregar a skill. Informe o que ela faz e quando se aplica. Evite descrições como “Ajuda com PDFs”, que não fornecem informações suficientes para direcionar a seleção.

Use caminhos relativos à pasta da skill para referenciar arquivos incluídos nela. O FineCode informa ao modelo onde a skill está, permitindo resolver esses caminhos.

## Entenda como as skills são carregadas

Na inicialização, o FineCode examina os locais de skills configurados e acrescenta o nome, a descrição e o caminho de cada skill ao prompt de sistema. As instruções completas não são acrescentadas.

Quando uma tarefa corresponde à skill, o modelo lê `SKILL.md` e segue suas instruções. Assim, orientações detalhadas só entram no contexto quando necessárias. Um modelo pode deixar de carregar uma skill relevante; nesse caso, use `/skill:name` para forçar o carregamento.

Os argumentos após `/skill:name` são acrescentados às instruções carregadas como solicitação do usuário:

```text
/skill:pdf-tools extract report.pdf
```

Defina `disable-model-invocation: true` no frontmatter quando uma skill só deva estar disponível por meio do comando explícito. A [configuração](settings.md) `enableSkillCommands` controla se os comandos de skills aparecem na descoberta interativa de comandos; `/skill:name` ainda pode ser digitado manualmente.

<a id="choose-where-it-loads"></a>
## Adicione a skill ao FineCode

Coloque a skill no diretório de skills do usuário ou do projeto. Diretórios que contêm `SKILL.md` são descobertos recursivamente.

O FineCode também aceita os locais Agent Skills `~/.agents/skills/` e `.agents/skills/`. Os diretórios `.agents/skills/` do projeto são descobertos a partir do diretório de trabalho e de seus ancestrais, até a raiz do repositório, quando houver uma.

O FineCode aceita algumas skills Markdown isoladas, mas o formato portátil recomendado é um diretório que contenha `SKILL.md`. Consulte [Configurações](settings.md#resources) e [Pacotes FineCode](../packages.md) para outros locais.

Skills do projeto podem instruir o modelo a executar scripts ou alterar arquivos. Revise skills desconhecidas e seus arquivos de apoio antes de conceder confiança ao projeto.

## Escreva frontmatter portátil

A especificação Agent Skills define os seguintes campos:

| Campo | Finalidade |
|---|---|
| `name` | Nome do comando e de exibição |
| `description` | Descrição de direcionamento exibida ao modelo |
| `license` | Nome da licença ou arquivo de licença incluído |
| `compatibility` | Requisitos do ambiente |
| `metadata` | Metadados adicionais de chave e valor |
| `allowed-tools` | Lista experimental de ferramentas pré-aprovadas |
| `disable-model-invocation` | Oculta a skill da seleção automática do modelo |

Os nomes usam letras minúsculas, números e hífens, sem hífen no início, no fim ou em sequência. Podem ter no máximo 64 caracteres; as descrições, no máximo 1024.

O FineCode não exige nem avisa quando o nome declarado difere do diretório pai. Outras implementações de Agent Skills podem exigir essa correspondência; por isso, usar nomes iguais é a opção mais portátil.

Arquivos `SKILL.md` malformados e skills declaradas sem descrição não são carregados. Em caso de colisão de nomes, a primeira skill descoberta é mantida e um aviso é emitido.

## Valide e compartilhe uma skill

Execute o FineCode em um local onde a skill possa ser descoberta e confira os diagnósticos de inicialização e o comando `/skill:name`. Execute `/reload` depois de editar uma skill durante uma sessão ativa.

Use um [pacote FineCode](../packages.md) para distribuir uma ou mais skills por npm ou git. Mantenha a configuração do ambiente dentro da skill e declare no pacote todas as dependências de runtime necessárias.

Para ver exemplos, consulte a [coleção de skills da Anthropic](https://github.com/anthropics/skills) e a [coleção de skills do Pi upstream](https://github.com/badlogic/pi-skills).
