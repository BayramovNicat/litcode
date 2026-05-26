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
