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

## Examples

### Render and update a view

```ts
import { html, mount } from '@holmityd/litcode';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

const root = mount(html`<p>Hello Litcode</p>`, app);

root.update(html`<p>Hello again</p>`);
root.destroy();
```

`mount` and `render` have the same API. Both return a handle with `update` and
`destroy`.

```ts
import { html, render } from '@holmityd/litcode';

const handle = render(html`<strong>Rendered into a target</strong>`, document.body);
handle.update(html`<strong>Updated in place</strong>`);
```

### Dynamic attributes and events

Event handlers are passed as typed values. Dynamic attributes and events can use
either quoted interpolation, such as `class="${value}"`, or unquoted
interpolation, such as `checked=${done}` and `onclick=${handler}`.

```ts
import { html, mount } from '@holmityd/litcode';

let done = false;

const view = () => html`
  <label class="${done ? 'todo done' : 'todo'}">
    <input type="checkbox" checked=${done} onchange=${() => (done = !done)} />
    Mark task done
  </label>
`;

const root = mount(view(), document.querySelector('#app')!);
root.update(view());
```

### Components and children

`component` creates typed component functions. Props that match DOM properties
are assigned to the first rendered element; `dataset` and `style` are handled as
special props.

```ts
import {
  type Children,
  type Props,
  component,
  createElement,
  html,
  mount,
} from '@holmityd/litcode';

type ButtonProps = Props<{
  children: Children;
  onclick: () => void;
  disabled?: boolean;
}>;

const Button = component<ButtonProps>(({ children, onclick }) => {
  return html`<button class="button" onclick=${onclick}>${children}</button>`;
});

mount(
  html`
    ${Button({
      children: 'Save',
      onclick: () => console.log('saved'),
      disabled: false,
      dataset: { action: 'save' },
      style: 'font-weight: 600',
    })}
  `,
  document.querySelector('#app')!,
);

const sameButton = createElement(Button, {
  children: 'Create',
  onclick: () => console.log('created'),
});
```

### Keyed DOM updates

Use a `key` attribute when writing keyed children directly in a template. The key
is used for DOM reconciliation and is not left on the rendered element.

```ts
import { html, mount } from '@holmityd/litcode';

const root = mount(
  html`<ul>
    <li key="a">Alpha</li>
    <li key="b">Beta</li>
  </ul>`,
  document.querySelector('#app')!,
);

root.update(
  html`<ul>
    <li key="b">Beta</li>
    <li key="a">Alpha updated</li>
  </ul>`,
);
```

### Keyed lists with `repeat`

`repeat` renders keyed lists and preserves DOM nodes while items are inserted,
removed, or reordered.

```ts
import { html, mount, repeat } from '@holmityd/litcode';

type Todo = { id: number; text: string; done: boolean };

const todos: Todo[] = [
  { id: 1, text: 'Write examples', done: true },
  { id: 2, text: 'Ship docs', done: false },
];

const view = (items: Todo[]) => html`
  <ul>
    ${repeat(
      items,
      (todo) => todo.id,
      (todo, index) => html`
        <li class=${todo.done ? 'done' : ''}>
          <span>${index + 1}. ${todo.text}</span>
        </li>
      `,
    )}
  </ul>
`;

const root = mount(view(todos), document.querySelector('#app')!);
root.update(view([...todos].reverse()));
```

### Reactive runes

`$state`, `$derived`, and `$effect` provide small reactive primitives. Runes can
be interpolated directly into child and attribute positions, where they update
without calling `handle.update`.

```ts
import { $derived, $effect, $state, html, mount } from '@holmityd/litcode';

const count = $state(0);
const doubled = $derived(() => count.value * 2);

mount(
  html`
    <button onclick=${() => count.value++}>count ${count}</button>
    <output value="${doubled}">${doubled}</output>
  `,
  document.querySelector('#app')!,
);

const stop = $effect(() => {
  document.title = `Count ${count.value}`;
  return () => {
    document.title = 'Litcode';
  };
});

// Later:
stop();
```

### Variants and class merging

Use `cn` for class merging and `tv` for typed variants. `VariantProps` extracts
the valid variant options for a component prop type.

```ts
import { type VariantProps, cn, component, html, tv } from '@holmityd/litcode';

const button = tv({
  base: 'inline-flex rounded px-3 py-2 font-medium',
  variants: {
    intent: {
      primary: 'bg-blue-600 text-white',
      secondary: 'bg-zinc-100 text-zinc-900',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
    },
  },
  defaultVariants: {
    intent: 'primary',
    size: 'md',
  },
});

type ButtonVariantProps = VariantProps<typeof button>;

const Button = component<ButtonVariantProps & { label: string }>(({ intent, size, label }) => {
  return html`<button class=${cn(button({ intent, size }), 'focus:outline-none')}>
    ${label}
  </button>`;
});
```

### Renderer-only imports

Import from `@holmityd/litcode/core` when you only need the renderer and reactive
primitives. Import variants separately if you want class helpers without the root
entrypoint.

```ts
import { $state, component, html, mount, repeat } from '@holmityd/litcode/core';
import { cn, tv } from '@holmityd/litcode/variants';
```

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
  type Children,
  type InferProps,
  type MountHandle,
  type Props,
  type Rune,
  type VariantProps,
  type View,
} from '@holmityd/litcode';
```

For renderer-only bundles, import from `@holmityd/litcode/core` to avoid loading the
variant helpers and their class-merging dependency. This is the recommended path for
memory- and CPU-constrained devices; use the root import or
`@holmityd/litcode/variants` when you also need `cn` or `tv`.

- `html` creates a template view from a tagged template literal.
- `mount` renders a view into a DOM element and returns an update handle.
- `render` renders a view into a target and returns the same handle as `mount`.
- `component` creates typed component functions.
- `createElement` calls a component with props and optional children.
- `repeat` helps render keyed lists.
- `$state`, `$derived`, and `$effect` provide tiny reactive primitives.
- `cn` and `tv` provide class merging and typed variants.

## Development

```sh
npm install
npm run test
npm run test:browser
npm run size:build
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
