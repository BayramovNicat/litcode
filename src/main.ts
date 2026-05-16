import { $state, $effect, html, mount, type View } from './lib';
import './style.css';
import { Button } from './components/Button';
import { Input } from './components/Input';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

const count = $state(0);
const App = (): View => html`
  <div class="flex min-h-screen items-center justify-center bg-slate-50">
    ${Input({
      type: 'number',
      value: String(count.value),
      oninput: (e) => (count.value = parseInt((e.target as HTMLInputElement).value)),
    })}
    ${Button({
      className: 'bg-red-500 hover:bg-red-600',
      onclick: () => count.value++,
      children: `Count: ${count.value}`,
    })}
    <button
      class="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
      onclick=${() => count.value++}
    >
      Count: ${count.value}
    </button>
  </div>
`;

const handle = mount(App(), app);

$effect(() => {
  count.value;
  handle.update(App());
});
