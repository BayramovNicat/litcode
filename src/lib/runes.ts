type Subscriber = () => void;

let currentObserver: Subscriber | undefined;

const dependencies = new WeakMap<object, Set<Subscriber>>();

const notify = (target: object) => {
  dependencies.get(target)?.forEach((subscriber) => subscriber());
};

const track = (target: object) => {
  if (!currentObserver) return;
  let subscribers = dependencies.get(target);
  if (!subscribers) dependencies.set(target, (subscribers = new Set()));
  subscribers.add(currentObserver);
};

export type Rune<T> = {
  __litcodeRune: true;
  value: T;
  subscribe(subscriber: Subscriber): () => void;
};

export function isRune(value: unknown): value is Rune<unknown> {
  return value != null && (value as any).__litcodeRune === true;
}

export function $state<T>(initial: T): Rune<T> {
  const target = { value: initial };

  return {
    __litcodeRune: true,
    get value() {
      track(target);
      return target.value;
    },
    set value(next) {
      if (Object.is(target.value, next)) return;
      target.value = next;
      notify(target);
    },
    subscribe(subscriber) {
      let subscribers = dependencies.get(target);
      if (!subscribers) dependencies.set(target, (subscribers = new Set()));
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}

export function $derived<T>(compute: () => T): Rune<T> {
  const state = $state<T>(undefined as T);

  const recompute = () => {
    const previous = currentObserver;
    currentObserver = recompute;
    state.value = compute();
    currentObserver = previous;
  };

  recompute();
  return {
    __litcodeRune: true,
    get value() {
      return state.value;
    },
    set value(_) {
      throw new TypeError('$derived values are readonly');
    },
    subscribe: state.subscribe,
  };
}

const effectQueue = new Set<() => void>();
let isFlushing = false;

function flushQueue() {
  for (const execute of effectQueue) {
    execute();
  }
  effectQueue.clear();
  isFlushing = false;
}

export function $effect(run: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);

  const queuedRerun = () => {
    effectQueue.add(execute);
    if (!isFlushing) {
      isFlushing = true;
      queueMicrotask(flushQueue);
    }
  };

  const execute = () => {
    cleanup?.();
    const previous = currentObserver;
    currentObserver = queuedRerun;
    cleanup = run();
    currentObserver = previous;
  };

  execute();
  return () => {
    effectQueue.delete(execute);
    cleanup?.();
  };
}
