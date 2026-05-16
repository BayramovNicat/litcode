import {
  $derived,
  $effect,
  $state,
  cn,
  component,
  createElement,
  html,
  mount,
  repeat,
  tv,
  type Props,
  type VariantProps,
  type View,
} from './lib';
import './style.css';
import { Button, buttonVariants } from './components/Button';
import { Input } from './components/Input';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

type Todo = {
  id: number;
  title: string;
  done: boolean;
};

const count = $state(0);
const step = $state(1);
const name = $state('litcode');
const enabled = $state(true);
const theme = $state<'light' | 'dark'>('light');
const note = $state('Edit me live');
const todos = $state<Todo[]>([
  { id: 1, title: 'Create templates', done: true },
  { id: 2, title: 'Pass component props', done: true },
  { id: 3, title: 'Patch keyed lists', done: false },
]);
const log = $state<string[]>(['App mounted']);
const copiedCode = $state('');

const doubled = $derived(() => count.value * 2);
const completedTodos = $derived(() => todos.value.filter((todo) => todo.done).length);
const greeting = $derived(() => `Hello, ${name.value || 'friend'}!`);

const statCard = tv({
  base: 'rounded-2xl border bg-card p-4 shadow-sm transition',
  variants: {
    tone: {
      neutral: 'border-border',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      info: 'border-sky-200 bg-sky-50 text-sky-950',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
});

type StatCardProps = Props<{
  label: string;
  value: string | number;
}> &
  VariantProps<typeof statCard>;

const StatCard = component<StatCardProps>(({ label, value, tone = 'neutral' }) => {
  return html`
    <article class="${statCard({ tone })}">
      <p class="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">${label}</p>
      <strong class="mt-2 block text-3xl font-black tracking-tight">${value}</strong>
    </article>
  `;
});

type CodeToken = {
  text: string;
  className: string;
};

function highlightCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;

  while (cursor < code.length) {
    const index = code.indexOf('html`', cursor);
    if (index === -1) break;

    if (index > cursor) tokens.push(...highlightTs(code.slice(cursor, index)));

    const end = findTemplateEnd(code, index + 4);
    const templateEnd = end === -1 ? code.length : end;
    const templateBody = code.slice(index + 5, templateEnd);

    tokens.push({ text: 'html', className: 'text-sky-300' });
    tokens.push({ text: '`', className: 'text-emerald-300' });
    tokens.push(...highlightHtmlTemplate(templateBody));
    if (end !== -1) tokens.push({ text: '`', className: 'text-emerald-300' });

    cursor = end === -1 ? code.length : end + 1;
  }

  if (cursor < code.length) tokens.push(...highlightTs(code.slice(cursor)));
  return tokens;
}

function findTemplateEnd(source: string, backtickIndex: number): number {
  for (let index = backtickIndex + 1; index < source.length; index++) {
    const char = source[index];

    if (char === '\\') {
      index++;
      continue;
    }

    if (char === '`') return index;

    if (char === '$' && source[index + 1] === '{') {
      const expressionEnd = findExpressionEnd(source, index + 2);
      if (expressionEnd === -1) return -1;
      index = expressionEnd;
    }
  }

  return -1;
}

function findExpressionEnd(source: string, start: number): number {
  let depth = 1;

  for (let index = start; index < source.length; index++) {
    const char = source[index];

    if (char === '\\') {
      index++;
      continue;
    }

    if (char === '"' || char === "'") {
      index = findQuotedStringEnd(source, index, char);
      if (index === -1) return -1;
      continue;
    }

    if (char === '`') {
      index = findTemplateEnd(source, index);
      if (index === -1) return -1;
      continue;
    }

    if (char === '{') {
      depth++;
      continue;
    }

    if (char === '}') {
      depth--;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function findQuotedStringEnd(source: string, start: number, quote: string): number {
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++;
      continue;
    }

    if (source[index] === quote) return index;
  }

  return -1;
}

function highlightTs(code: string): CodeToken[] {
  const pattern =
    /(\/\/.*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\b(?:import|from|type|const|let|function|return|if|throw|new|true|false|null|undefined|as|extends)\b|\b(?:html|component|createElement|mount|repeat|tv|cn|Props|VariantProps|View|Button|Input|Section|CodeBlock|document|console|Math|String)\b|\$state|\$derived|\$effect|\b\d+\b)/g;
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      tokens.push({ text: code.slice(cursor, index), className: 'text-slate-200' });

    const text = match[0];
    const className = text.startsWith('//')
      ? 'text-slate-500 italic'
      : text.startsWith('`') || text.startsWith('"') || text.startsWith("'")
        ? 'text-emerald-300'
        : text.startsWith('$')
          ? 'text-fuchsia-300'
          : /^\d+$/.test(text)
            ? 'text-amber-300'
            : /^(html|component|createElement|mount|repeat|tv|cn|Props|VariantProps|View|Button|Input|Section|CodeBlock|document|console|Math)$/.test(
                  text,
                )
              ? 'text-sky-300'
              : 'text-violet-300';

    tokens.push({ text, className });
    cursor = index + text.length;
  }

  if (cursor < code.length) tokens.push({ text: code.slice(cursor), className: 'text-slate-200' });
  return tokens;
}

function highlightHtmlTemplate(source: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const index = source.indexOf('${', cursor);
    if (index === -1) break;

    if (index > cursor) tokens.push(...highlightHtml(source.slice(cursor, index)));

    tokens.push({ text: '${', className: 'text-fuchsia-300' });
    const expressionEnd = findExpressionEnd(source, index + 2);

    if (expressionEnd === -1) {
      tokens.push(...highlightCode(source.slice(index + 2)));
      cursor = source.length;
    } else {
      tokens.push(...highlightCode(source.slice(index + 2, expressionEnd)));
      tokens.push({ text: '}', className: 'text-fuchsia-300' });
      cursor = expressionEnd + 1;
    }
  }

  if (cursor < source.length) tokens.push(...highlightHtml(source.slice(cursor)));
  return tokens;
}

function highlightHtml(source: string): CodeToken[] {
  const pattern = /(<!--[^]*?-->|<\/?[a-zA-Z][\w-]*|\/?>|\s[a-zA-Z_:][\w:.-]*(?==)|=(?=["']))/g;
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push(...highlightHtmlText(source.slice(cursor, index)));

    const text = match[0];
    const className = text.startsWith('<!--')
      ? 'text-slate-500 italic'
      : text.startsWith('<') || text === '>' || text === '/>'
        ? 'text-sky-300'
        : text === '='
          ? 'text-slate-400'
          : 'text-amber-300';

    tokens.push({ text, className });
    cursor = index + text.length;
  }

  if (cursor < source.length) tokens.push(...highlightHtmlText(source.slice(cursor)));
  return tokens;
}

function highlightHtmlText(source: string): CodeToken[] {
  const pattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      tokens.push({ text: source.slice(cursor, index), className: 'text-slate-200' });
    tokens.push({ text: match[0], className: 'text-emerald-300' });
    cursor = index + match[0].length;
  }

  if (cursor < source.length)
    tokens.push({ text: source.slice(cursor), className: 'text-slate-200' });
  return tokens;
}

async function copyCode(title: string, code: string): Promise<void> {
  await navigator.clipboard.writeText(code);
  copiedCode.value = title;
  window.setTimeout(() => {
    if (copiedCode.value === title) copiedCode.value = '';
  }, 1400);
}

const CodeBlock = component<Props<{ title: string; code: string }>>(({ title, code }) => {
  const lines = highlightCode(code);
  const isCopied = copiedCode.value === title;

  return html`
    <figure
      class="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/20"
    >
      <button
        type="button"
        aria-label="Copy ${title} example"
        class="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg border border-slate-700 bg-slate-900/90 text-slate-200 opacity-0 shadow-lg transition hover:border-slate-500 hover:bg-slate-800 group-hover:opacity-100 focus:opacity-100"
        onclick="${() => copyCode(title, code)}"
      >
        ${isCopied
          ? html`<svg class="size-4 text-emerald-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>`
          : html`<svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="9"
                y="9"
                width="10"
                height="10"
                rx="2"
                stroke="currentColor"
                stroke-width="2"
              />
              <path
                d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>`}
      </button>
      <pre class="max-h-[34rem] overflow-auto p-4 text-sm leading-6"><code class="font-mono">${lines.map(
        (token) => html`<span class="${token.className}">${token.text}</span>`,
      )}</code></pre>
    </figure>
  `;
});

const Section = component<Props<{ eyebrow: string; title: string; description: string }>>(
  ({ eyebrow, title, description, children }) => {
    return html`
      <section class="grid gap-5 rounded-3xl border bg-card p-6 shadow-xl shadow-slate-950/5">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
            ${eyebrow}
          </p>
          <h2 class="mt-2 text-3xl font-black tracking-[-0.04em]">${title}</h2>
          <p class="mt-2 max-w-3xl leading-7 text-muted-foreground">${description}</p>
        </div>
        ${children}
      </section>
    `;
  },
);

function addLog(message: string): void {
  log.value = [`${new Date().toLocaleTimeString()} · ${message}`, ...log.value].slice(0, 6);
}

function updateStep(event: Event): void {
  const next = Number((event.currentTarget as HTMLInputElement).value);
  step.value = Number.isFinite(next) && next > 0 ? next : 1;
}

function updateName(event: Event): void {
  name.value = (event.currentTarget as HTMLInputElement).value;
}

function updateNote(event: Event): void {
  note.value = (event.currentTarget as HTMLTextAreaElement).value;
}

function addTodo(): void {
  const id = Math.max(0, ...todos.value.map((todo) => todo.id)) + 1;
  todos.value = [...todos.value, { id, title: `New item ${id}`, done: false }];
  addLog(`Added todo #${id}`);
}

function toggleTodo(id: number): void {
  todos.value = todos.value.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
}

function removeTodo(id: number): void {
  todos.value = todos.value.filter((todo) => todo.id !== id);
  addLog(`Removed todo #${id}`);
}

function shuffleTodos(): void {
  todos.value = [...todos.value].reverse();
  addLog('Reversed keyed list');
}

function setTheme(next: 'light' | 'dark'): void {
  theme.value = next;
  document.documentElement.classList.toggle('dark', next === 'dark');
  addLog(`Theme changed to ${next}`);
}

function Hero(): View {
  return html`
    <section class="grid gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div>
        <p class="text-sm font-black uppercase tracking-[0.28em] text-muted-foreground">
          complete showcase
        </p>
        <h1 class="mt-4 text-5xl font-black tracking-[-0.065em] sm:text-7xl">
          Every litcode feature on one page.
        </h1>
        <p class="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Templates, reactive runes, derived values, effects, events, attributes, boolean props,
          components, children, root prop forwarding, keyed repeat, variants, class merging, DOM
          nodes, arrays, and mounting are all demonstrated below with copyable examples.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          ${Button({
            size: 'lg',
            onclick: () => (count.value += step.value),
            children: 'Increment counter',
          })}
          ${Button({
            variant: 'outline',
            size: 'lg',
            onclick: () => addLog('Hero action clicked'),
            children: 'Write log',
          })}
        </div>
      </div>
      <div class="grid gap-3">
        ${StatCard({ label: 'count', value: count.value, tone: 'info' })}
        ${StatCard({ label: 'doubled', value: doubled.value, tone: 'success' })}
        ${StatCard({
          label: 'todos complete',
          value: `${completedTodos.value}/${todos.value.length}`,
        })}
      </div>
    </section>
  `;
}

function TemplateDemo(): View {
  const maybeNode = document.createElement('strong');
  maybeNode.className = 'text-primary';
  maybeNode.textContent = 'real DOM Node';

  return Section({
    eyebrow: 'html template tag',
    title: 'Children, attributes, booleans, arrays, DOM nodes',
    description:
      'The html tag returns a cached TemplateResult. Dynamic parts update without replacing the whole DOM tree.',
    children: html`
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div class="grid gap-3 rounded-2xl bg-muted p-4">
          <p id="dynamic-title" class="font-bold" data-name="${name.value}">${greeting.value}</p>
          <button
            class="${buttonVariants({ variant: enabled.value ? 'default' : 'secondary' })}"
            disabled="${!enabled.value}"
            onclick="${() => addLog('Template button clicked')}"
          >
            ${enabled.value ? 'Enabled dynamic button' : 'Disabled via boolean attribute'}
          </button>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked="${enabled.value}"
              onchange="${() => (enabled.value = !enabled.value)}"
            />
            Toggle disabled/checked attributes
          </label>
          <p>
            Array children:
            ${['text, ', html`<span class="font-bold">template, </span>`, maybeNode]}
          </p>
          <p>Null and false render nothing: ${null}${false}</p>
        </div>
        ${CodeBlock({
          title: 'TemplateDemo.ts',
          code: `function TemplateDemo(): View {
  const maybeNode = document.createElement('strong');
  maybeNode.className = 'text-primary';
  maybeNode.textContent = 'real DOM Node';

  return html\`
    <p id="dynamic-title" class="font-bold" data-name="\${name.value}">
      \${greeting.value}
    </p>
    <button
      class="\${buttonVariants({ variant: enabled.value ? 'default' : 'secondary' })}"
      disabled="\${!enabled.value}"
      onclick="\${() => addLog('Template button clicked')}"
    >
      \${enabled.value ? 'Enabled dynamic button' : 'Disabled via boolean attribute'}
    </button>
    <input
      type="checkbox"
      checked="\${enabled.value}"
      onchange="\${() => (enabled.value = !enabled.value)}"
    />
    <p>
      Array children: \${['text, ', html\`<span>template, </span>\`, maybeNode]}
    </p>
    <p>Null and false render nothing: \${null}\${false}</p>
  \`;
}`,
        })}
      </div>
    `,
  });
}

function RunesDemo(): View {
  return Section({
    eyebrow: 'runes',
    title: '$state, $derived, and $effect',
    description:
      'Read .value to track dependencies. Assign .value to notify subscribers. Effects batch in a microtask.',
    children: html`
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div class="grid gap-4 rounded-2xl bg-muted p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-2 text-sm font-medium">
              Step size
              ${Input({ type: 'number', min: '1', value: String(step.value), oninput: updateStep })}
            </label>
            <label class="grid gap-2 text-sm font-medium">
              Name ${Input({ value: name.value, oninput: updateName })}
            </label>
          </div>
          <div class="flex flex-wrap gap-3">
            ${Button({ onclick: () => (count.value += step.value), children: `Add ${step.value}` })}
            ${Button({
              variant: 'secondary',
              onclick: () => (count.value -= step.value),
              children: `Subtract ${step.value}`,
            })}
            ${Button({ variant: 'outline', onclick: () => (count.value = 0), children: 'Reset' })}
          </div>
          <div class="grid grid-cols-3 gap-3 text-center">
            ${StatCard({ label: 'state', value: count.value })}
            ${StatCard({ label: 'derived', value: doubled.value, tone: 'info' })}
            ${StatCard({ label: 'greeting', value: name.value || 'friend', tone: 'success' })}
          </div>
        </div>
        ${CodeBlock({
          title: 'RunesDemo.ts',
          code: `const count = $state(0);
const step = $state(1);
const name = $state('litcode');

const doubled = $derived(() => count.value * 2);
const greeting = $derived(() => \`Hello, \${name.value || 'friend'}!\`);

$effect(() => {
  console.log('count changed:', count.value, 'doubled:', doubled.value);
});

function CounterControls(): View {
  return html\`
    \${Input({ type: 'number', value: String(step.value), oninput: updateStep })}
    \${Input({ value: name.value, oninput: updateName })}
    \${Button({ onclick: () => (count.value += step.value), children: \`Add \${step.value}\` })}
    <p>\${greeting.value} Count: \${count.value}. Doubled: \${doubled.value}</p>
  \`;
}`,
        })}
      </div>
    `,
  });
}

function ComponentsDemo(): View {
  return Section({
    eyebrow: 'components',
    title: 'Typed props, children, and root prop forwarding',
    description:
      'component() wraps a render function. DOM props like id, dataset, onclick, value, and className are applied to the first rendered element.',
    children: html`
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div class="grid gap-3 rounded-2xl bg-muted p-4">
          ${createElement(
            Button,
            { variant: 'default', onclick: () => addLog('createElement Button clicked') },
            'createElement child',
          )}
          ${Button({
            variant: 'outline',
            id: 'forwarded-button',
            dataset: { demo: 'props' },
            className: 'border-dashed',
            onclick: () => addLog('Forwarded onclick prop fired'),
            children: 'Forwarded id, dataset, className, onclick',
          })}
          ${Input({ placeholder: 'Forwarded input value', value: note.value, oninput: updateNote })}
          <p class="text-sm text-muted-foreground">Input state: ${note.value}</p>
        </div>
        ${CodeBlock({
          title: 'ComponentsDemo.ts',
          code: `const Section = component<Props<{ eyebrow: string; title: string; description: string }>>(
  ({ eyebrow, title, description, children }) => {
    return html\`
      <section class="grid gap-5 rounded-3xl border bg-card p-6">
        <p>\${eyebrow}</p>
        <h2>\${title}</h2>
        <p>\${description}</p>
        \${children}
      </section>
    \`;
  },
);

const rendered = createElement(
  Button,
  { variant: 'default', onclick: () => addLog('createElement Button clicked') },
  'createElement child',
);

Button({
  variant: 'outline',
  id: 'forwarded-button',
  dataset: { demo: 'props' },
  className: 'border-dashed',
  onclick: () => addLog('Forwarded onclick prop fired'),
  children: 'Forwarded id, dataset, className, onclick',
});`,
        })}
      </div>
    `,
  });
}

function RepeatDemo(): View {
  return Section({
    eyebrow: 'repeat',
    title: 'Keyed list patching',
    description:
      'repeat(items, key, render) reuses and moves existing blocks by key instead of recreating every row.',
    children: html`
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div class="grid gap-3 rounded-2xl bg-muted p-4">
          <div class="flex flex-wrap gap-3">
            ${Button({ onclick: addTodo, children: 'Add todo' })}
            ${Button({ variant: 'secondary', onclick: shuffleTodos, children: 'Reverse order' })}
          </div>
          <ul class="grid gap-2">
            ${repeat(
              todos.value,
              (todo) => todo.id,
              (todo, index) => html`
                <li
                  key="${todo.id}"
                  class="flex items-center gap-3 rounded-xl border bg-background p-3"
                >
                  <span
                    class="grid size-7 place-items-center rounded-full bg-secondary text-xs font-black"
                    >${index + 1}</span
                  >
                  <label class="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked="${todo.done}"
                      onchange="${() => toggleTodo(todo.id)}"
                    />
                    <span class="${cn(todo.done && 'line-through text-muted-foreground')}"
                      >${todo.title}</span
                    >
                  </label>
                  ${Button({
                    variant: 'ghost',
                    size: 'sm',
                    onclick: () => removeTodo(todo.id),
                    children: 'Remove',
                  })}
                </li>
              `,
            )}
          </ul>
        </div>
        ${CodeBlock({
          title: 'RepeatDemo.ts',
          code: `function RepeatDemo(): View {
  return html\`
    <ul class="grid gap-2">
      \${repeat(
        todos.value,
        (todo) => todo.id,
        (todo, index) => html\`
          <li
            key="\${todo.id}"
            class="flex items-center gap-3 rounded-xl border bg-background p-3"
          >
            <span>\${index + 1}</span>
            <input
              type="checkbox"
              checked="\${todo.done}"
              onchange="\${() => toggleTodo(todo.id)}"
            />
            <span class="\${cn(todo.done && 'line-through text-muted-foreground')}">
              \${todo.title}
            </span>
            \${Button({
              variant: 'ghost',
              size: 'sm',
              onclick: () => removeTodo(todo.id),
              children: 'Remove',
            })}
          </li>
        \`,
      )}
    </ul>
  \`;
}`,
        })}
      </div>
    `,
  });
}

function VariantsDemo(): View {
  return Section({
    eyebrow: 'variants',
    title: 'cn(), tv(), and typed variant props',
    description:
      'cn merges conditional classes with tailwind-merge. tv builds typed variant factories used by Button and custom cards.',
    children: html`
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div class="grid gap-3 rounded-2xl bg-muted p-4">
          <div class="flex flex-wrap gap-3">
            ${(['default', 'secondary', 'outline', 'destructive', 'ghost', 'link'] as const).map(
              (variant) => Button({ variant, children: variant }),
            )}
          </div>
          <div class="flex flex-wrap gap-3">
            ${(['sm', 'default', 'lg', 'icon'] as const).map((size) =>
              Button({ size, variant: 'outline', children: size === 'icon' ? '★' : size }),
            )}
          </div>
          <p
            class="${cn(
              'rounded-xl p-3',
              enabled.value ? 'bg-emerald-100 text-emerald-950' : 'bg-slate-200',
            )}"
          >
            cn() conditional class output changes with the enabled toggle.
          </p>
        </div>
        ${CodeBlock({
          title: 'variants.ts',
          code: `const buttonVariants = tv({
  base: 'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium',
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
      outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
    },
    size: {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3',
      lg: 'h-10 rounded-md px-6',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ButtonProps = Props<Partial<HTMLButtonElement>> & VariantProps<typeof buttonVariants>;

const Button = component<ButtonProps>(({ variant, size, className, children } = {}) => {
  return html\`
    <button class="\${cn(buttonVariants({ variant, size }), className)}">
      \${children ?? ''}
    </button>
  \`;
});`,
        })}
      </div>
    `,
  });
}

function MountDemo(): View {
  return Section({
    eyebrow: 'mount / render',
    title: 'Mount once, update from an effect',
    description:
      'The app is mounted once. A top-level effect rerenders the root TemplateResult whenever tracked runes change.',
    children: html`
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div class="rounded-2xl bg-muted p-4">
          <div class="flex flex-wrap gap-3">
            ${Button({
              variant: theme.value === 'light' ? 'default' : 'outline',
              onclick: () => setTheme('light'),
              children: 'Light theme',
            })}
            ${Button({
              variant: theme.value === 'dark' ? 'default' : 'outline',
              onclick: () => setTheme('dark'),
              children: 'Dark theme',
            })}
          </div>
          <ul class="mt-4 grid gap-2 text-sm text-muted-foreground">
            ${log.value.map(
              (entry) => html`<li class="rounded-lg bg-background px-3 py-2">${entry}</li>`,
            )}
          </ul>
        </div>
        ${CodeBlock({
          title: 'main.ts',
          code: `const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

const App = component(() => HomePage());
const handle = mount(App(), app);

$effect(() => {
  handle.update(App());
});

// Later, if needed:
// handle.destroy();`,
        })}
      </div>
    `,
  });
}

function ApiOverview(): View {
  return Section({
    eyebrow: 'exports',
    title: 'Everything exported by ./lib',
    description: 'The main runtime API is intentionally small and TypeScript-first.',
    children: html`
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        ${[
          ['html', 'Template literal for DOM views'],
          ['repeat', 'Keyed list rendering'],
          ['component', 'Typed render function wrapper'],
          ['createElement', 'JSX-like component invocation'],
          ['mount / render', 'Attach and update views'],
          ['$state', 'Writable reactive value'],
          ['$derived', 'Readonly computed value'],
          ['$effect', 'Tracked side effects with cleanup'],
          ['cn / tv', 'Class merge and variants'],
          ['Props / View / VariantProps', 'Types for components'],
        ].map(
          ([name, text]) => html`
            <article class="rounded-2xl border bg-background p-4">
              <h3 class="font-black">${name}</h3>
              <p class="mt-1 text-sm text-muted-foreground">${text}</p>
            </article>
          `,
        )}
      </div>
    `,
  });
}

function HomePage(): View {
  return html`
    <main class="min-h-screen bg-background px-6 py-8 text-foreground">
      <div class="mx-auto grid max-w-6xl gap-8">
        <nav class="flex flex-wrap items-center justify-between gap-3">
          <strong class="text-xl font-black tracking-tighter">litcode</strong>
          <div class="flex flex-wrap gap-2 text-xs font-bold">
            <span class="rounded-full bg-secondary px-3 py-1 text-secondary-foreground"
              >TypeScript UI runtime</span
            >
            <span class="rounded-full bg-primary px-3 py-1 text-primary-foreground"
              >${theme.value} mode</span
            >
          </div>
        </nav>
        ${Hero()} ${ApiOverview()} ${TemplateDemo()} ${RunesDemo()} ${ComponentsDemo()}
        ${RepeatDemo()} ${VariantsDemo()} ${MountDemo()}
      </div>
    </main>
  `;
}

const App = component(() => HomePage());
const handle = mount(App(), app);

$effect(() => {
  handle.update(App());
});
