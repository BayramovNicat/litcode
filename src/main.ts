import { $effect, $state, $derived, html, mount, repeat, type View } from './lib';
import './style.css';

type Todo = {
  id: number;
  text: string;
  done: boolean;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

const todos = $state<Todo[]>([]);
const todoInput = $state<string>('qq');
const remaining = $derived(() => todos.value.filter((todo) => !todo.done).length);
let nextTodoId = 1;

function handleInput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  todoInput.value = input.value;
}

function addTodo(event: Event): void {
  event.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  todos.value = [...todos.value, { id: nextTodoId++, text, done: false }];
  todoInput.value = '';
}

function toggleTodo(id: number): void {
  todos.value = todos.value.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
}

function removeTodo(id: number): void {
  todos.value = todos.value.filter((todo) => todo.id !== id);
}

function clearDone(): void {
  todos.value = todos.value.filter((todo) => !todo.done);
}

function App(): View {
  return html`
    <main
      class="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 py-10 text-foreground"
    >
      <h1 class="text-2xl font-semibold tracking-normal">
        Todos (${remaining} task${remaining.value === 1 ? '' : 's'} left)
      </h1>

      <form class="flex gap-2" onsubmit=${addTodo}>
        <input
          name="todo"
          autocomplete="off"
          placeholder="Add a task"
          oninput=${handleInput}
          value=${todoInput}
          class="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
        />
        <button
          type="submit"
          class="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Add
        </button>
      </form>

      <ul class="divide-y divide-border rounded-md border border-border bg-card">
        ${!todos.value.length &&
        html`<li class="py-2 text-center text-sm text-muted-foreground list-none">
          Nothing left to do
        </li>`}
        ${repeat(
          todos.value,
          (todo) => todo.id,
          (todo) => html`
            <li class="flex items-center gap-3 px-3 py-2">
              <label class="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked=${todo.done}
                  onchange=${() => toggleTodo(todo.id)}
                  class="size-4 rounded border-input accent-primary"
                />
                <span
                  class="${todo.done
                    ? 'flex-1 text-sm text-muted-foreground line-through'
                    : 'flex-1 text-sm'}"
                >
                  ${todo.text}
                </span>
              </label>
              <button
                type="button"
                onclick=${() => removeTodo(todo.id)}
                class="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                x
              </button>
            </li>
          `,
        )}
      </ul>

      <button
        type="button"
        disabled=${remaining.value === todos.value.length}
        onclick=${clearDone}
        class="self-start rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        Clear completed
      </button>
    </main>
  `;
}

const handle = mount(App(), app);

$effect(() => {
  handle.update(App());
});
