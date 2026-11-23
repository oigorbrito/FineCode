[English](README.md) | **Português (Brasil)**

<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
</p>

> Novas issues e PRs de colaboradores iniciantes são fechadas automaticamente. Os mantenedores revisam diariamente as submissões fechadas. Consulte [CONTRIBUTING.md](../../CONTRIBUTING.pt-BR.md).

# FineCode

FineCode é um agente de programação minimalista e extensível, derivado do Pi, com o comando `finecode` como CLI canônica. O comando `pi` continua disponível como alias de compatibilidade.

Personalize o FineCode com [extensões](docs/pt-BR/extensions.md), [skills](docs/pt-BR/skills.md), [modelos de prompt](docs/pt-BR/prompt-templates.md) e [temas](docs/pt-BR/themes.md). Agrupe esses recursos em pacotes e compartilhe-os pelo npm ou pelo git.

O FineCode oferece padrões avançados e pode ser estendido para se adaptar ao seu fluxo de trabalho. Use-o [interativamente](docs/pt-BR/usage.md), automatize-o nos modos [print ou JSON](docs/pt-BR/cli.md), controle-o por [RPC](docs/rpc.md) ou incorpore o SDK. Consulte o [guia do SDK](docs/sdk.md) e o [OpenClaw](https://github.com/OpenClaw/OpenClaw) para exemplos de integração.

## Primeiros passos

Instale o FineCode pelo npm (Node.js 22.19 ou superior):

```bash
npm install -g --ignore-scripts finecode
```

Inicie a CLI com `finecode`; `pi` continua disponível como alias. O pacote npm não fixa dependências transitivas e não exige scripts de ciclo de vida das dependências durante a instalação. O pacote FineCode ainda não foi publicado.

No macOS e Linux, usuários do Nix podem executar este checkout com `nix run .` ou instalá-lo com `nix profile install .`. Consulte o [guia rápido](docs/pt-BR/quickstart.md#1-install-finecode).

Inicie o FineCode no diretório em que deseja trabalhar:

```bash
cd /path/to/project
finecode
```

Para usar um provedor de IA integrado, execute `/login` dentro do FineCode para conectar uma assinatura ou chave de API. Em seguida, atribua uma tarefa ao FineCode.

Consulte a [documentação](docs/pt-BR/index.md) para instruções completas de configuração e uso.

## Compartilhe sessões de programação open source

Se você usa o Pi upstream em trabalhos de código aberto, compartilhe suas sessões do agente de programação.

Dados públicos de sessões de projetos open source ajudam a aprimorar modelos, prompts, ferramentas e avaliações usando fluxos de trabalho reais de desenvolvimento.

Para a explicação completa, consulte [esta publicação no X](https://x.com/badlogicgames/status/2037811643774652911).

Para publicar sessões, use [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf) com uma conta Hugging Face e a CLI do Hugging Face.

- [Vídeo de demonstração](https://x.com/badlogicgames/status/2041151967695634619) sobre como publicar sessões do Pi
- Sessões de desenvolvimento publicadas do Pi: [`badlogicgames/pi-mono` no Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono).

## Desenvolvimento

Em um checkout do FineCode, instale as dependências e execute a CLI a partir do código-fonte:

```bash
npm install --ignore-scripts
./pi-test.sh
```

`pi-test.sh` pode ser chamado de qualquer diretório e mantém inalterado o diretório de trabalho do processo chamador.

Antes de enviar alterações, execute:

```bash
npm run check
./test.sh
```

Leia [CONTRIBUTING.md](../../CONTRIBUTING.pt-BR.md) antes de abrir uma issue ou pull request. O documento define as regras de contribuição, o padrão de qualidade para issues e as verificações obrigatórias. Leia [AGENTS.md](../../AGENTS.md) para conhecer as regras específicas do repositório sobre implementação, testes, dependências e lançamentos.

## Licença

MIT
