[English](../quickstart.md) | **Português (Brasil)**

# Guia rápido

O FineCode funciona no seu terminal e trabalha com os arquivos da sua máquina. Para usá-lo, você precisa ter acesso a um modelo por meio de um provedor compatível. Pode ser uma assinatura, uma chave de API ou um modelo local.

Para configuração nativa no Windows, leia [Configuração do Windows](windows.md). Para Android, leia [Configuração do Termux](termux.md).

<a id="1-install-finecode"></a>
## 1. Instale o FineCode

Instale pelo npm com Node.js 22.19 ou superior:

```bash
npm install -g --ignore-scripts finecode
```

O pacote npm do FineCode ainda não foi publicado. Depois de instalado, use `finecode`; `pi` continua disponível como alias. O FineCode mantém a configuração e os dados de sessão nos diretórios `.pi` existentes e aceita as variáveis legadas `PI_CODING_AGENT_DIR` e `PI_CODING_AGENT_SESSION_DIR`.

Verifique a instalação:

```bash
finecode --version
```

## 2. Inicie o FineCode

Entre na pasta em que deseja trabalhar e inicie o FineCode:

```bash
cd /path/to/folder
finecode
```

A pasta de trabalho ajuda o FineCode a encontrar arquivos, instruções e configurações relevantes. Ela também é usada para agrupar as sessões salvas.

<p align="center"><img src="../images/interactive-mode.png" alt="FineCode em execução no terminal, com uma conversa, editor de entrada e rodapé de status" width="750"></p>

A interface mostra a conversa, um editor para prompts e comandos e um rodapé com a pasta atual, o modelo e o estado da sessão. Consulte [Use o FineCode no terminal](usage.md) para aprender a adicionar arquivos, executar comandos, orientar tarefas em andamento e gerenciar resultados.

<a id="3-choose-a-model"></a>
## 3. Escolha um modelo

Um **modelo** gera as respostas do FineCode. Um **provedor** é o serviço ou a conta que o FineCode usa para acessar esse modelo.

No FineCode, execute:

```text
/login
```

Escolha um provedor e siga as instruções para usar uma assinatura ou salvar uma chave de API. Depois, execute `/model` se quiser selecionar outro modelo disponível.

Consulte [Escolher um modelo e provedor](models.md) para ver os provedores compatíveis, a autenticação por variáveis de ambiente, os modelos locais e os endpoints personalizados.

## 4. Atribua uma tarefa ao FineCode

O FineCode mostra cada arquivo que lê, cada busca, comando e edição que realiza. Ele não pede confirmação antes de cada chamada de ferramenta.

Digite uma tarefa relacionada ao seu trabalho, por exemplo:

```text
Resuma @meeting-notes.md e salve os itens de ação em action-items.md.
```

```text
Explique a estrutura deste repositório e como executar as verificações.
```

```text
Compare @previous.csv com @current.csv e resuma as alterações importantes.
```

Digite `@` no editor para procurar um arquivo, em vez de inserir o caminho completo. Quando o FineCode terminar, revise a resposta e todos os arquivos alterados. Use controle de versão ou backups para trabalhos importantes. Para tarefas não confiáveis ou sem supervisão, use um contêiner ou outro sandbox. Consulte [Segurança](security.md).

## Continue mais tarde

O FineCode salva as sessões automaticamente. Encerre o FineCode e retome a sessão mais recente da mesma pasta de trabalho com:

```bash
finecode --continue
```

Use `/resume` para escolher outra sessão salva. Consulte [Continuar ou ramificar uma sessão](sessions.md) para saber sobre nomes de sessão, ramificações, compactação, exportação e compartilhamento.

## Próximos passos

- [Usar o FineCode de forma interativa](usage.md) para aprender sobre entrada, comandos, atalhos e mensagens enfileiradas.
- [Adicionar instruções](configuration.md#context-files) que o FineCode deve seguir sempre que trabalhar em uma pasta.
- [Escolher um modelo e provedor](models.md).

<a id="choose-how-to-customize-finecode"></a>
### Escolha como personalizar o FineCode

Comece pelo mecanismo menos poderoso que atenda à sua necessidade:

| Necessidade | Comece por |
|---|---|
| Dar ao FineCode instruções persistentes para uma pasta | [`AGENTS.md`](configuration.md#context-files) |
| Reutilizar um prompt no menu `/` | [Modelo de prompt](../prompt-templates.md) |
| Adicionar instruções específicas para uma tarefa e arquivos de apoio | [Skill](skills.md) |
| Adicionar ferramentas executáveis, comandos ou handlers de eventos | [Extensão](extensions.md) |
| Criar um componente personalizado para o terminal | [Interface de terminal](../tui.md) |
| Conectar um serviço de modelos não compatível por padrão | [Provedor personalizado](custom-provider.md) |
| Instalar ou distribuir vários recursos | [Pacote FineCode](../packages.md) |

## Desinstale o FineCode

Se instalou o FineCode pelo npm, execute:

```bash
npm uninstall -g finecode
```

Isso não remove configurações, credenciais, sessões nem pacotes instalados em `~/.pi/agent/`.
