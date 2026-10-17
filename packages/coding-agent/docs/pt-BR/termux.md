[English](../termux.md) | **Português (Brasil)**

# Execute o FineCode no Android com Termux

O FineCode funciona no Android por meio do [Termux](https://termux.dev/), um emulador de terminal e ambiente Linux. Entrada de texto, ferramentas de arquivos e comandos de shell são compatíveis. Com Termux:API, o FineCode pode copiar e colar texto pela área de transferência do Android. Colar imagens da área de transferência não é compatível.

## Antes de começar

Instale o Termux pelo [GitHub ou F-Droid](https://github.com/termux/termux-app#installation). Não use a versão obsoleta da Google Play.

[Termux:API](https://github.com/termux/termux-api#installation) é opcional. Instale-a somente se quiser que o FineCode copie ou cole texto da área de transferência do Android ou se comandos de shell precisarem acessar as APIs do dispositivo.

## Instale o FineCode

O pacote npm do FineCode ainda não foi publicado. O comando de instalação abaixo funcionará quando estiver disponível.

1. Atualize os pacotes do Termux:

   ```bash
   pkg update && pkg upgrade
   ```

2. Instale Node.js e Git:

   ```bash
   pkg install nodejs git
   ```

3. Instale o FineCode:

   ```bash
   npm install -g --ignore-scripts finecode
   ```

4. Verifique a instalação:

   ```bash
   finecode --version
   ```

5. Abra a pasta em que deseja trabalhar e inicie o FineCode:

   ```bash
   cd /path/to/working-folder
   finecode
   ```

Continue pelo [Guia rápido](quickstart.md#3-choose-a-model) para conectar um modelo e executar sua primeira tarefa.

## Acesse o armazenamento compartilhado do Android

O Termux não pode acessar o armazenamento compartilhado do Android até que você conceda permissão. Execute uma vez:

```bash
termux-setup-storage
```

Depois da aprovação, o armazenamento compartilhado fica disponível em `/storage/emulated/0` e pelos links que o Termux cria em `~/storage/`.

Conceda essa permissão somente quando o FineCode precisar acessar esses arquivos. Comandos e ferramentas executados no Termux usam as mesmas permissões de armazenamento do processo Termux.

## Use comandos da área de transferência

O FineCode usa `termux-clipboard-set` para copiar texto e `termux-clipboard-get` para o atalho de colagem. Comandos de shell também podem usar esses comandos diretamente. Instale o aplicativo Termux:API e seu pacote de linha de comando:

```bash
pkg install termux-api
```

Verifique a integração:

```bash
printf 'FineCode clipboard test' | termux-clipboard-set
termux-clipboard-get
```

O segundo comando deve exibir `FineCode clipboard test`.

A API de área de transferência do Termux aceita somente texto. O atalho de colagem do FineCode insere esse texto no editor, mas não pode anexar imagens da área de transferência.

## Adicione instruções específicas do Termux

O FineCode detecta que está sendo executado no Termux, mas não consegue deduzir como você quer que interaja com o Android. Adicione a `~/.pi/agent/AGENTS.md` somente os detalhes do ambiente relevantes para seu trabalho:

````markdown
# Termux environment

- FineCode runs in Termux on Android.
- Shared Android storage is under `/storage/emulated/0`.
- Open URLs with `termux-open-url "https://example.com"`.
- Open files with `termux-open <path>`.
- Do not access shared storage unless the task requires it.
````

Execute `/reload` depois de alterar o arquivo durante uma sessão ativa.

## Solução de problemas

### Falha na integração com a área de transferência

Confirme que instalou os dois componentes:

1. O aplicativo Termux:API para Android, da mesma origem que o Termux
2. O pacote de linha de comando `termux-api`

Em seguida, execute os comandos de verificação da área de transferência acima fora do FineCode. Se falharem, corrija a instalação do Termux:API antes de tentar novamente o comando de cópia do FineCode.

### O armazenamento compartilhado informa acesso negado

Execute `termux-setup-storage`, aprove a solicitação de permissão do Android e tente novamente o caminho em `~/storage/` ou `/storage/emulated/0`.

### O FineCode não é encontrado após a instalação

Abra um novo shell Termux e execute:

```bash
npm prefix -g
command -v finecode
```

Confirme que o diretório global de executáveis do npm está no `PATH` e reinstale o FineCode se o pacote estiver ausente.
