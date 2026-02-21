# barcOwned v2

A complete rewrite of barcOwned as a modern static web app.

## What's Changed

- **No server required** — fully static, deploys to GitHub Pages
- **Modern stack** — Vite + TypeScript + vanilla JS (no framework bloat)
- **Single page app** — Editor, runner, and share in one unified interface
- **Mobile-first runner** — optimized for showing barcodes on phone screens
- **URL sharing** — encode payloads in URL fragments, share via QR code
- **LocalStorage persistence** — your payloads save locally, import/export as JSON

## Development

```bash
cd v2
npm install
npm run dev     # Start dev server at http://localhost:5173
npm run build   # Build for production
npm run preview # Preview production build
```

## Architecture

```
src/
├── core/           # Barcode engine (pure logic)
│   ├── barcowned.ts   # Main engine class
│   ├── types.ts       # TypeScript interfaces
│   ├── render.ts      # bwip-js wrapper
│   └── models/        # Scanner model definitions
│       ├── symbol.ts  # Motorola/Zebra Symbol
│       └── index.ts   # Model registry
├── store/          # State management
│   ├── payloads.ts    # localStorage + presets
│   └── share.ts       # URL encoding/decoding
├── main.ts         # App entry point
└── style.css       # All styles
```

## TODO

- [ ] List mode for printing
- [ ] More scanner models
- [ ] C40 DataMatrix aggregation
- [ ] Visual payload builder
- [ ] Better mobile UI
- [ ] Comprehensive docs

## Migrating from v1

The payload JSON format is unchanged! Just import your existing payloads.
