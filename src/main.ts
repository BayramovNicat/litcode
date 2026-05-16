import { $state, $effect, html, mount, type View } from './lib';
import './style.css';
import { Button } from './components/Button';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('App root not found.');

const count = $state(0);
const App = (): View => html`
  <div class="flex min-h-screen items-center justify-center bg-slate-50">
    ${Button({
      className: 'bg-red-500',
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
  handle.update(App());
});
