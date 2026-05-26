# litcode workspace

This repository is now a small monorepo:

- `packages/litcode` contains the reusable `@holmityd/litcode` package
- `apps/examples` contains the local example app that imports the package by workspace name

## Development

```sh
npm install
npm run dev:examples
```

## Package work

```sh
npm run test:lib
npm run build:lib
npm run release
```

The example app uses the workspace package locally, so edits in `packages/litcode` are picked up during local development.
