import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { html, mount } from '../src/lib/dom';

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
    const handle = mount(html`<button onclick=${() => calls.push('first')}>Go</button>`, app);
    const button = app.querySelector('button')!;
    const addEventListener = button.addEventListener.bind(button);
    let added = 0;

    button.addEventListener = ((...args: Parameters<typeof button.addEventListener>) => {
      added++;
      return addEventListener(...args);
    }) as typeof button.addEventListener;

    handle.update(html`<button onclick=${() => calls.push('second')}>Go</button>`);
    button.click();

    assert.equal(app.querySelector('button'), button);
    assert.deepEqual(calls, ['second']);
    assert.equal(added, 0);
  });

  it('removes event listeners when the event disappears', () => {
    const app = setupDom();
    let calls = 0;
    const handle = mount(html`<button onclick=${() => calls++}>Go</button>`, app);
    const button = app.querySelector('button')!;

    handle.update(html`<button>Go</button>`);
    button.click();

    assert.equal(calls, 0);
  });

  it('reorders keyed children without replacing nodes', () => {
    const app = setupDom();
    const handle = mount(
      html`<ul><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>`,
      app,
    );
    const first = app.querySelector('[data-id="none"]');
    assert.equal(first, null);
    const items = Array.from(app.querySelectorAll('li'));

    handle.update(html`<ul><li key="c">C</li><li key="a">A!</li><li key="b">B</li></ul>`);

    const nextItems = Array.from(app.querySelectorAll('li'));
    assert.equal(nextItems[0], items[2]);
    assert.equal(nextItems[1], items[0]);
    assert.equal(nextItems[2], items[1]);
    assert.deepEqual(
      nextItems.map((item) => item.textContent),
      ['C', 'A!', 'B'],
    );
    assert.equal(nextItems.some((item) => item.hasAttribute('key')), false);
  });

  it('removes stale keyed children and inserts new ones', () => {
    const app = setupDom();
    const handle = mount(html`<ul><li key="a">A</li><li key="b">B</li></ul>`, app);
    const a = app.querySelector('li')!;

    handle.update(html`<ul><li key="a">A</li><li key="c">C</li></ul>`);

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
      html`<select value="a"><option value="a">A</option><option value="b">B</option></select>`,
      app,
    );

    handle.update(
      html`<select value="c"><option value="a">A</option><option value="c">C</option></select>`,
    );

    const select = app.querySelector('select')!;
    assert.equal(select.value, 'c');
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
    const Input = (value: string) => html`<input value=${value} />`;
    const view = (value: string) => html`<div>${Input(value)}</div>`;
    const handle = mount(view('a'), app);
    const input = app.querySelector('input')!;

    input.focus();
    handle.update(view('ab'));

    assert.equal(app.querySelector('input'), input);
    assert.equal(document.activeElement, input);
    assert.equal(input.value, 'ab');
  });
});
