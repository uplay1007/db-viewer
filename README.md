# DB Viewer

A visual database **schema** explorer. Drop in a schema file and get an interactive diagram: tables become cards, foreign keys become edges. Explore it, restructure it, save named views, and export back — all in the browser.

DB Viewer works with the **structure** of a database (the "skeleton" — tables, columns, keys, relationships), not its row contents. It's built for the moment *before* the data exists: designing a new schema, onboarding onto an unfamiliar one, or discussing a model with the team.

![DB Viewer](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Vite-blue)

## Why

A relational schema usually lives as text — DDL dumps, ORM models, migration files. Holding dozens of tables and their foreign-key relationships in your head from that text is hard. DB Viewer turns the text into a navigable map so you can *see* the structure, follow dependencies, and reshape the model visually.

## Core capabilities

### Import from any stack
Load a schema from **SQL DDL, Prisma, TypeORM, Django, SQLAlchemy, or JSON**. Format is auto-detected from the file (Python files are disambiguated by content — SQLAlchemy vs Django). The parser extracts tables, columns, types, and PK / FK / unique / nullable flags into one unified model, so the rest of the app is format-agnostic.

### Read the structure at a glance
Tables render as cards with typed columns and PK / FK / UQ badges. Foreign keys are drawn as orthogonal edges labelled with the relationship cardinality (1:1 / 1:N / N:M). First load runs an **ELK auto-layout** so even a 30-table schema opens as a readable map without manual arranging.

### Trace dependencies
Click a table to spotlight it and everything it's connected to via foreign keys; the rest dims. Hover a relationship edge to highlight the exact columns it links (the FK column on one side, the referenced key on the other) — so you see *which* attributes join two tables, not just *that* they're joined.

### Build focused views (Layouts)
Shift-click to select a set of tables (edges between any two selected tables light up), then save them as a named **layout**. Each layout remembers its own table positions *and* its own detail level (Full / Compact / Collapsed) — so the same schema can have a tidy "billing" arrangement and a separate "catalog" arrangement that don't interfere. Switch layouts from the toolbar dropdown; rename or delete via a settings modal. **Organize** re-runs ELK on the active view and re-frames the camera onto the tables.

### Edit the model in place
- **Table editor** — add/edit columns, pick types, toggle PK / NN / UQ / AI, and wire foreign keys with a two-step visual picker (pick table → pick column). Renaming a table auto-updates every FK that references it.
- **DSL split-view** — a live text editor in a compact DBML-style syntax (`role_id integer > roles.id`) with two-way sync: type in the editor, the canvas updates (debounced); edit on the canvas, the text updates.
- **Tag groups** — tag tables and filter the canvas to one group, with its own auto-layout.

### Persist and export
- **Cloud saves** — schemas (with layouts and positions) are stored in Supabase behind row-level security and synced across devices after login. A local session auto-saves your work and restores it — including which cloud save you were editing — on reload.
- **Export** — write back to SQL DDL or JSON, either as a download or a direct file overwrite via the File System Access API.

## Stack

- [React 18](https://react.dev/) + TypeScript
- [React Flow v12](https://reactflow.dev/) (`@xyflow/react`) — interactive canvas
- [ELK.js](https://github.com/kieler/elkjs) — graph auto-layout (dagre as fallback for new nodes)
- [CodeMirror](https://codemirror.net/) — the DSL editor
- [Supabase](https://supabase.com/) — auth + cloud saves (PostgreSQL + RLS)
- [Vite](https://vitejs.dev/) 6, CSS Modules

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

## Scope

DB Viewer models schema structure only. Row-level data, live-database connections, and migration generation are intentionally out of scope.
