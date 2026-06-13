import { useState, useCallback, useEffect } from 'react'
import { parseSchema, detectParser, type ParserType } from '../utils/parsers'
import { openFilePicker, getHandleFromDrop, supportsFileSystemAccess } from '../utils/fileAccess'
import { fetchSaves, deleteSave, type RemoteSave } from '../services/schemasAPI'
import { useAuth } from '../contexts/AuthContext'
import type { Schema } from '../types/schema'
import { T, type Lang } from '../i18n'
import { tableColor } from '../utils/colors'
import { useDialog } from '../contexts/DialogContext'

export interface OpenResult {
  schema: Schema
  fileHandle?: FileSystemFileHandle
  savedId?: string
  savedName?: string
  positions?: Record<string, { x: number; y: number }>
}

interface Props {
  lang: Lang
  onLangToggle: () => void
  onOpen: (result: OpenResult) => void
}

const PARSERS: { value: ParserType; label: string }[] = [
  { value: 'json',       label: 'Universal JSON' },
  { value: 'prisma',     label: 'Prisma'         },
  { value: 'sql',        label: 'SQL DDL'        },
  { value: 'typeorm',    label: 'TypeORM'        },
  { value: 'django',     label: 'Django'         },
  { value: 'sqlalchemy', label: 'SQLAlchemy'     },
]

function fmtDate(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function UploadZone({ lang, onLangToggle, onOpen }: Props) {
  const t = T[lang]
  const dialog = useDialog()
  const { signOut, user } = useAuth()
  const [parserType, setParserType] = useState<ParserType>('json')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [saves, setSaves] = useState<RemoteSave[]>([])
  const [savesLoading, setSavesLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const hasFileAccess = supportsFileSystemAccess()

  useEffect(() => {
    fetchSaves()
      .then(setSaves)
      .catch(() => setSaves([]))
      .finally(() => setSavesLoading(false))
  }, [])

  const processText = useCallback(async (content: string, type: ParserType, handle?: FileSystemFileHandle) => {
    try {
      const schema = parseSchema(content, type)
      if (!schema.tables.length) throw new Error('No tables found')
      
      const fileName = handle?.name.replace(/\.[^.]+$/, '')
      const existing = fileName ? saves.find(s => s.name === fileName) : undefined
      
      if (existing) {
        const ok = await dialog.confirm(
          lang === 'ru' ? 'Проект уже существует' : 'Project already exists',
          lang === 'ru' 
            ? `Проект "${existing.name}" уже есть в ваших сохранениях. Импорт этого файла НЕ обновит кастомные теги и расстановку из сохранения. Продолжить как новую БД?`
            : `Project "${existing.name}" is already in your saves. Importing this file will NOT apply your custom tags and layout from the save. Import as a new DB anyway?`
        )
        if (!ok) return
      }

      setError('')
      onOpen({ schema, fileHandle: handle })
    } catch (e) {
      setError((e as Error).message)
    }
  }, [onOpen, saves, lang, dialog])

  const handleOpenClick = useCallback(async () => {
    if (hasFileAccess) {
      const result = await openFilePicker(['.json', '.prisma', '.sql', '.ts', '.py'])
      if (!result) return
      const type = detectParser(result.file.name)
      setParserType(type)
      const content = await result.file.text()
      processText(content, type, result.handle)
    } else {
      document.getElementById('file-input-fallback')?.click()
    }
  }, [hasFileAccess, processText])

  const onFileFallback = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const type = detectParser(file.name); setParserType(type)
    file.text().then(c => processText(c, type))
    e.target.value = ''
  }, [processText])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const handle = await getHandleFromDrop(e)
    if (handle) {
      const file = await handle.getFile()
      const type = detectParser(file.name); setParserType(type)
      const content = await file.text()
      processText(content, type, handle)
    } else {
      const file = e.dataTransfer.files[0]; if (!file) return
      const type = detectParser(file.name); setParserType(type)
      file.text().then(c => processText(c, type))
    }
  }, [processText])

  const handleDeleteSave = (id: string) => {
    if (confirmDeleteId === id) {
      deleteSave(id)
        .then(() => setSaves(s => s.filter(x => x.id !== id)))
        .catch(() => {})
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: 22, letterSpacing: 0.5 }}>DB Viewer</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#4b5563', fontSize: 13 }}>{user?.email}</span>
          <button onClick={signOut} style={{ fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', background: 'transparent', cursor: 'pointer' }}>
            Sign out
          </button>
          <button onClick={onLangToggle} style={{ fontSize: 14, fontWeight: 600, padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af', background: 'transparent', cursor: 'pointer' }}>
            {lang === 'en' ? 'RU' : 'EN'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 48, padding: '48px 48px', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 32, margin: 0 }}>Open schema</h2>
            <p style={{ color: '#6b7280', fontSize: 16, marginTop: 6, marginBottom: 0 }}>Upload or paste your database schema</p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PARSERS.map(p => (
              <button key={p.value} onClick={() => setParserType(p.value)} style={{ padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', background: parserType === p.value ? '#6366f1' : 'rgba(255,255,255,0.07)', color: parserType === p.value ? 'white' : '#9ca3af' }}>
                {p.label}
              </button>
            ))}
          </div>

          <div
            onClick={handleOpenClick}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{ border: `2px dashed ${dragging ? '#6366f1' : 'rgba(255,255,255,0.12)'}`, borderRadius: 20, padding: '52px 40px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)', transition: 'all .2s' }}
          >
            <input id="file-input-fallback" type="file" style={{ display: 'none' }} onChange={onFileFallback} accept=".json,.prisma,.sql,.ts,.py" />
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>📂</div>
            <p style={{ color: '#9ca3af', fontSize: 17, margin: '0 0 6px' }}>Drop file here or click to upload</p>
            <p style={{ color: '#4b5563', fontSize: 14, margin: '0 0 10px' }}>.json · .prisma · .sql · .ts · .py</p>
            {hasFileAccess && (
              <span style={{ fontSize: 12, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '3px 10px', borderRadius: 20 }}>
                ✓ Direct file save supported
              </span>
            )}
          </div>

          <div>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder="...or paste schema text here"
              style={{ width: '100%', height: 140, borderRadius: 16, padding: '16px 18px', fontSize: 14, fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            <button
              onClick={() => processText(text, parserType)}
              disabled={!text.trim()}
              style={{ marginTop: 10, width: '100%', padding: '14px', borderRadius: 14, fontSize: 16, fontWeight: 700, color: 'white', cursor: text.trim() ? 'pointer' : 'default', background: text.trim() ? '#6366f1' : 'rgba(99,102,241,0.3)', border: 'none' }}
            >
              Visualize →
            </button>
          </div>

          {error && (
            <div style={{ borderRadius: 14, padding: '14px 18px', fontSize: 14, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              {error}
            </div>
          )}

          <button onClick={() => processText(DEMO_SCHEMA, 'json')} style={{ fontSize: 14, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0 }}>
            Load demo schema
          </button>
        </div>

        <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 24, flexShrink: 0 }}>
          <div>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 32, margin: 0 }}>{t.savedSchemas}</h2>
            <p style={{ color: '#6b7280', fontSize: 16, marginTop: 6, marginBottom: 0 }}>{t.savedAt}</p>
          </div>

          {savesLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#4b5563', fontSize: 14 }}>Loading...</span>
            </div>
          ) : saves.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.07)', borderRadius: 20, padding: 60, gap: 14 }}>
              <span style={{ fontSize: 52 }}>🗄️</span>
              <span style={{ color: '#4b5563', fontSize: 15, textAlign: 'center' }}>{t.noSaves}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              {saves.map(save => {
                const isConfirming = confirmDeleteId === save.id
                return (
                  <div key={save.id} style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', padding: '18px 20px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: 17, flex: 1 }}>{save.name}</span>
                      <button
                        onClick={() => handleDeleteSave(save.id)}
                        style={{
                          fontSize: isConfirming ? 12 : 17,
                          background: isConfirming ? '#ef4444' : 'none',
                          border: 'none', cursor: 'pointer',
                          color: isConfirming ? 'white' : '#4b5563',
                          marginLeft: 8, padding: isConfirming ? '4px 8px' : 0,
                          borderRadius: 6, fontWeight: isConfirming ? 700 : 400,
                          transition: 'all 0.2s',
                        }}
                      >
                        {isConfirming ? (lang === 'ru' ? 'Удалить?' : 'Confirm?') : '🗑️'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {save.schema.tables.slice(0, 6).map(tbl => (
                        <span key={tbl.name} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 8, background: tableColor(tbl.name) + '22', color: tableColor(tbl.name) }}>{tbl.name}</span>
                      ))}
                      {save.schema.tables.length > 6 && (
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>+{save.schema.tables.length - 6}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#4b5563', fontSize: 12 }}>{fmtDate(save.saved_at, lang)}</span>
                      <button onClick={() => onOpen({ schema: save.schema, savedId: save.id, savedName: save.name, positions: save.positions })} style={{ fontSize: 14, fontWeight: 700, padding: '8px 20px', borderRadius: 10, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}>
                        {t.open}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const DEMO_SCHEMA = JSON.stringify({ tables: [
  { name: "users", columns: [{ name: "id", type: "integer", primaryKey: true, nullable: false }, { name: "role_id", type: "integer", nullable: false, foreignKey: { table: "roles", column: "id" } }, { name: "email", type: "varchar", nullable: false, unique: true }] },
  { name: "roles", columns: [{ name: "id", type: "integer", primaryKey: true, nullable: false }, { name: "name", type: "varchar", nullable: false, unique: true }] },
  { name: "posts", columns: [{ name: "id", type: "integer", primaryKey: true, nullable: false }, { name: "user_id", type: "integer", nullable: false, foreignKey: { table: "users", column: "id" } }, { name: "title", type: "varchar", nullable: false }] },
]}, null, 2)
