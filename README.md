# DB Viewer

A visual database schema explorer. Drop in your schema file and get an interactive diagram — drag tables, filter by groups, edit structure, export back.

![DB Viewer](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Vite-blue)

## Features

- **Multi-format import** — SQL, Prisma, TypeORM, Django, SQLAlchemy, JSON
- **Interactive canvas** — drag & drop tables, zoom, pan, lasso-select
- **Smart layout** — ELK-powered auto-layout on first load, positions saved across sessions
- **Tag groups** — auto-detected tags, filter canvas by group with per-group ELK layout
- **Table editor** — add/edit columns, types, PK/NN/UQ/AI flags, foreign keys via visual picker
- **FK picker** — two-step UI: pick table → pick column, no more hunting through flat dropdowns
- **View modes** — Full / Compact / Collapsed per table
- **Export** — save back to SQL or JSON
- **Persistent sessions** — layout positions and schema saved to localStorage

## Stack

- [React 18](https://react.dev/) + TypeScript
- [React Flow v12](https://reactflow.dev/) — canvas
- [ELK.js](https://github.com/kieler/elkjs) — graph layout
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)

## Getting Started

```bash
git clone https://github.com/uplay1007/db-viewer.git
cd db-viewer
npm install
npm run dev
```

## Supported Formats

| Format | Import | Export |
|--------|--------|--------|
| SQL (PostgreSQL / MySQL) | ✓ | ✓ |
| Prisma schema | ✓ | — |
| TypeORM entities | ✓ | — |
| Django models | ✓ | — |
| SQLAlchemy models | ✓ | — |
| JSON | ✓ | ✓ |
