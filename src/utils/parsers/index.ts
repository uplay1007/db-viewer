import type { Schema } from '../../types/schema'
import { parseJSON } from './json'
import { parsePrisma } from './prisma'
import { parseSQL } from './sql'
import { parseTypeORM } from './typeorm'
import { parseDjango } from './django'
import { parseSQLAlchemy } from './sqlalchemy'

export type ParserType = 'json' | 'prisma' | 'sql' | 'typeorm' | 'django' | 'sqlalchemy'

export function detectParser(filename: string): ParserType {
  if (filename.endsWith('.prisma')) return 'prisma'
  if (filename.endsWith('.sql')) return 'sql'
  if (filename.endsWith('.json')) return 'json'
  if (filename.endsWith('.ts')) return 'typeorm'
  if (filename.endsWith('.py')) return 'django'
  return 'json'
}

export function parseSchema(text: string, type: ParserType): Schema {
  switch (type) {
    case 'json': return parseJSON(text)
    case 'prisma': return parsePrisma(text)
    case 'sql': return parseSQL(text)
    case 'typeorm': return parseTypeORM(text)
    case 'django': return parseDjango(text)
    case 'sqlalchemy': return parseSQLAlchemy(text)
  }
}
