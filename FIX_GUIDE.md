# Руководство по исправлению багов в DB Viewer

Привет, Илья! Я изучил проект. Вижу, что многие правки из `CODE_REVIEW.md` уже внедрены (например, синхронизация в `TableEditor` и дебаунс автосохранения). Однако, текущие проблемы с ELK-лейаутом и тегами требуют более глубокого вмешательства.

Вот твой план действий как разработчика. Я расписал причины и конкретные шаги.

---

## 1. Баг с ELK Layout (Таблицы накладываются друг на друга)

**Причина:** 
1. **Порты и ограничения:** В `layoutService.ts` для каждой таблицы заданы `portConstraints: 'FIXED_POS'`. Это может конфликтовать с алгоритмом `layered`, если ELK не может найти решение для пересекающихся ребер при жестко заданных портах.
2. **Параметры ELK:** Некоторым опциям в `elkjs` версии 0.11.1 требуются префиксы `elk.` для корректной работы.
3. **Расчет границ:** В расчете `maxY` используется не совсем точная формула, которая может давать сбои при сложной геометрии.
4. **Отсутствие ребер:** Если таблицы не связаны (Disconnected components), ELK `layered` выстраивает их в одну колонку. Если расчет ширины компонента `w` дает сбой, следующий компонент рисуется поверх предыдущего.

**Что нужно сделать в `src/services/layoutService.ts`:**

- **Шаг А (Упрощение портов):** Удали `layoutOptions: { portConstraints: 'FIXED_POS' }` и массив `ports` у детей в `computeELKLayout`. ELK сам отлично найдет места для входа/выхода ребер.
- **Шаг Б (Обновление опций лейаута):** Добавь префиксы `elk.` к параметрам spacing.
- **Шаг В (Исправление расчета границ):** Используй более точный расчет `maxX` и `maxY`.

```typescript
// Пример исправленного блока в src/services/layoutService.ts:

// В цикле по компонентам, создание children:
const children: ElkNode[] = tables.map(t => ({
  id: t.name,
  width: NODE_WIDTH,
  height: measuredHeights?.[t.name] ?? defaultNodeHeight(t.columns.length),
  // Удалили порты и portConstraints
}))

// В опциях elk.layout:
layoutOptions: {
  'algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100', // Добавили elk.
  'elk.spacing.nodeNode': '80', // Добавили elk.
  'elk.padding': '[top=40,left=40,bottom=40,right=40]',
},

// В расчете maxX/maxY (после получения result):
const maxX = Math.max(...(result.children ?? []).map(node => (node.x ?? 0) + (node.width ?? 0)))
const maxY = Math.max(...(result.children ?? []).map(node => (node.y ?? 0) + (node.height ?? 0)))
```

---

## 2. Баг с тегами (Добавление не сохраняется)

**Причина:** 
Если в `TableEditor` теги добавляются в локальный стейт, но пропадают после сохранения, возможно следующее:
1. **Race Condition:** Стейт `tags` в `TableEditor` не успевает обновиться до вызова `onSave`, если используется какой-то быстрый ввод или есть задержки рендера.
2. **Визуальное отсутствие:** Теги сохраняются в объекте `Table`, но они **не отображаются** ни на самой ноде таблицы (`TableNode.tsx`), ни в списке в сайдбаре (`Sidebar.tsx`). Из-за этого кажется, что их нет.
3. **Auto-tagging:** Функция `applySchema` в `App.tsx` содержит логику `autoDetectTags`. Если у таблицы `tags: undefined`, она их генерирует. Но в `TableEditor` мы инициализируем их как `[]` (пустой массив), что предотвращает перезапись.

**Что нужно сделать:**

- **Шаг А (Визуализация):** Чтобы убедиться, что теги сохраняются, добавь их отображение в `src/components/TableNode.tsx`. Сейчас там их просто нет в коде!
- **Шаг Б (Проверка App.tsx):** Убедись, что в `handleEditorSave` лог `received updated.tags` показывает твои новые теги.

**Как добавить теги на ноду таблицы (`src/components/TableNode.tsx`):**
Вставь этот блок перед разделом `{showColumns && ...}`:

```tsx
{/* Tags display */}
{table.tags && table.tags.length > 0 && (
  <div className="px-3 py-1.5 flex flex-wrap gap-1 bg-black/20">
    {table.tags.map(tag => (
      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
        #{tag}
      </span>
    ))}
  </div>
)}
```

---

## 3. Дополнительно: SQL Парсер (UPPERCASE bug)

В `src/utils/parsers/sql.ts:55` есть строка `.toUpperCase()`. Из-за неё типы вроде `VARCHAR` превращаются в `VARCHAR`, а в `TableEditor.tsx` они сравниваются с `varchar` (нижний регистр). В итоге в редакторе все типы сбрасываются в `__custom__`. 
**Замени `.toUpperCase()` на `.toLowerCase()` в парсере.**

---

**Илья, действуй!** Если после этих правок что-то пойдет не так — присылай логи из консоли (особенно те, что помечены `[TAG-DEBUG]` и `[ELK-DEBUG]`). Я рядом.
