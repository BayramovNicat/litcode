# Litcode runtime sketch

Tiny TypeScript-first frontend rendering primitives:

```ts
import { $derived, $effect, $state, cn, component, html, mount, type Props } from '@holmityd/litcode';

type ButtonProps = Props<Partial<HTMLButtonElement>>;

const Button = component(
  ({ children, className }: ButtonProps = {}) =>
    html` <button class="${cn('rounded-md border px-3 py-2', className)}">${children ?? ''}</button> `,
);

const count = $state(0);
const doubled = $derived(() => count.value * 2);

function App() {
  return html`
    ${Button({ onclick: () => count.value++, children: `count ${count.value}` })}
    <button onclick=${() => count.value--}>decrement</button>
    <p>${doubled.value}</p>
  `;
}

const app = document.getElementById('app');

if (!app) throw new Error('App root not found.');

const root = mount(App(), app);

$effect(() => {
  root.update(App());
});
```

Runtime note: without a compiler, browser-style string handlers like
`onclick="count + 1"` cannot safely close over TypeScript variables. Interpolate typed
values instead: `onclick=${() => count.value++}`. Dynamic attribute/event
interpolations can be quoted or unquoted.

## Reactive Attributes & Props

Litcode supports passing reactive values (Signals or getter functions) directly to both HTML attributes and component properties:

```ts
type ButtonProps = Props<Partial<HTMLButtonElement>>;

const Button = component<ButtonProps>(({ children, ...props }: ButtonProps = {}) => {
  return html`<button>${children ?? ''}</button>`;
});

const tooltip = $state('Click me!');

// Both variants work with expecting typings:
// 1. Passing a Signal to a custom component property
const view1 = Button({ title: tooltip, children: 'Component Button' });

// 2. Interpolating a Signal directly into a native element attribute
const view2 = html`<button title=${tooltip}>Native Button</button>`;
```

## Agent Rules

Install Litcode coding-agent instructions into another project:

```sh
bunx @holmityd/litcode init
```

The initializer writes Cursor, Codex, Claude Code, GitHub Copilot, and Antigravity
rule files by default. Limit targets when needed:

```sh
bunx @holmityd/litcode agents cursor,codex,claude
bunx @holmityd/litcode init --tools copilot,antigravity --cwd ../my-app
```

Existing files are skipped unless `--force` is passed.
