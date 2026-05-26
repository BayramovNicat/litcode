import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { $derived, $effect, $state, html, mount, repeat } from '../src/lib';

function setupDom(): HTMLElement {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    pretendToBeVisual: true,
  });

  Object.assign(globalThis, {
    document: dom.window.document,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLOptionElement: dom.window.HTMLOptionElement,
    Event: dom.window.Event,
  });

  return dom.window.document.querySelector<HTMLElement>('#app')!;
}

describe('dom patching', () => {
  it('preserves focused input nodes while patching value', () => {
    const app = setupDom();
    const handle = mount(html`<input value="a" />`, app);
    const input = app.querySelector('input')!;

    input.focus();
    handle.update(html`<input value="ab" />`);

    assert.equal(app.querySelector('input'), input);
    assert.equal(document.activeElement, input);
    assert.equal(input.value, 'ab');
  });

  it('does not rewrite equal input values', () => {
    const app = setupDom();
    const handle = mount(html`<input value="hello" />`, app);
    const input = app.querySelector('input')!;
    input.setSelectionRange(2, 2);

    handle.update(html`<input value="hello" />`);

    assert.equal(app.querySelector('input'), input);
    assert.equal(input.selectionStart, 2);
    assert.equal(input.selectionEnd, 2);
  });

  it('replaces input nodes when type changes', () => {
    const app = setupDom();
    const handle = mount(html`<input type="text" value="x" />`, app);
    const input = app.querySelector('input')!;

    handle.update(html`<input type="checkbox" checked />`);

    const next = app.querySelector('input')!;
    assert.notEqual(next, input);
    assert.equal(next.type, 'checkbox');
    assert.equal(next.checked, true);
  });

  it('keeps one stable DOM event listener and updates handler', () => {
    const app = setupDom();
    const calls: string[] = [];
    const handle = mount(html`<button onclick="${() => calls.push('first')}">Go</button>`, app);
    const button = app.querySelector('button')!;
    const addEventListener = button.addEventListener.bind(button);
    let added = 0;

    button.addEventListener = ((...args: Parameters<typeof button.addEventListener>) => {
      added++;
      return addEventListener(...args);
    }) as typeof button.addEventListener;

    handle.update(html`<button onclick="${() => calls.push('second')}">Go</button>`);
    button.click();

    assert.equal(app.querySelector('button'), button);
    assert.deepEqual(calls, ['second']);
    assert.equal(added, 0);
  });

  it('removes event listeners when the event disappears', () => {
    const app = setupDom();
    let calls = 0;
    const handle = mount(html`<button onclick="${() => calls++}">Go</button>`, app);
    const button = app.querySelector('button')!;

    handle.update(html`<button>Go</button>`);
    button.click();

    assert.equal(calls, 0);
  });

  it('keeps event parts when the initial handler is missing', () => {
    const app = setupDom();
    let calls = 0;
    const view = (handler?: () => void) => html`<button onclick="${handler}">Go</button>`;
    const handle = mount(view(undefined), app);
    const button = app.querySelector('button')!;

    handle.update(view(() => calls++));
    button.click();

    assert.equal(calls, 1);
    assert.equal(button.hasAttribute('onclick'), false);
  });

  it('supports unquoted dynamic attributes and events', () => {
    const app = setupDom();
    let changes = 0;
    const view = (done: boolean, className: string) => html`
      <label class=${className}>
        <input type="checkbox" checked=${done} onchange=${() => changes++} />
      </label>
    `;
    const handle = mount(view(false, 'first active'), app);
    const label = app.querySelector('label')!;
    const input = app.querySelector('input')!;

    assert.equal(label.className, 'first active');
    assert.equal(input.checked, false);
    assert.equal(input.hasAttribute('checked'), false);
    assert.equal(input.hasAttribute('onchange'), false);

    input.dispatchEvent(new Event('change'));
    assert.equal(changes, 1);

    handle.update(view(true, 'second active'));

    assert.equal(app.querySelector('label'), label);
    assert.equal(app.querySelector('input'), input);
    assert.equal(label.className, 'second active');
    assert.equal(input.checked, true);

    input.dispatchEvent(new Event('change'));
    assert.equal(changes, 2);
  });

  it('reorders keyed children without replacing nodes', () => {
    const app = setupDom();
    const handle = mount(
      html`<ul>
        <li key="a">A</li>
        <li key="b">B</li>
        <li key="c">C</li>
      </ul>`,
      app,
    );
    const first = app.querySelector('[data-id="none"]');
    assert.equal(first, null);
    const items = Array.from(app.querySelectorAll('li'));

    handle.update(
      html`<ul>
        <li key="c">C</li>
        <li key="a">A!</li>
        <li key="b">B</li>
      </ul>`,
    );

    const nextItems = Array.from(app.querySelectorAll('li'));
    assert.equal(nextItems[0], items[2]);
    assert.equal(nextItems[1], items[0]);
    assert.equal(nextItems[2], items[1]);
    assert.deepEqual(
      nextItems.map((item) => item.textContent),
      ['C', 'A!', 'B'],
    );
    assert.equal(
      nextItems.some((item) => item.hasAttribute('key')),
      false,
    );
  });

  it('removes stale keyed children and inserts new ones', () => {
    const app = setupDom();
    const handle = mount(
      html`<ul>
        <li key="a">A</li>
        <li key="b">B</li>
      </ul>`,
      app,
    );
    const a = app.querySelector('li')!;

    handle.update(
      html`<ul>
        <li key="a">A</li>
        <li key="c">C</li>
      </ul>`,
    );

    const items = Array.from(app.querySelectorAll('li'));
    assert.equal(items[0], a);
    assert.deepEqual(
      items.map((item) => item.textContent),
      ['A', 'C'],
    );
  });

  it('syncs select value after option children change', () => {
    const app = setupDom();
    const handle = mount(
      html`<select value="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </select>`,
      app,
    );

    handle.update(
      html`<select value="c">
        <option value="a">A</option>
        <option value="c">C</option>
      </select>`,
    );

    const select = app.querySelector('select')!;
    assert.equal(select.value, 'c');
  });

  it('cleans up undefined dynamic attributes in repeated options', () => {
    const app = setupDom();
    const items = [{ key: 'all', value: 'All' }];

    mount(
      html`<select>
        ${repeat(
          items,
          (item) => item.key,
          (item) => html`
            <option value="${item.key}" disabled="${undefined}" selected="${undefined}">
              ${item.value}
            </option>
          `,
        )}
      </select>`,
      app,
    );

    const option = app.querySelector('option')!;
    assert.equal(option.value, 'all');
    assert.equal(option.hasAttribute('disabled'), false);
    assert.equal(option.hasAttribute('selected'), false);
    assert.equal(option.textContent?.trim(), 'All');
  });

  it('supports dynamic attributes inside quoted attributes', () => {
    const app = setupDom();
    const handle = mount(html`<button class="${'first'}">Go</button>`, app);
    const button = app.querySelector('button')!;

    assert.equal(button.className, 'first');

    handle.update(html`<button class="${'second'}">Go</button>`);

    assert.equal(app.querySelector('button'), button);
    assert.equal(button.className, 'second');
  });

  it('preserves focused component fragment inputs across root updates', () => {
    const app = setupDom();
    const Input = (value: string) => html`<input value="${value}" />`;
    const view = (value: string) => html`<div>${Input(value)}</div>`;
    const handle = mount(view('a'), app);
    const input = app.querySelector('input')!;

    input.focus();
    handle.update(view('ab'));

    assert.equal(app.querySelector('input'), input);
    assert.equal(document.activeElement, input);
    assert.equal(input.value, 'ab');
  });

  it('reorders repeated keyed templates without replacing nodes', () => {
    const app = setupDom();
    const view = (items: string[]) =>
      html`<ul>
        ${repeat(
          items,
          (item) => item,
          (item) => html`<li>${item}</li>`,
        )}
      </ul>`;
    const handle = mount(view(['a', 'b', 'c']), app);
    const items = Array.from(app.querySelectorAll('li'));

    handle.update(view(['c', 'a', 'b']));

    const nextItems = Array.from(app.querySelectorAll('li'));
    assert.equal(nextItems[0], items[2]);
    assert.equal(nextItems[1], items[0]);
    assert.equal(nextItems[2], items[1]);
    assert.deepEqual(
      nextItems.map((item) => item.textContent),
      ['c', 'a', 'b'],
    );
  });

  it('switches repeated child parts to non-repeat views', () => {
    const app = setupDom();
    const view = (content: unknown) => html`<section>${content}</section>`;
    const list = (items: string[]) =>
      repeat(
        items,
        (item) => item,
        (item) => html`<span>${item}</span>`,
      );
    const handle = mount(view(list(['a', 'b'])), app);

    handle.update(view('done'));

    assert.equal(app.querySelector('span'), null);
    assert.equal(app.textContent, 'done');

    handle.update(view(list(['c'])));

    assert.deepEqual(
      Array.from(app.querySelectorAll('span'), (item) => item.textContent),
      ['c'],
    );
  });

  it('updates rune child parts without calling handle.update', async () => {
    const app = setupDom();
    const count = $state(0);

    mount(html`<button>Count ${count}</button>`, app);

    assert.equal(app.textContent, 'Count 0');

    count.value = 1;
    count.value = 2;

    await Promise.resolve();

    assert.equal(app.textContent, 'Count 2');
  });

  it('updates reactive attribute parts without calling handle.update', async () => {
    const app = setupDom();
    const value = $state('a');

    mount(html`<input value="${value}" />`, app);
    const input = app.querySelector('input')!;

    assert.equal(input.value, 'a');

    value.value = 'ab';

    await Promise.resolve();

    assert.equal(app.querySelector('input'), input);
    assert.equal(input.value, 'ab');
  });

  it('batches multiple synchronous state changes into one effect run', async () => {
    const count = $state(0);
    let runs = 0;

    const stop = $effect(() => {
      runs++;
      count.value;
    });

    count.value = 1;
    count.value = 2;
    count.value = 3;

    assert.equal(runs, 1);

    await Promise.resolve();

    assert.equal(runs, 2);
    stop();
  });

  it('switches reactive part source when template is updated', async () => {
    const app = setupDom();
    const first = $state('first');
    const second = $state('second');
    const view = (value: unknown) => html`<p>${value}</p>`;
    const handle = mount(view(first), app);

    handle.update(view(second));

    first.value = 'stale';
    second.value = 'fresh';

    await Promise.resolve();

    assert.equal(app.textContent, 'fresh');
  });

  it('removes stale dependencies when effects rerun', async () => {
    const useFirst = $state(true);
    const first = $state('a');
    const second = $state('b');
    const value = $derived(() => (useFirst.value ? first.value : second.value));
    const app = setupDom();

    mount(html`<span>${value}</span>`, app);

    useFirst.value = false;
    await Promise.resolve();

    first.value = 'stale';
    second.value = 'fresh';
    await Promise.resolve();

    assert.equal(app.textContent, 'fresh');
  });

  it('cleans up reactive template parts on destroy', async () => {
    const app = setupDom();
    const count = $state(0);
    const handle = mount(html`<span>${count}</span>`, app);

    handle.destroy();
    count.value = 1;

    await Promise.resolve();

    assert.equal(app.textContent, '');
  });

  it('updates live DOM after switching root template shapes', () => {
    const app = setupDom();
    const calls: string[] = [];
    const first = (handler: () => void, label: string) =>
      html`<button onclick=${handler}>${label}</button>`;
    const second = (handler: () => void, label: string) =>
      html`<button class="next" onclick=${handler}>${label}</button>`;
    const handle = mount(
      first(() => calls.push('first'), 'First'),
      app,
    );

    handle.update(second(() => calls.push('second'), 'Second'));
    app.querySelector('button')!.click();

    handle.update(second(() => calls.push('third'), 'Third'));
    app.querySelector('button')!.click();

    assert.equal(app.innerHTML, '<button class="next">Third<!--litcode-part-1--></button>');
    assert.deepEqual(calls, ['second', 'third']);
  });

  it('updates live DOM after switching child template shapes', () => {
    const app = setupDom();
    const first = (label: string) => html`<span>${label}</span>`;
    const second = (label: string) => html`<strong>${label}</strong>`;
    const view = (child: unknown) => html`<p>${child}</p>`;
    const handle = mount(view(first('First')), app);

    handle.update(view(second('Second')));
    handle.update(view(second('Third')));

    assert.equal(
      app.innerHTML,
      '<p><strong>Third<!--litcode-part-0--></strong><!--litcode-part-0--></p>',
    );
  });

  it('updates live DOM after switching template array shapes', () => {
    const app = setupDom();
    const first = (label: string) => html`<span>${label}</span>`;
    const second = (label: string) => html`<strong>${label}</strong>`;
    const view = (items: unknown[]) => html`<p>${items}</p>`;
    const handle = mount(view([first('First')]), app);

    handle.update(view([second('Second')]));
    handle.update(view([second('Third')]));

    assert.equal(
      app.innerHTML,
      '<p><strong>Third<!--litcode-part-0--></strong><!--litcode-part-0--></p>',
    );
  });

  it('removes template event listeners on destroy', () => {
    const app = setupDom();
    let calls = 0;
    const handle = mount(html`<button onclick=${() => calls++}>Go</button>`, app);
    const button = app.querySelector('button')!;

    handle.destroy();
    button.click();

    assert.equal(calls, 0);
  });
});
