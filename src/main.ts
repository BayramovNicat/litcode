import { $derived, $effect, $state, html, mount, repeat, type View } from './lib';
import { Image } from './components/Image';
import { Select } from './components/Select';

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

const categories = filterList.filter((filter) => filter !== 'all') as CategoryValue[];
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
const filteredPhotos = $derived(() =>
  filter.value === 'all' ? photos : photos.filter((photo) => photo.filter === filter.value),
);

function PhotoImage(photo: Photo): View {
  return Image({
    src: photo.src,
    alt: `${photo.filter} photo ${photo.id}`,
    width: 450,
    height: 300,
    className: 'aspect-3/2 w-full rounded-md object-cover',
  });
}

function App(): View {
  return html`
    <main class="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6">
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
        ${repeat(filteredPhotos.value, (photo) => photo.id, PhotoImage)}
      </section>
    </main>
  `;
}

const root = mount(App(), app);
let mounted = false;

$effect(() => {
  filter.value;
  mounted ? root.update(App()) : (mounted = true);
});