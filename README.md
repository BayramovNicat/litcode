# @holmityd/litcode

Tiny TypeScript-first frontend rendering primitives for building DOM views with template literals, components, keyed repeats, variants, and small reactive runes.

## Install

```sh
npm install @holmityd/litcode
```

With JSR:

```sh
npx jsr add @holmityd/litcode
```

## Usage

```ts
import { $derived, $effect, $state, component, html, mount } from '@holmityd/litcode';

const Button = component<{ label: string; onclick: () => void }>((props) => {
  return html`<button onclick="${props.onclick}">${props.label}</button>`;
});

const count = $state(0);
const doubled = $derived(() => count.value * 2);

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

const root = mount(html`${Button({ label: 'count 0', onclick: () => count.value++ })}`, app);

$effect(() => {
  root.update(html`
    ${Button({ label: `count ${count.value}`, onclick: () => count.value++ })}
    <p>doubled: ${doubled.value}</p>
  `);
});
```

Event handlers are passed as typed values:

```ts
html`<button onclick="${() => console.log('clicked')}">Click</button>`;
```

Dynamic attributes and events must use quoted interpolation, for example
`class="${value}"`. Unquoted `class=${value}` and `onclick=${handler}` forms are
intentionally rejected.

## API

```ts
import {
  $derived,
  $effect,
  $state,
  cn,
  component,
  createElement,
  html,
  mount,
  render,
  repeat,
  tv,
} from '@holmityd/litcode';
```

For renderer-only bundles, import from `@holmityd/litcode/core` to avoid loading the
variant helpers and their class-merging dependency.

- `html` creates a template view from a tagged template literal.
- `mount` renders a view into a DOM element and returns an update handle.
- `render` renders a view into DOM nodes.
- `component` creates typed component functions.
- `repeat` helps render keyed lists.
- `$state`, `$derived`, and `$effect` provide tiny reactive primitives.
- `cn` and `tv` provide class merging and typed variants.

## Development

```sh
npm install
npm run test
npm run test:browser
npm run build
```

The library build outputs ESM JavaScript and TypeScript declarations to `dist/`.
Browser tests run in headless Chrome. Set `CHROME_PATH` if Chrome is installed in a non-default location.

## Publish to npm

Before publishing, update `name`, `version`, `repository`, and `homepage` in `package.json` if needed.

```sh
npm login
npm run build
npm publish --access public
```

`prepublishOnly` runs tests and the library build automatically before `npm publish`.

## Publish to JSR

Make sure the scope in `jsr.json` exists on JSR, then run:

```sh
npx jsr publish
```
