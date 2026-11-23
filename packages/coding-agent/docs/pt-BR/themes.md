[English](../themes.md) | **Português (Brasil)**

# Personalize o FineCode com temas

Temas controlam as cores usadas pelo FineCode no modo interativo e nas exportações HTML. O FineCode inclui os temas `system`, `dark` e `light`. Você pode selecionar um tema, acompanhar a aparência clara ou escura do terminal ou criar sua própria paleta.

## Use as cores do terminal

O tema `system` é o padrão. Ele deriva as cores do FineCode do tema do terminal para que a interface combine com ele, em vez de impor uma paleta própria:

- O FineCode consulta as cores padrão de primeiro plano e de fundo do terminal e suas 16 cores ANSI.
- Cada cor do FineCode obtém seu matiz de uma cor ANSI; por exemplo, erros usam vermelho e links, azul.
- O FineCode ajusta a luminosidade para que cada cor tenha contraste mínimo com o fundo. O texto principal mantém uma taxa de contraste WCAG de pelo menos 4,5:1 com o fundo e cada painel.
- Quando o terminal alterna entre os modos claro e escuro, o FineCode consulta novamente as cores e reconstrói o tema.

O tema se adapta às informações fornecidas pelo terminal:

| O terminal informa | Resultado |
|---|---|
| Fundo e cores ANSI | Cores da paleta do terminal, ajustadas ao fundo real. |
| Somente o fundo | Matizes próprios do FineCode, ajustados ao fundo real. |
| Nada | Índices de cores ANSI e cores padrão do terminal, renderizados pelo próprio terminal. O texto secundário fica esmaecido e os painéis não têm cor de fundo. |

O FineCode solicita as cores ao terminal na inicialização. Em geral, os terminais respondem em poucos milissegundos, e o FineCode aguarda no máximo 100 ms antes de exibir o cabeçalho inicial. Se o terminal não responder a tempo, o FineCode usa as cores ANSI de fallback e ainda aplica as cores recebidas depois, por exemplo, em uma conexão SSH lenta. `system` é um nome reservado; temas personalizados com esse nome são ignorados.

<a id="selecting-a-theme"></a>

## Escolha um tema

Abra `/settings` e selecione **Theme**. Você pode usar um único tema para todas as aparências do terminal ou escolher temas distintos para terminais claros e escuros.

A seleção é salva na configuração `theme`:

```json
{
  "theme": "dark"
}
```

Sem a configuração `theme`, o FineCode usa `system`.

O modo automático armazena primeiro o tema claro e depois o escuro:

```json
{
  "theme": "light/dark"
}
```

O FineCode determina se o terminal é claro ou escuro com base nas cores informadas de fundo e de primeiro plano. Se o terminal não informar o fundo, o FineCode usa a notificação de aparência claro/escuro, depois a variável de ambiente `COLORFGBG` e, por fim, o modo escuro. A mesma decisão escolhe o tema de um par claro/escuro e a aparência de `system`. No modo automático, o FineCode troca de tema quando o terminal informa uma mudança de aparência. Nomes de tema não podem conter `/`, reservado para esse formato de configuração.

Use `--use-theme` para selecionar o tema inicial em uma execução sem alterar a configuração salva:

```bash
finecode --use-theme light
finecode --use-theme light/dark
```

Consulte [Recursos da CLI](cli.md#resources) para ver a opção de linha de comando.

## Crie um tema personalizado

Compare os temas integrados do FineCode com as [fontes de temas do Pi upstream](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/modes/interactive/theme) ou crie um arquivo JSON conforme o [schema de temas hospedado pelo Pi upstream](https://pi.dev/schemas/theme.schema.json). Os temas integrados usam cores OKHSL e variáveis para cores compartilhadas entre funções, permitindo ajustar diretamente matiz, saturação ou luminosidade.

1. Salve o arquivo como `<agent-dir>/themes/my-theme.json`. O diretório do agente padrão é `~/.pi/agent`.
2. Defina `name` como `my-theme`.
3. Altere os valores em `vars` e `colors`.
4. Selecione `my-theme` em `/settings`.

Use o nome do tema no nome do arquivo. O FineCode recarrega automaticamente o tema pessoal ativo somente a partir de `<agent-dir>/themes/<name>.json`. Execute `/reload` depois de adicionar ou alterar um tema de outra origem.

## Entenda o arquivo de tema

| Propriedade | Obrigatória | Função |
|---|---|---|
| `$schema` | Não | Ativa a validação e o preenchimento automático no editor usando o schema de temas hospedado pelo Pi upstream. |
| `name` | Sim | Identifica o tema nos seletores e nas configurações. Deve ser único, não pode conter `/` nem ser `system`. |
| `appearance` | Não | `"dark"` ou `"light"`: aparência de fundo para a qual o tema foi criado. Se omitida, o FineCode a detecta a partir das cores do tema. |
| `vars` | Não | Define valores de cor reutilizáveis. Variáveis podem referenciar outras variáveis. |
| `colors` | Sim | Atribui cores às funções da interface de terminal. O schema identifica as funções obrigatórias e opcionais. |
| `export` | Não | Substitui as cores de fundo da página e dos painéis nas exportações HTML. |

Os objetos de tema são estritos: somente os campos de nível superior e tokens de cor documentados são aceitos. Defina cores personalizadas reutilizáveis em `vars`; chaves personalizadas em `colors` ou `export` e metadados adicionais no nível superior são rejeitados.

Uma cor pode ser escrita de seis formas:

| Forma | Exemplo | Significado |
|---|---|---|
| Hexadecimal RGB | `"#0af"` ou `"#00aaff"` | Cor sRGB de três ou seis dígitos. |
| OKLCH | `"oklch(62% 0.1 200)"` | Luminosidade perceptual, croma e matiz. |
| OKHSL | `"okhsl(250 60% 55%)"` | Matiz, saturação e luminosidade. A saturação é relativa ao máximo permitido pela gama sRGB para aquele matiz e luminosidade; assim, todo valor fica dentro da gama e valores iguais parecem igualmente coloridos. |
| Índice de 256 cores | `39` | Índice da paleta ANSI entre `0` e `255`. |
| Referência de variável | `"primary"` | Valor de uma entrada em `vars`. |
| Padrão do terminal | `""` | Cor padrão de primeiro plano ou de fundo do terminal. |

As cores padrão do terminal são renderizadas como as próprias cores do terminal. Quando o FineCode precisa de um valor concreto, como na exportação HTML ou em cálculos de cor de extensões, ele usa as cores padrão informadas pelo terminal ou uma estimativa preta ou branca com base na aparência do tema.

O FineCode resolve referências encadeadas de variáveis. Uma variável ausente ou uma referência circular invalida o tema. O FineCode usa truecolor quando disponível, mapeia cores OKLCH para sRGB e aproxima as cores em terminais de 256 cores. Exportações HTML convertem valores OKHSL para hexadecimal porque CSS não oferece suporte a esse formato. Se as cores diferirem dos valores de origem, verifique a detecção de truecolor e as configurações de contraste do terminal. Consulte [Configuração do terminal](terminal-setup.md#override-detected-capabilities).

Use o [schema JSON de temas hospedado pelo Pi upstream](https://pi.dev/schemas/theme.schema.json) como referência exata para propriedades, cores obrigatórias e tipos de valores aceitos.

O FineCode informa arquivos de tema inválidos durante a inicialização e em `/reload`.

## Encontre a cor que deseja alterar

As cores de tema descrevem funções da interface, não componentes individuais. Use estes grupos para localizar a parte relevante do schema:

| Área | Nomes de cores |
|---|---|
| Interface geral | `accent`, `border*`, `text`, `muted`, `dim`, `success`, `error`, `warning` |
| Seleção e tela cheia | `selectedBg`, `searchMatch*`, `scrollbar*` |
| Mensagens | `userMessage*`, `customMessage*`, `thinkingText` |
| Execução de ferramentas | `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`, `toolTitle`, `toolOutput` |
| Markdown | `md*` |
| Diferenças de ferramentas | `toolDiff*` |
| Realce de sintaxe | `syntax*` |
| Modos do editor | `thinking*`, `bashMode` |
| Exportação HTML | `export.pageBg`, `export.cardBg`, `export.infoBg` |

O schema é a referência do formato. Os temas integrados fornecem valores completos para copiar e ajustar.

Cinco cores são opcionais e herdam outra cor quando omitidas:

| Cor opcional | Fallback |
|---|---|
| `scrollbarTrack` | `muted` |
| `scrollbarThumb` | `text` |
| `searchMatchBg` | `selectedBg` |
| `searchMatchText` | `text` |
| `thinkingMax` | `thinkingXhigh` |

Se as cores de `export` forem omitidas, o FineCode deriva as cores de fundo da página e dos painéis HTML de `userMessageBg`.

## Carregue um tema de projeto ou pacote

Coloque um tema do projeto em `.pi/themes/`. Temas do projeto são carregados somente depois que você concede [confiança ao projeto](security.md#understand-project-trust).

Você também pode carregar arquivos e diretórios de tema pela configuração `themes` ou distribuí-los em um pacote FineCode. Consulte [Configuração](configuration.md), [Configurações](settings.md#resources) e [Pacotes FineCode](packages.md).

Cada tema carregado precisa ter um nome exclusivo. O FineCode informa colisões entre nomes duplicados.