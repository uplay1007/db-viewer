# DB Viewer — Implementation Plan

## Stack (agreed with Gemini)
- React 18 + TypeScript + Vite
- React Flow — canvas, drag & drop, edges
- d3-force — initial layout (related tables cluster together)
- Tailwind CSS — styling

## Universal Schema Format (internal)
```ts
interface Column {
  name: string;
  type: string;         // "integer", "varchar(255)", etc.
  primaryKey?: boolean;
  foreignKey?: { table: string; column: string };
  nullable?: boolean;
  unique?: boolean;
}
interface Table { name: string; columns: Column[] }
interface Schema { tables: Table[] }
```

## Parsers (client-side file upload)
- Universal JSON — direct parse
- Prisma `.prisma` — regex-based: model blocks → tables, @id/@relation → PK/FK
- SQL DDL `.sql` — CREATE TABLE parser
- TypeORM entities `.ts` — decorator-based parsing (@Entity, @PrimaryColumn, @ManyToOne)
- Django `models.py` — class-based parsing
- SQLAlchemy `models.py` — Column() parsing

## Files

### [NEW] src/types/schema.ts
Column, Table, Schema interfaces

### [NEW] src/utils/colors.ts
Deterministic color per table name (HSL palette, 12 colors)

### [NEW] src/utils/layout.ts
d3-force simulation: link force between FK-connected tables, charge repulsion, center force → returns {id, x, y}[]

### [NEW] src/utils/parsers/index.ts
Auto-detect file type, dispatch to correct parser, return Schema

### [NEW] src/utils/parsers/json.ts
### [NEW] src/utils/parsers/prisma.ts
### [NEW] src/utils/parsers/sql.ts
### [NEW] src/utils/parsers/typeorm.ts
### [NEW] src/utils/parsers/django.ts

### [NEW] src/components/TableNode.tsx
Custom React Flow node:
- Colored header (table name)
- Collapsed by default, click to expand
- Expanded: column list, PK/FK badge at top, type shown
- Edit button → opens EditPanel

### [NEW] src/components/EditPanel.tsx
Sidebar panel:
- Add column (name, type, PK, nullable, FK)
- Delete column
- Change column type (select from common types)
- Rename table

### [NEW] src/components/UploadZone.tsx
Drag & drop file upload + manual JSON paste textarea

### [NEW] src/App.tsx
- State: schema, nodes, edges
- UploadZone → parse → d3-force layout → React Flow
- EditPanel wired to selected node

### [NEW] src/index.css
Tailwind directives

### [NEW] tailwind.config.js, vite.config.ts, tsconfig.json, package.json

## Task Checklist (task.md)
- [ ] scaffold Vite project + install deps
- [ ] types/schema.ts
- [ ] utils/colors.ts
- [ ] utils/layout.ts (d3-force)
- [ ] parsers: json, prisma, sql, typeorm, django
- [ ] TableNode.tsx
- [ ] EditPanel.tsx
- [ ] UploadZone.tsx
- [ ] App.tsx (wire everything)
- [ ] Demo schema JSON for testing
