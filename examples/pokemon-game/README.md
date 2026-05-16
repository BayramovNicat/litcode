# pokemon-game

This example is a small Gen 1 Pokémon game built with the `litcode` runtime.

## Run

From the repository root:

```bash
npm run dev
```

## Cache the Pokémon data

The game loads Pokémon from a generated JSON file for fast startup.

```bash
npm run generate:gen1-cache
```

This writes the cache to `public/data/gen1-pokemon.json`.

## What this example includes

- Starter selection
- Wild encounters
- Basic battle flow
- Cached Gen 1 Pokémon data
