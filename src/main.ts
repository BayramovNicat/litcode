import { html, mount, repeat, type View } from './lib';
import { Image } from './components/Image';
import './style.css';

type Photo = {
  id: number;
  seed: string;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

const PHOTO_COUNT = 1000;
const photos: Photo[] = Array.from({ length: PHOTO_COUNT }, (_, index) => ({
  id: index + 1,
  seed: crypto.randomUUID(),
}));

function randomImageUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/450/300`;
}

function PhotoCard(photo: Photo): View {
  return html`
    <article class="content-auto overflow-hidden rounded-md border border-border bg-card shadow-xs">
      <div class="aspect-3/2 bg-muted">
        ${Image({
          src: randomImageUrl(photo.seed),
          alt: `Random photo ${photo.id}`,
          width: 450,
          height: 300,
          className: 'h-full w-full object-cover',
        })}
      </div>
      <div class="flex items-start justify-between gap-3 border-t border-border p-3">
        <div class="min-w-0">
          <h2 class="truncate text-sm font-semibold">Random Photo</h2>
          <p class="mt-1 text-xs text-muted-foreground">450x300</p>
        </div>
        <span class="text-xs tabular-nums text-muted-foreground">#${photo.id}</span>
      </div>
    </article>
  `;
}

function App(): View {
  return html`
    <main class="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 text-foreground sm:px-6">
      <header class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-normal">Random Image Feed</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Each card requests a random 450x300 image through the lazy Image component.
          </p>
        </div>
        <span class="text-sm text-muted-foreground">${photos.length} images</span>
      </header>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        ${repeat(
          photos,
          (photo) => photo.id,
          (photo) => PhotoCard(photo),
        )}
      </section>
    </main>
  `;
}

mount(App(), app);
