import './style.css'
import { $derived, $effect, $state, component, html, mount } from './lib'

type ButtonProps = {
  label: string
  onclick: () => void
}

const Button = component<ButtonProps>(({ label, onclick }) => html`
  <button class="counter" type="button" onclick=${onclick}>${label}</button>
`)

const App = component(() => {
  const count = $state(0)
  const doubled = $derived(() => count.value * 2)

  const view = html`
    <main id="center">
      <h1>Litcode</h1>
      <p>Minimal TypeScript frontend rendering for better vanilla JS.</p>
      ${Button({
        label: `count is ${count.value}`,
        onclick: () => (count.value += 1),
      })}
      <p>Doubled: ${doubled.value}</p>
    </main>
  `

  const handle = mount(view, document.querySelector<HTMLDivElement>('#app')!)

  $effect(() => {
    handle.update(html`
      <main id="center">
        <h1>Litcode</h1>
        <p>Minimal TypeScript frontend rendering for better vanilla JS.</p>
        ${Button({
          label: `count is ${count.value}`,
          onclick: () => (count.value += 1),
        })}
        <p>Doubled: ${doubled.value}</p>
      </main>
    `)
  })
})

App({})
