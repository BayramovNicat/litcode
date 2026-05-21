import { $derived, $state, html, mount, repeat } from '../src/lib';

type BrowserTest = {
  name: string;
  run(): void | Promise<void>;
};

type BrowserTestResult = {
  name: string;
  status: 'passed' | 'failed';
  durationMs: number;
  message?: string;
  stack?: string;
};

declare global {
  interface Window {
    __litcodeBrowserTestsDone?: boolean;
    __litcodeBrowserTestResults?: BrowserTestResult[];
  }
}

const tests: BrowserTest[] = [];
const app = document.querySelector<HTMLElement>('#app');

if (!app) throw new Error('Browser test root not found');

function test(name: string, run: BrowserTest['run']): void {
  tests.push({ name, run });
}

function resetTarget(): HTMLElement {
  app.replaceChildren();
  const target = document.createElement('div');
  app.appendChild(target);
  return target;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function deepEqual<T>(actual: T[], expected: T[], message: string): void {
  if (actual.length !== expected.length) {
    throw new Error(`${message}: expected length ${expected.length}, got ${actual.length}`);
  }

  for (let index = 0; index < expected.length; index++) {
    if (!Object.is(actual[index], expected[index])) {
      throw new Error(
        `${message}: expected ${String(expected[index])} at ${index}, got ${String(actual[index])}`,
      );
    }
  }
}

function nextMicrotask(): Promise<void> {
  return Promise.resolve();
}

test('preserves focused input nodes and equal-value selections', () => {
  const target = resetTarget();
  const handle = mount(html`<input value="hello" />`, target);
  const input = target.querySelector('input');

  assert(input, 'input should be rendered');
  input.focus();
  input.setSelectionRange(2, 2);

  handle.update(html`<input value="hello" />`);

  equal(target.querySelector('input'), input, 'input node should be preserved');
  equal(document.activeElement, input, 'input should remain focused');
  equal(input.selectionStart, 2, 'selectionStart should be preserved');
  equal(input.selectionEnd, 2, 'selectionEnd should be preserved');

  handle.update(html`<input value="hello!" />`);

  equal(target.querySelector('input'), input, 'input node should survive value patch');
  equal(document.activeElement, input, 'input should stay focused after value patch');
  equal(input.value, 'hello!', 'input value should update');
});

test('replaces input nodes when browser input type changes', () => {
  const target = resetTarget();
  const handle = mount(html`<input type="text" value="x" />`, target);
  const input = target.querySelector('input');

  assert(input, 'input should be rendered');

  handle.update(html`<input type="checkbox" checked />`);

  const next = target.querySelector('input');
  assert(next, 'replacement input should be rendered');
  assert(next !== input, 'input node should be replaced');
  equal(next.type, 'checkbox', 'replacement input should have the next type');
  equal(next.checked, true, 'replacement input should sync checked');
});

test('keeps a stable event listener while updating handlers', () => {
  const target = resetTarget();
  const calls: string[] = [];
  const handle = mount(html`<button onclick="${() => calls.push('first')}">Go</button>`, target);
  const button = target.querySelector('button');

  assert(button, 'button should be rendered');
  button.click();

  const addEventListener = button.addEventListener.bind(button);
  let added = 0;
  button.addEventListener = ((...args: Parameters<typeof button.addEventListener>) => {
    added++;
    return addEventListener(...args);
  }) as typeof button.addEventListener;

  handle.update(html`<button onclick="${() => calls.push('second')}">Go</button>`);
  button.click();

  equal(target.querySelector('button'), button, 'button node should be preserved');
  deepEqual(calls, ['first', 'second'], 'updated handler should be called');
  equal(added, 0, 'listener should not be re-added during handler update');
  equal(button.hasAttribute('onclick'), false, 'event marker should not leave inline handlers');
});

test('removes browser event listeners when event parts disappear', () => {
  const target = resetTarget();
  let calls = 0;
  const handle = mount(html`<button onclick="${() => calls++}">Go</button>`, target);
  const button = target.querySelector('button');

  assert(button, 'button should be rendered');

  handle.update(html`<button>Go</button>`);
  button.click();

  equal(calls, 0, 'removed event handler should not fire');
});

test('reorders keyed repeat blocks without replacing DOM nodes', () => {
  const target = resetTarget();
  const view = (items: string[]) =>
    html`<ul>
      ${repeat(
        items,
        (item) => item,
        (item) => html`<li>${item}</li>`,
      )}
    </ul>`;
  const handle = mount(view(['a', 'b', 'c']), target);
  const items = Array.from(target.querySelectorAll('li'));

  handle.update(view(['c', 'a', 'b']));

  const nextItems = Array.from(target.querySelectorAll('li'));
  equal(nextItems[0], items[2], 'first item should reuse previous c node');
  equal(nextItems[1], items[0], 'second item should reuse previous a node');
  equal(nextItems[2], items[1], 'third item should reuse previous b node');
  deepEqual(
    nextItems.map((item) => item.textContent),
    ['c', 'a', 'b'],
    'reordered text should match',
  );
});

test('syncs select value after option children change', () => {
  const target = resetTarget();
  const handle = mount(
    html`<select value="a">
      <option value="a">A</option>
      <option value="b">B</option>
    </select>`,
    target,
  );

  handle.update(
    html`<select value="c">
      <option value="a">A</option>
      <option value="c">C</option>
    </select>`,
  );

  const select = target.querySelector('select');
  assert(select, 'select should be rendered');
  equal(select.value, 'c', 'select value should follow the patched option set');
});

test('updates rune child and attribute parts without root updates', async () => {
  const target = resetTarget();
  const label = $state('Save');
  const value = $state('a');

  mount(html`<label>${label}<input value="${value}" /></label>`, target);
  const input = target.querySelector('input');

  assert(input, 'input should be rendered');
  equal(target.textContent, 'Save', 'initial child rune should render');
  equal(input.value, 'a', 'initial attribute rune should render');

  label.value = 'Saved';
  value.value = 'ab';
  await nextMicrotask();

  equal(target.textContent, 'Saved', 'child rune should update');
  equal(target.querySelector('input'), input, 'input node should be preserved');
  equal(input.value, 'ab', 'attribute rune should update');
});

test('removes stale derived dependencies in the browser microtask queue', async () => {
  const target = resetTarget();
  const useFirst = $state(true);
  const first = $state('a');
  const second = $state('b');
  const value = $derived(() => (useFirst.value ? first.value : second.value));

  mount(html`<span>${value}</span>`, target);

  useFirst.value = false;
  await nextMicrotask();

  first.value = 'stale';
  second.value = 'fresh';
  await nextMicrotask();

  equal(target.textContent, 'fresh', 'derived value should ignore stale dependency');
});

test('cleans up reactive template parts on destroy', async () => {
  const target = resetTarget();
  const count = $state(0);
  const handle = mount(html`<span>${count}</span>`, target);

  handle.destroy();
  count.value = 1;
  await nextMicrotask();

  equal(target.textContent, '', 'destroyed reactive part should not write into the DOM');
});

test('rejects unquoted dynamic attributes in a real browser', () => {
  const target = resetTarget();

  let error: unknown;
  try {
    mount(html`<button class=${'active'}>Go</button>`, target);
  } catch (caught) {
    error = caught;
  }

  assert(error instanceof TypeError, 'unquoted dynamic attribute should throw TypeError');
  assert(
    error.message.includes('Dynamic attribute "class" must be quoted'),
    'unquoted dynamic attribute error should explain the fix',
  );
});

async function runTests(): Promise<void> {
  const results: BrowserTestResult[] = [];

  for (const browserTest of tests) {
    const start = performance.now();

    try {
      await browserTest.run();
      results.push({
        name: browserTest.name,
        status: 'passed',
        durationMs: performance.now() - start,
      });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      results.push({
        name: browserTest.name,
        status: 'failed',
        durationMs: performance.now() - start,
        message: failure.message,
        stack: failure.stack,
      });
    }
  }

  window.__litcodeBrowserTestResults = results;
  window.__litcodeBrowserTestsDone = true;

  const failed = results.filter((result) => result.status === 'failed');
  if (failed.length > 0) {
    console.error(`${failed.length} browser test(s) failed`, failed);
    return;
  }

  console.log(`${results.length} browser test(s) passed`);
}

void runTests();
