[English](../tui.md) | **Português (Brasil)**

# Interface de terminal

`@earendil-works/pi-tui` fornece o sistema de componentes de terminal usado pelo FineCode. Extensões o utilizam quando diálogos, notificações, texto de status e widgets integrados não bastam para a interação necessária.

Comece pelos métodos `ctx.ui` de uma [extensão](extensions.md#interact-with-the-user). Crie um componente personalizado somente quando a interface precisar de renderização, entrada de teclado ou mouse, foco, layout ou ciclo de vida próprios.

## Escolha um ponto de integração

| Necessidade | Use |
|---|---|
| Selecionar, confirmar, receber texto ou editar várias linhas | `ctx.ui.select()`, `confirm()`, `input()` ou `editor()` |
| Dar retorno sem bloquear | `ctx.ui.notify()` ou `setStatus()` |
| Manter conteúdo persistente perto do editor | `ctx.ui.setWidget()` |
| Substituir o cabeçalho, rodapé ou editor | A fábrica de componentes correspondente em `ctx.ui` |
| Exibir temporariamente uma tela interativa ou sobreposição | `ctx.ui.custom()` |
| Renderizar uma ferramenta ou entrada de sessão | Um renderizador de extensão |

Quando necessário, essas APIs recebem o tema e os atalhos ativos do FineCode. Não crie um segundo renderizador de terminal dentro de uma extensão.

## Entenda o modelo de componentes

Um componente renderiza um array de linhas de terminal para uma largura disponível. Opcionalmente, pode tratar entrada de teclado e mouse; também precisa invalidar a saída em cache quando seu estado ou conteúdo dependente do tema mudar.

Cada linha renderizada deve caber na largura fornecida. Meça colunas visíveis do terminal, não o tamanho da string, pois escapes ANSI, caracteres largos, emojis e caracteres combinantes alteram a largura exibida.

Use `visibleWidth()`, `truncateToWidth()`, `sliceByColumn()` e `wrapTextWithAnsi()` em vez de implementar por conta própria o tratamento de largura do terminal. O FineCode redefine estilos e hyperlinks após cada linha; reaplique-os em todas as linhas renderizadas.

Depois de alterar o estado do componente, invalide o componente afetado e chame o `tui.requestRender()` injetado. A TUI agrupa solicitações de renderização e atualiza o terminal.

## Componha componentes integrados

O pacote inclui componentes para layouts e controles comuns:

- `Text`, `Markdown`, `Image` e `TruncatedText` renderizam conteúdo.
- `Container`, `VStack`, `HStack`, `Box` e `Spacer` compõem layouts.
- `Input` e `Editor` recebem texto.
- `SelectList` e `SettingsList` implementam seleção pesquisável e fluxos de configuração.
- `ScrollView` oferece uma área de rolagem limitada.
- `Loader` e `CancellableLoader` indicam trabalho em andamento.
- `MouseRegion` adiciona comportamento de ponteiro ao redor de outro componente.

Prefira esses componentes a recriar seleção, rolagem, edição de texto ou tratamento de largura. Os exemplos de extensão mostram como combiná-los com bordas e temas do FineCode.

## Trate entrada de teclado e foco

Use `matchesKey()` e `Key` para entrada de teclado do terminal. O parser considera os protocolos de terminal compatíveis e os modificadores de tecla. Componentes de extensão devem usar o `KeybindingsManager` injetado para ações configuráveis da aplicação.

Um componente que exibe um cursor de texto deve implementar `Focusable` e posicionar `CURSOR_MARKER` imediatamente antes do cursor visual. Envolva a célula do cursor com `renderFakeCursor()` para que a TUI a renderize em vídeo reverso ou a oculte depois de `CURSOR_MARKER` quando o cursor de hardware estiver visível. A TUI usa esse marcador para posicionar o cursor de hardware para editores de método de entrada (IME).

Contêineres que envolvem `Input` ou `Editor` devem propagar a eles o estado `focused`. Sem essa propagação, janelas de candidatos de métodos de entrada em chinês, japonês, coreano e outros idiomas podem aparecer na posição errada da tela.

Estenda o `CustomEditor` do FineCode ao substituir o editor principal. Ele preserva atalhos da aplicação e controles do agente.

Encaminhe à implementação base as teclas que seu editor não trata e restaure o padrão limpando a fábrica de editores personalizados.

## Trate entrada do mouse

O modo de tela cheia encaminha eventos de mouse normalizados aos componentes. Um handler pode marcar um evento como tratado, capturar uma sequência de arrasto, solicitar foco ou solicitar uma renderização.

Eventos de roda não tratados rolam o `ScrollView` mais próximo. Arrastos não tratados do botão primário continuam disponíveis para selecionar a transcrição. Links OSC 8 têm prioridade sobre regiões clicáveis que os envolvem.

No modo regular, a entrada do mouse fica a cargo do terminal, que controla o histórico de rolagem. Projete cada interação também com um caminho por teclado, mesmo quando o modo de tela cheia aceita mouse.

## Use telas e sobreposições personalizadas

`ctx.ui.custom()` dá temporariamente a um componente o controle da área interativa e é resolvido quando o componente chama o callback de conclusão fornecido.

Passe `overlay: true` para desenhar sobre o conteúdo existente. Opções de sobreposição controlam tamanho, âncoras, deslocamentos, margens e visibilidade responsiva. Um handle de sobreposição pode alterar o foco ou ocultá-la e exibi-la temporariamente com `setHidden()` enquanto a interação continua ativa.

Sobreposições focadas mantêm o controle da entrada entre renderizações comuns. Se outro componente precisar receber entrada enquanto uma sobreposição continuar visível, libere ou redirecione o foco explicitamente pelo handle.

Trate cada instância de componente personalizado como pertencente a uma única interação. Crie uma instância nova ao iniciar essa interação novamente.

Conclua a interação com o callback fornecido pela fábrica do componente. Ele resolve a promessa de `ctx.ui.custom()` e descarta o componente. Não chame `OverlayHandle.hide()` em uma sobreposição criada por `ctx.ui.custom()`.

Consulte [`overlay-qa-tests.ts`](../../examples/extensions/overlay-qa-tests.ts) para ver comportamento de posicionamento, sobreposição de camadas, foco, visibilidade responsiva e animação.

## Aplique temas corretamente

Use o tema fornecido à extensão ou ao callback do componente. Helpers de tema produzem strings com estilos ANSI para cores semânticas, como destaque, texto esmaecido, sucesso, avisos, erros, saída de ferramentas e Markdown.

Use `theme.style()` para combinar cores de primeiro plano e de fundo com atributos de texto:

```typescript
return new Text(
  theme.style("Done!", {
    fg: "success",
    bg: "toolSuccessBg",
    bold: true,
  }),
  0,
  0,
);
```

A cor de um estilo pode ser um token semântico do tema ou um `Color` concreto. Tokens de primeiro plano são aceitos em `fg` e tokens de fundo em `bg`; para usar a cor de um token na outra posição, passe sua cor concreta, por exemplo, `{ fg: theme.colors.userMessageBg }`. Acesse cores concretas por `theme.colors` e use utilitários como `mixColors()` de `@earendil-works/pi-tui` quando precisar fazer cálculos de cor. Tokens definidos pelo tema como padrão do terminal são renderizados com a cor do próprio terminal; `theme.colors` retorna a cor que o terminal informou ou uma estimativa caso ele não tenha informado. Use `theme.appearance` (`"dark"` ou `"light"`) para decidir, por exemplo, se uma cor deve ficar mais clara ou mais escura. O FineCode converte o resultado para saída truecolor ou de 256 cores conforme os recursos do terminal. Tokens de tema são convertidos uma vez por tema; quando possível, calcule cores concretas fora do caminho de renderização.

Os helpers existentes `theme.fg()` e `theme.bg()` continuam disponíveis para aplicar uma cor semântica.

Não armazene permanentemente strings com cores do tema, a menos que `invalidate()` as reconstrua. Uma alteração de tema limpa caches de renderização, mas não remove cores ANSI antigas embutidas no estado da aplicação.

Callbacks de tema avaliados durante a renderização não exigem reconstrução especial. Componentes sem estado também podem calcular a saída temática em cada renderização.

Use [Temas](themes.md) para criar paletas de terminal. Use `getMarkdownTheme()` do FineCode ao renderizar Markdown que deve combinar com o tema ativo da aplicação.

## Mantenha a renderização responsiva

A renderização ocorre no caminho interativo. Armazene em cache cálculos caros de layout e realce por largura e conteúdo, e limpe esse cache em `invalidate()`.

Mantenha compacta a visualização padrão e revele detalhes por expansão ou em uma tela dedicada. Para renderização personalizada de ferramentas, trate resultados parciais e reutilize o componente anterior quando for seguro atualizá-lo.

Use `PI_TUI_WRITE_LOG` para capturar o fluxo ANSI bruto ao diagnosticar problemas de renderização. Teste larguras estreitas, caracteres largos, eventos de redimensionamento, mudanças de tema e transições de foco nos modos regular e de tela cheia.

## Exemplos e código-fonte

Os exemplos de extensão verificados cobrem os padrões principais:

- [`preset.ts`](../../examples/extensions/preset.ts) e [`tools.ts`](../../examples/extensions/tools.ts) usam listas de seleção e configurações.
- [`qna.ts`](../../examples/extensions/qna.ts) usa interface assíncrona cancelável.
- [`modal-editor.ts`](../../examples/extensions/modal-editor.ts) substitui o editor.
- [`custom-footer.ts`](../../examples/extensions/custom-footer.ts) substitui o rodapé.
- [`widget-placement.ts`](../../examples/extensions/widget-placement.ts) posiciona conteúdo persistente ao redor do editor.

As exportações do código-fonte TUI do Pi upstream podem ser consultadas em [`packages/tui/src/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/tui/src/index.ts). Consulte [Extensões](extensions.md) para conhecer o ciclo de vida, estado, ferramentas, eventos e modos das extensões.
