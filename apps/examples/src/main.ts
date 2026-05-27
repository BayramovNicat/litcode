import { $derived, $effect, $state, html, mount, repeat, type View } from '@holmityd/litcode';
import { Dialog } from '@holmityd/litcode/components/dialog';
import { Image } from '@holmityd/litcode/components/image';
import { Select } from '@holmityd/litcode/components/select';

import './style.css';

type Photo = {
  id: number;
  filter: CategoryValue;
  src: string;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

const filterList = [
  'all',
  'nature',
  'city',
  'people',
  'animals',
  'food',
  'architecture',
  'travel',
  'sports',
  'technology',
] as const;

type FilterValue = (typeof filterList)[number];
type CategoryValue = Exclude<FilterValue, 'all'>;

const categories: CategoryValue[] = filterList.filter((filter) => filter !== 'all');
const photos: Photo[] = Array.from({ length: 500 }, (_, index) => {
  const id = index + 1;
  const category = categories[index % categories.length];

  return {
    id,
    filter: category,
    src: `https://loremflickr.com/450/300/${category}?lock=${id}`,
  };
});

const filter = $state<FilterValue>('all');
const selectedPhoto = $state<Photo | null>(null);
const filteredPhotos = $derived(() =>
  filter.value === 'all' ? photos : photos.filter((photo) => photo.filter === filter.value),
);

function highResPhotoSrc(photo: Photo): string {
  return `https://loremflickr.com/1200/800/${photo.filter}?lock=${photo.id}`;
}

function selectRelativePhoto(offset: number): void {
  const index = filteredPhotos.value.findIndex((i) => i.src === selectedPhoto.value?.src);
  const target = filteredPhotos.value[index + offset];
  if (target) selectedPhoto.value = target;
}

function nextImage() {
  selectRelativePhoto(1);
}

function prevImage() {
  selectRelativePhoto(-1);
}

function handlePhotoDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft') prevImage();
  if (event.key === 'ArrowRight') nextImage();
}

function PhotoItem(photo: Photo): View {
  return html`<button
    class="group block overflow-hidden rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    type="button"
    onclick="${() => {
      selectedPhoto.value = photo;
    }}"
  >
    ${Image({
      src: photo.src,
      alt: `${photo.filter} photo ${photo.id}`,
      width: 450,
      height: 300,
      className:
        'aspect-3/2 w-full rounded-md object-cover transition-transform duration-300 group-hover:scale-105',
    })}
  </button>`;
}

function SelectedPhotoDialog(): View {
  const photo = selectedPhoto.value;
  const title = photo ? `${photo.filter} photo ${photo.id}` : '';

  return Dialog({
    open: photo !== null,
    onclose: () => {
      selectedPhoto.value = null;
    },
    children: html`<div class="grid gap-4 p-4 sm:p-6">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg leading-none font-semibold">${title}</h2>
        <button
          type="button"
          class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label="Close"
          onclick="${(event: Event) => {
            (event.currentTarget as HTMLButtonElement).closest('dialog')?.close();
          }}"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
      <div class="flex items-center justify-between gap-2">
        <button
          class="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          type="button"
          onclick="${prevImage}"
        >
          Prev
        </button>
        <button
          class="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          type="button"
          onclick="${nextImage}"
        >
          Next
        </button>
      </div>
      ${photo
        ? Image({
            src: highResPhotoSrc(photo),
            alt: title,
            width: 1200,
            height: 800,
            loading: 'eager',
            className: 'aspect-3/2 max-h-[calc(100dvh-9rem)] w-full rounded-md object-contain',
          })
        : ''}
    </div>`,
  });
}

function App(): View {
  return html`
    <main class="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6">
      <div class="mx-auto max-w-6xl">
        <div class="mb-4 flex items-center justify-between gap-4">
          ${Select({
            items: filterList,
            value: filter.value,
            oninput: (event) => {
              filter.value = (event.target as HTMLSelectElement).value as FilterValue;
            },
          })}
          <span class="text-sm text-muted-foreground"
            >${filteredPhotos.value.length} of ${photos.length}</span
          >
        </div>

        <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${repeat(filteredPhotos.value, (photo) => photo.id, PhotoItem)}
        </section>

        ${SelectedPhotoDialog()}
      </div>
    </main>
  `;
}

const root = mount(App(), app);
let mounted = false;

$effect(() => {
  filter.value;
  selectedPhoto.value;
  mounted ? root.update(App()) : (mounted = true);
});

$effect(() => {
  if (!selectedPhoto.value) return;

  document.addEventListener('keydown', handlePhotoDialogKeydown);
  return () => document.removeEventListener('keydown', handlePhotoDialogKeydown);
});
