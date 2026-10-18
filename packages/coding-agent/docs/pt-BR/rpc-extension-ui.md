[English](../rpc-extension-ui.md) | **Português (Brasil)**

# Interface RPC de extensões

Extensões podem solicitar interação do usuário por meio de `ctx.ui`. No modo RPC, as chamadas compatíveis formam um subprotocolo de solicitação e resposta junto aos [comandos RPC](rpc-commands.md) e [eventos da sessão](json.md) normais.

Há duas categorias de métodos de interface de extensão:

- **Métodos de diálogo** (`select`, `confirm`, `input`, `editor`): emitem um `extension_ui_request` em stdout e aguardam até que o cliente envie um `extension_ui_response` em stdin com o mesmo `id`.
- **Métodos sem resposta** (`notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`): emitem um `extension_ui_request` em stdout, mas não esperam resposta. O cliente pode exibir a informação ou ignorá-la.

Se um método de diálogo incluir o campo `timeout`, o agente resolve automaticamente a solicitação com um valor padrão quando o tempo expira. O cliente não precisa controlar o timeout.

## Limitações

Alguns métodos de `ExtensionUIContext` não têm suporte ou funcionam de forma limitada em modo RPC por exigirem acesso direto à interface de terminal:

- `custom()` retorna `undefined`.
- `onTerminalInput()` retorna uma função de cancelamento sem efeito.
- `setWorkingMessage()`, `setWorkingVisible()`, `setWorkingIndicator()`, `setHiddenThinkingLabel()`, `setFooter()`, `setHeader()`, `addAutocompleteProvider()`, `setEditorComponent()` e `setToolsExpanded()` não fazem nada.
- `getEditorText()` retorna `""` e `getEditorComponent()` retorna `undefined`.
- `getToolsExpanded()` retorna `false`.
- `pasteToEditor()` delega a `setEditorText()` sem tratamento de colagem pelo terminal.
- `getAllThemes()` retorna `[]` e `getTheme()` retorna `undefined`.
- `setTheme()` retorna `{ success: false, error: "Theme switching not supported in RPC mode" }`.

Observação: `ctx.mode` é `"rpc"` e `ctx.hasUI` é `true` no modo RPC porque os métodos de diálogo e sem resposta funcionam pelo subprotocolo de interface de extensões. Use `ctx.mode === "tui"` para proteger recursos específicos da TUI, como `custom()`, que exigem um terminal real.

## Solicitações do FineCode

Todas as solicitações têm `type: "extension_ui_request"`, um `id` exclusivo e o campo `method`.

### select

Solicita que o usuário escolha entre opções. Métodos de diálogo com campo `timeout` informam o tempo em milissegundos; se o cliente não responder a tempo, o agente resolve com `undefined`.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "Allow dangerous command?",
  "options": ["Allow", "Block"],
  "timeout": 10000
}
```

Resposta esperada: `extension_ui_response` com `value` (a string da opção selecionada) ou `cancelled: true`.

### confirm

Solicita confirmação de sim ou não.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "Clear session?",
  "message": "All messages will be lost.",
  "timeout": 5000
}
```

Resposta esperada: `extension_ui_response` com `confirmed: true/false` ou `cancelled: true`.

### input

Solicita texto livre ao usuário.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-3",
  "method": "input",
  "title": "Enter a value",
  "placeholder": "type something..."
}
```

Resposta esperada: `extension_ui_response` com `value` (o texto digitado) ou `cancelled: true`.

### editor

Abre um editor de texto com várias linhas e conteúdo inicial opcional.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-4",
  "method": "editor",
  "title": "Edit some text",
  "prefill": "Line 1\nLine 2\nLine 3"
}
```

Resposta esperada: `extension_ui_response` com `value` (o texto editado) ou `cancelled: true`.

### notify

Exibe uma notificação. Não espera resposta.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "Command blocked by user",
  "notifyType": "warning"
}
```

O campo `notifyType` aceita `"info"`, `"warning"` ou `"error"`. Se omitido, o padrão é `"info"`.

### setStatus

Define ou limpa uma entrada de status no rodapé ou barra de status. Não espera resposta.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-6",
  "method": "setStatus",
  "statusKey": "my-ext",
  "statusText": "Turn 3 running..."
}
```

Envie `statusText: undefined` (ou omita o campo) para limpar a entrada de status daquela chave.

### setWidget

Define ou limpa um widget (bloco de linhas de texto) exibido acima ou abaixo do editor. Não espera resposta.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-7",
  "method": "setWidget",
  "widgetKey": "my-ext",
  "widgetLines": ["--- My Widget ---", "Line 1", "Line 2"],
  "widgetPlacement": "aboveEditor"
}
```

Envie `widgetLines: undefined` (ou omita o campo) para limpar o widget. `widgetPlacement` aceita `"aboveEditor"` (padrão) ou `"belowEditor"`. No modo RPC, só há suporte a arrays de strings; fábricas de componentes são ignoradas.

### setTitle

Define o título da janela ou aba do terminal. Não espera resposta.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-8",
  "method": "setTitle",
  "title": "finecode - my project"
}
```

### set_editor_text

Define o texto no editor de entrada. Não espera resposta.

```json
{
  "type": "extension_ui_request",
  "id": "uuid-9",
  "method": "set_editor_text",
  "text": "prefilled text for the user"
}
```

## Respostas ao FineCode

Somente métodos de diálogo (`select`, `confirm`, `input`, `editor`) recebem resposta. O `id` precisa corresponder ao da solicitação.

### Resposta com valor (`select`, `input`, `editor`)

```json
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

### Resposta de confirmação (`confirm`)

```json
{"type": "extension_ui_response", "id": "uuid-2", "confirmed": true}
```

### Resposta de cancelamento (qualquer diálogo)

Dispensa qualquer método de diálogo. A extensão recebe `undefined` (`select`, `input`, `editor`) ou `false` (`confirm`).

```json
{"type": "extension_ui_response", "id": "uuid-3", "cancelled": true}
```

## Exemplo

Consulte o [cliente de interface RPC de extensões](../../examples/rpc-extension-ui.ts) verificado e sua [extensão de demonstração](../../examples/extensions/rpc-demo.ts).

As uniões de solicitação e resposta do Pi upstream estão disponíveis como referência em [`rpc-types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-types.ts). Consulte [Extensões](extensions.md#ui-and-modes) para orientações independentes do modo.
