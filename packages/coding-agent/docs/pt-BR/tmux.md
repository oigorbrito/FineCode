[English](../tmux.md) | **Português (Brasil)**

# Execute o FineCode no tmux

O FineCode funciona dentro do tmux, mas o tmux pode informar `Shift+Enter`, `Ctrl+Enter` e `Enter` simples como a mesma tecla. Habilite as teclas estendidas para que o FineCode consiga distingui-las.

## Confira a versão do tmux

```bash
tmux -V
```

No tmux 3.5 ou mais recente, use a configuração recomendada CSI-u abaixo. Para tmux 3.2 a 3.4, use a configuração para versões antigas.

## Habilite teclas estendidas no tmux 3.5 ou mais recente

Adicione estas linhas a `~/.tmux.conf`:

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

O FineCode solicita a transmissão de teclas estendidas quando o terminal não oferece diretamente o protocolo de teclado Kitty. CSI-u é o formato mais confiável para encaminhar teclas modificadas pelo tmux.

## Reinicie o tmux

A configuração se aplica ao servidor tmux. Para garantir que esteja ativa, encerre suas sessões tmux e inicie um novo servidor.

Se decidir encerrar o servidor pela linha de comando, salve o trabalho antes. Este comando encerra todas as sessões gerenciadas por esse servidor:

```bash
tmux kill-server
tmux
```

## Verifique as teclas modificadas

Inicie o FineCode dentro da nova sessão tmux e confirme que:

1. `Shift+Enter` insere uma nova linha no editor.
2. `Enter` envia o prompt.
3. `Alt+Enter` enfileira uma mensagem de acompanhamento no macOS e Linux. Windows e WSL usam `Ctrl+Q` por padrão.

Se essas teclas ainda se comportarem como um `Enter` simples, verifique se o terminal fora do tmux consegue informar teclas modificadas. Consulte [Configure seu terminal](terminal-setup.md).

## Use tmux 3.2 a 3.4

Essas versões aceitam teclas estendidas, mas não `extended-keys-format csi-u`. Adicione somente:

```tmux
set -g extended-keys on
```

O FineCode oferece suporte ao formato xterm `modifyOtherKeys` usado por essas versões. Reinicie o tmux e repita as etapas de verificação.

Em versões mais antigas, atualize o tmux ou use o FineCode fora dele em vez de depender dos atalhos de Enter modificado.
