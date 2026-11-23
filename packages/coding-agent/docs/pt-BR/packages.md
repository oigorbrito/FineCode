[English](../packages.md) | **Português (Brasil)**

# Pacotes FineCode

Pacotes FineCode instalam e distribuem extensões, skills, modelos de prompt e temas como uma unidade. Use um pacote quando quiser compartilhar uma personalização por npm ou git, ou agrupar vários recursos relacionados.

Um pacote é um diretório comum ou pacote npm. Pode expor diretórios convencionais de recursos, declarar caminhos explícitos sob a chave `pi` de `package.json` e incluir as próprias dependências de runtime.

## Instale e gerencie pacotes

Instale a partir de npm, git ou um caminho local:

```bash
finecode install npm:@example/pi-tools@1.0.0
finecode install git:github.com/example/pi-tools@v1
finecode install ./local-package
```

`finecode list` mostra os pacotes configurados. Use `finecode remove <source>` para remover um pacote e `finecode update --extensions` para reconciliar as instalações. Consulte [Linha de comando](cli.md#package-commands) para ver todos os comandos e opções de pacote.

Instalações pessoais são registradas em `~/.pi/agent/settings.json`. Acrescente `--local` ou `-l` para gravar a declaração em `.pi/settings.json`. O FineCode lê declarações desse arquivo somente depois que você confia no projeto.

Pacotes do projeto só são instalados e carregados depois de resolvida a confiança no projeto. Pacotes podem executar código de extensões e incluir skills que instruem o modelo a executar programas. Revise o código de pacotes de terceiros antes de instalá-los e as declarações do projeto antes de confiar nele.

Use `--extension` ou `-e` para testar um pacote em uma única execução sem adicioná-lo às configurações:

```bash
finecode -e npm:@example/pi-tools
```

## Escolha uma origem

| Origem | Exemplo | Comportamento |
|---|---|---|
| npm | `npm:@example/pi-tools@1.0.0` | Instalado no diretório npm do FineCode |
| git | `git:github.com/example/pi-tools@v1` | Clonado e reconciliado com a referência selecionada |
| URL | `https://github.com/example/pi-tools` | Tratado como origem git |
| Local | `./pi-tools` | Carregado do caminho resolvido, sem cópia |

Especificações npm com versão são fixadas. Tags e commits git também são fixados; atualizações de pacote reconciliam o checkout, mas não movem a referência configurada.

Caminhos locais relativos são resolvidos a partir do arquivo de configurações que os contém. Um caminho de arquivo carrega uma extensão. Um diretório segue as regras normais de descoberta de pacotes.

## Crie um pacote

O pacote mais simples usa diretórios convencionais:

```text
my-pi-package/
├── package.json
├── extensions/
├── skills/
├── prompts/
└── themes/
```

Sem um manifesto `pi`, o FineCode descobre extensões TypeScript e JavaScript, diretórios de skills, modelos de prompt Markdown e temas JSON nesses diretórios.

Use um manifesto explícito quando os recursos estiverem em outro local ou precisarem de filtros:

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./src/extension.ts"],
    "skills": ["./resources/skills"],
    "prompts": ["./resources/prompts/*.md"],
    "themes": ["./resources/themes/*.json"]
  }
}
```

Os caminhos são relativos à raiz do pacote. Arrays aceitam padrões glob e exclusões. Liste diretamente raízes de recursos ocultas ou simbólicas quando a travessia por glob não as descobrir.

A palavra-chave `pi-package` torna um pacote npm elegível para descoberta na [galeria upstream de pacotes do Pi](https://pi.dev/packages). Os campos opcionais `pi.image` e `pi.video` adicionam prévias à galeria.

## Declare dependências

Coloque em `dependencies` os pacotes de runtime importados pelas extensões. O FineCode instala as dependências do pacote ao instalar uma origem npm ou git.

O FineCode fornece estes pacotes a extensões e skills:

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`
- `finecode`
- `@earendil-works/pi-tui`
- `typebox`

Declare em `peerDependencies` os pacotes fornecidos pelo host listados acima, usando a faixa `"*"`, e não os inclua no pacote. O FineCode suprime a instalação automática de peers para pacotes npm gerenciados e pacotes git instalados com npm, pnpm ou Bun. Pacotes locais não são instalados nem modificados; a árvore de dependências deles continua sob responsabilidade do autor.

Não liste em `dependencies` pacotes fornecidos pelo host. Uma cópia física pode contornar o mapeamento de módulos de extensões do FineCode em ESM compilado e criar classes e registries duplicados, além de inicialização redundante. O FineCode emite um aviso de extensão ao detectar essa configuração no manifesto. Outros pacotes internos com nome FineCode usados como dependências precisam estar incluídos no tarball publicado e ser referenciados pelos caminhos em `node_modules` dos recursos.

Pacotes instalados são carregados com raízes de módulos separadas. Não dependa do compartilhamento de uma única instância de dependência entre pacotes nem da resolução, por um pacote, de dependências não declaradas de outro.

## Selecione os recursos de um pacote

A forma de objeto nas configurações restringe quais recursos serão carregados de um pacote:

```json
{
  "packages": [
    {
      "source": "npm:@example/pi-tools",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"]
    }
  ]
}
```

Para cada tipo de recurso:

- Omita a propriedade para carregar tudo que o pacote permitir.
- Use `[]` para não carregar nenhum recurso desse tipo.
- Use `!pattern` para excluir correspondências de glob.
- Use `+path` para incluir um caminho permitido específico.
- Use `-path` para excluir um caminho específico.

Os filtros restringem o manifesto do pacote. Eles não disponibilizam recursos que o próprio pacote não declarou.

Execute `finecode config` para habilitar ou desabilitar recursos descobertos e as extensões integradas do FineCode. A interface começa nas configurações pessoais; pressione Tab para trocar o escopo ou execute `finecode config --local` para começar pelas substituições do projeto.

## Entenda o escopo e a identidade

O mesmo pacote pode aparecer nas configurações pessoais e do projeto. Em geral, a entrada do projeto substitui a pessoal. Com `autoload: false`, a entrada do projeto funciona como um filtro incremental sobre o pacote pessoal.

O FineCode identifica pacotes npm pelo nome do pacote, pacotes git pela URL do repositório sem a referência e pacotes locais pelo caminho absoluto resolvido. Isso impede que o mesmo pacote seja carregado duas vezes por declarações equivalentes.

Consulte [Extensões](extensions.md), [Skills](skills.md), [Modelos de prompt](prompt-templates.md) e [Temas](../themes.md) para projetar cada recurso antes de empacotá-lo.
