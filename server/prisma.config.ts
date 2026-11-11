import { defineConfig } from '@prisma/config'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })
dotenv.config()

const rawDatabaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
const isPostgres =
  rawDatabaseUrl.startsWith('postgres://') ||
  rawDatabaseUrl.startsWith('postgresql://')
const cliUrl = isPostgres
  ? process.env.DIRECT_URL || rawDatabaseUrl
  : rawDatabaseUrl

export default defineConfig({
  schema: isPostgres ? 'prisma/schema.prisma' : 'prisma/schema.sqlite.prisma',
  datasource: {
    url: cliUrl,
  },
})

