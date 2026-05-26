type Subscriber = () => void;

let currentObserver: Subscriber | undefined;
let currentObserverSources: Set<object> | undefined;

const dependencies = new WeakMap<object, Set<Subscriber>>();
const observerDependencies = new WeakMap<Subscriber, Set<object>>();
const scheduleMicrotask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (callback: () => void) => void Promise.resolve().then(callback);

const notify = (target: object) => {
  const subscribers = dependencies.get(target);
  if (!subscribers) return;

  if (subscribers.size === 1) {
    const first = subscribers.values().next().value;
    if (first) first();
    return;
  }

  const pending = Array.from(subscribers);
  for (let index = 0; index < pending.length; index++) pending[index]();
};

const track = (target: object) => {
  if (!currentObserver) return;
  let subscribers = dependencies.get(target);
  if (!subscribers) dependencies.set(target, (subscribers = new Set()));
  subscribers.add(currentObserver);
  currentObserverSources?.add(target);
};

function cleanupObserver(observer: Subscriber): void {
  const sources = observerDependencies.get(observer);
  if (!sources) return;

  for (const target of sources) {
    dependencies.get(target)?.delete(observer);
  }
  sources.clear();
}

/**
 * A small reactive value with subscription support.
 */
export type Rune<T> = {
  __litcodeRune: true;
  value: T;
  subscribe(subscriber: Subscriber): () => void;
};

/**
 * Returns `true` when a value is a Litcode rune.
 */
export function isRune(value: unknown): value is Rune<unknown> {
  return typeof value === 'object' && value !== null && (value as any).__litcodeRune === true;
}

/**
 * Creates a mutable reactive state value.
 */
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

/**
 * Creates a readonly rune derived from other reactive values.
 */
export function $derived<T>(compute: () => T): Rune<T> {
  const state = $state<T>(undefined as T);

  const recompute = () => {
    cleanupObserver(recompute);
    const sources = new Set<object>();
    const previous = currentObserver;
    const previousSources = currentObserverSources;
    currentObserver = recompute;
    currentObserverSources = sources;
    try {
      state.value = compute();
    } finally {
      observerDependencies.set(recompute, sources);
      currentObserver = previous;
      currentObserverSources = previousSources;
    }
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
  const size = effectQueue.size;
  if (size === 0) {
    isFlushing = false;
    return;
  }

  if (size === 1) {
    const first = effectQueue.values().next().value;
    effectQueue.clear();
    if (first) first();
    isFlushing = false;

    if (effectQueue.size > 0) {
      isFlushing = true;
      scheduleMicrotask(flushQueue);
    }
    return;
  }

  const pending = Array.from(effectQueue);
  effectQueue.clear();

  for (let index = 0; index < pending.length; index++) {
    pending[index]();
  }

  isFlushing = false;

  if (effectQueue.size > 0) {
    isFlushing = true;
    scheduleMicrotask(flushQueue);
  }
}

/**
 * Runs an effect and re-runs it when its dependencies change.
 *
 * Returns a disposer that stops future re-runs and performs cleanup.
 */
export function $effect(run: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let disposed = false;

  const queuedRerun = () => {
    if (disposed) return;
    effectQueue.add(execute);
    if (!isFlushing) {
      isFlushing = true;
      scheduleMicrotask(flushQueue);
    }
  };

  const execute = () => {
    if (disposed) return;
    cleanupObserver(queuedRerun);
    const sources = new Set<object>();
    cleanup?.();
    const previous = currentObserver;
    const previousSources = currentObserverSources;
    currentObserver = queuedRerun;
    currentObserverSources = sources;
    try {
      cleanup = run();
    } finally {
      observerDependencies.set(queuedRerun, sources);
      currentObserver = previous;
      currentObserverSources = previousSources;
    }
  };

  execute();
  return () => {
    disposed = true;
    effectQueue.delete(execute);
    cleanupObserver(queuedRerun);
    cleanup?.();
    cleanup = undefined;
  };
}
