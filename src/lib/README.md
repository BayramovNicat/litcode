# Litcode runtime sketch

Tiny TypeScript-first frontend rendering primitives:

```ts
import { $derived, $effect, $state, component, html, mount } from './lib';

const Button = component<{ label: string; onclick: () => void }>(
  (props) => html` <button onclick="${props.onclick}">${props.label}</button> `,
);

const count = $state(0);
const doubled = $derived(() => count.value * 2);

const root = mount(html`${Button({ label: 'count', onclick: () => count.value++ })}`, app);

$effect(() => {
  root.update(html`
    ${Button({ label: `count ${count.value}`, onclick: () => count.value++ })}
    <p>${doubled.value}</p>
  `);
});
```

Runtime note: without a compiler, browser-style string handlers like
`onclick="count + 1"` cannot safely close over TypeScript variables. Interpolate typed
values instead: `onclick="${() => count.value++}"`. Dynamic attribute/event
interpolations must be quoted.
