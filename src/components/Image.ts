import { cn, type Props, type View } from '@/lib';

const MAX_CONCURRENT = 8;
const ROOT_MARGIN = '200px 0px';

type ImageSource = {
  key: string;
  src: string;
  srcset?: string;
  sizes?: string;
};

type ImageStatus = 'idle' | 'queued' | 'loading' | 'loaded' | 'failed';

type LazyImageState = ImageSource & {
  status: ImageStatus;
  nearViewport: boolean;
  token: number;
  cancelLoad?: () => void;
};

type LazyImageElement = HTMLImageElement & {
  __litcodeImage?: LazyImageState;
  __litcodeKey?: string;
};

export type ImageProps = Props<
  Omit<Partial<HTMLImageElement>, 'src' | 'srcset' | 'loading' | 'decoding'> & {
    src: string;
    srcset?: string;
    srcSet?: string;
    loading?: HTMLImageElement['loading'];
    decoding?: HTMLImageElement['decoding'];
  }
>;

const loadingQueue: LazyImageElement[] = [];
const sourceStatuses = new Map<string, Extract<ImageStatus, 'loaded' | 'failed'>>();
const skippedPropKeys = new Set([
  'alt',
  'children',
  'className',
  'dataset',
  'decoding',
  'loading',
  'sizes',
  'src',
  'srcset',
  'srcSet',
  'style',
]);
const hasOwn = Object.prototype.hasOwnProperty;

let activeLoads = 0;
let viewportObserver: IntersectionObserver | undefined;

export function Image(props: ImageProps): View {
  if (typeof document === 'undefined') return '';

  const image = document.createElement('img') as LazyImageElement;

  const src = props.src;
  const srcset = props.srcset ?? props.srcSet ?? '';
  const sizes = props.sizes ?? '';
  image.__litcodeKey = `${src}|${srcset}|${sizes}`;

  applyImageProps(image, props);
  overrideElementMutationMethods(image);
  registerImage(image);

  return image;
}

function overrideElementMutationMethods(image: LazyImageElement): void {
  const originalSetAttribute = image.setAttribute;
  const originalRemoveAttribute = image.removeAttribute;

  image.setAttribute = function (name: string, value: string) {
    const oldValue = this.getAttribute(name);
    if (oldValue === value) return;

    originalSetAttribute.call(this, name, value);

    if (name === 'data-src' || name === 'data-srcset' || name === 'data-sizes') {
      const src = this.dataset.src ?? '';
      const srcset = this.dataset.srcset ?? '';
      const sizes = this.dataset.sizes ?? '';
      this.__litcodeKey = `${src}|${srcset}|${sizes}`;
      registerImage(this);
    }
  };

  image.removeAttribute = function (name: string) {
    const hasAttr = this.hasAttribute(name);
    if (!hasAttr) return;

    originalRemoveAttribute.call(this, name);

    if (name === 'data-src' || name === 'data-srcset' || name === 'data-sizes') {
      const src = this.dataset.src ?? '';
      const srcset = this.dataset.srcset ?? '';
      const sizes = this.dataset.sizes ?? '';
      this.__litcodeKey = `${src}|${srcset}|${sizes}`;
      registerImage(this);
    }
  };
}

function applyImageProps(image: LazyImageElement, props: ImageProps): void {
  const key = image.__litcodeKey!;
  const cachedStatus = sourceStatuses.get(key);

  image.alt = props.alt ?? '';
  image.loading = props.loading ?? 'lazy';
  image.decoding = props.decoding ?? 'async';

  image.className = cn(
    'opacity-0 transition-opacity duration-300 ease-out',
    cachedStatus === 'loaded' && 'opacity-100',
    props.className,
  );

  if (props.style) image.style.cssText = props.style;
  if (cachedStatus === 'failed') image.style.display = 'none';

  applyNativeImageProps(image, props);

  if (props.dataset) Object.assign(image.dataset, props.dataset);
  image.dataset.litcodeImage = 'true';
  image.dataset.src = props.src;

  const srcset = props.srcset ?? props.srcSet;
  if (srcset) image.dataset.srcset = srcset;
  else delete image.dataset.srcset;

  if (props.sizes) image.dataset.sizes = props.sizes;
  else delete image.dataset.sizes;

  image.removeAttribute('src');
  image.removeAttribute('srcset');
}

function applyNativeImageProps(image: LazyImageElement, props: ImageProps): void {
  const target = image as HTMLImageElement & Record<string, unknown>;
  const source = props as Record<string, unknown>;

  for (const key in source) {
    if (!hasOwn.call(source, key) || skippedPropKeys.has(key) || !(key in target)) continue;

    const value = source[key];
    if (value === undefined || value === null) continue;

    target[key] = value;
  }
}

function registerImage(image: LazyImageElement): void {
  const key = image.__litcodeKey;
  if (!key) return;

  const dataset = image.dataset;
  const src = dataset.src;
  if (!src) {
    const state = image.__litcodeImage;
    if (state?.status === 'loaded') revealImage(image);
    return;
  }

  const state = image.__litcodeImage;
  if (state?.key === key) {
    syncRegisteredImage(image, state);
    return;
  }

  if (state) cleanupImage(image);

  const nextState: LazyImageState = {
    key,
    src,
    srcset: dataset.srcset,
    sizes: dataset.sizes,
    status: 'idle',
    nearViewport: false,
    token: 0,
  };
  image.__litcodeImage = nextState;

  const cachedStatus = sourceStatuses.get(key);
  if (cachedStatus === 'loaded') {
    finishImageLoad(image, nextState);
    return;
  }

  if (cachedStatus === 'failed') {
    failImageLoad(image, nextState);
    return;
  }

  if (image.loading === 'eager') {
    nextState.nearViewport = true;
    enqueueImage(image);
    return;
  }

  const observer = getViewportObserver();
  if (observer) {
    observer.observe(image);
  } else {
    nextState.nearViewport = true;
    enqueueImage(image);
  }
}

function syncRegisteredImage(image: LazyImageElement, state: LazyImageState): void {
  if (state.status === 'loaded' || sourceStatuses.get(state.key) === 'loaded') {
    finishImageLoad(image, state);
    return;
  }

  if (state.status === 'failed' || sourceStatuses.get(state.key) === 'failed') {
    failImageLoad(image, state);
    return;
  }

  if (state.status === 'loading') setImageSource(image, state);
}

function getViewportObserver(): IntersectionObserver | undefined {
  if (viewportObserver || typeof IntersectionObserver === 'undefined') return viewportObserver;

  viewportObserver = new IntersectionObserver(handleIntersections, {
    rootMargin: ROOT_MARGIN,
  });

  return viewportObserver;
}

function handleIntersections(entries: IntersectionObserverEntry[]): void {
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const image = entry.target as LazyImageElement;
    const state = image.__litcodeImage;

    if (!image.isConnected) {
      cleanupImage(image);
      continue;
    }

    if (!state || state.status === 'loaded' || state.status === 'failed') continue;

    if (entry.isIntersecting || entry.intersectionRatio > 0) {
      state.nearViewport = true;
      enqueueImage(image);
      continue;
    }

    state.nearViewport = false;
    pauseImageLoad(image, state);
  }
}

function enqueueImage(image: LazyImageElement): void {
  const state = image.__litcodeImage;
  if (!state || state.status !== 'idle') return;

  if (!image.isConnected) {
    cleanupImage(image);
    return;
  }

  state.status = 'queued';
  loadingQueue.push(image);
  drainQueue();
}

function drainQueue(): void {
  while (activeLoads < MAX_CONCURRENT && loadingQueue.length > 0) {
    const image = loadingQueue.shift();
    if (!image) continue;

    const state = image.__litcodeImage;
    if (!state || state.status !== 'queued') continue;

    if (!image.isConnected) {
      cleanupImage(image);
      continue;
    }

    if (!state.nearViewport) {
      state.status = 'idle';
      continue;
    }

    activeLoads++;
    state.status = 'loading';

    loadImage(image, state).finally(() => {
      activeLoads--;
      drainQueue();
    });
  }
}

function loadImage(image: LazyImageElement, state: LazyImageState): Promise<void> {
  return new Promise((resolve) => {
    const token = ++state.token;
    let settled = false;

    const cleanupListeners = () => {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
    };

    const settle = (loaded: boolean) => {
      if (settled) return;

      settled = true;
      cleanupListeners();
      state.cancelLoad = undefined;

      if (image.__litcodeImage !== state || state.token !== token) {
        resolve();
        return;
      }

      if (!image.isConnected) {
        cleanupImage(image);
        resolve();
        return;
      }

      if (!loaded) {
        failImageLoad(image, state);
        resolve();
        return;
      }

      decodeImage(image).finally(() => {
        if (image.__litcodeImage === state && state.token === token) finishImageLoad(image, state);
        resolve();
      });
    };

    function handleLoad(): void {
      settle(true);
    }

    function handleError(): void {
      settle(false);
    }

    state.cancelLoad = () => {
      if (settled) return;

      settled = true;
      cleanupListeners();
      state.cancelLoad = undefined;
      resolve();
    };

    image.addEventListener('load', handleLoad);
    image.addEventListener('error', handleError);
    setImageSource(image, state);

    if (image.complete) settle(image.naturalWidth > 0);
  });
}

function setImageSource(image: HTMLImageElement, source: ImageSource): void {
  if (source.sizes) image.sizes = source.sizes;
  else image.removeAttribute('sizes');

  if (source.srcset) image.srcset = source.srcset;
  else image.removeAttribute('srcset');

  if (image.getAttribute('src') !== source.src) image.setAttribute('src', source.src);
}

function pauseImageLoad(image: LazyImageElement, state: LazyImageState): void {
  if (state.status === 'queued') {
    const index = loadingQueue.indexOf(image);
    if (index !== -1) {
      loadingQueue.splice(index, 1);
    }
    state.status = 'idle';
    return;
  }

  if (state.status !== 'loading') return;

  state.status = 'idle';
  state.token++;
  state.cancelLoad?.();
  clearImageSource(image);
}

function clearImageSource(image: HTMLImageElement): void {
  image.removeAttribute('src');
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
}

function finishImageLoad(image: LazyImageElement, state: LazyImageState): void {
  sourceStatuses.set(state.key, 'loaded');
  state.status = 'loaded';
  viewportObserver?.unobserve(image);
  const index = loadingQueue.indexOf(image);
  if (index !== -1) {
    loadingQueue.splice(index, 1);
  }
  setImageSource(image, state);
  removeLoadingData(image);
  revealImage(image);
}

function failImageLoad(image: LazyImageElement, state: LazyImageState): void {
  sourceStatuses.set(state.key, 'failed');
  state.status = 'failed';
  viewportObserver?.unobserve(image);
  const index = loadingQueue.indexOf(image);
  if (index !== -1) {
    loadingQueue.splice(index, 1);
  }
  removeLoadingData(image);
  image.removeAttribute('src');
  image.removeAttribute('srcset');
  image.style.display = 'none';
}

function revealImage(image: HTMLImageElement): void {
  image.style.display = '';
  image.classList.remove('opacity-0');
  image.classList.add('opacity-100');
}

function removeLoadingData(image: HTMLImageElement): void {
  image.removeAttribute('data-src');
  image.removeAttribute('data-srcset');
  image.removeAttribute('data-sizes');
}

function cleanupImage(image: LazyImageElement): void {
  const state = image.__litcodeImage;
  if (!state) return;

  viewportObserver?.unobserve(image);
  const index = loadingQueue.indexOf(image);
  if (index !== -1) {
    loadingQueue.splice(index, 1);
  }
  state.cancelLoad?.();
  delete image.__litcodeImage;
}

async function decodeImage(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode !== 'function') return;
  const src = image.src;
  if (src.startsWith('data:') || src.endsWith('.svg')) return;
  return image.decode().catch(() => undefined);
}
