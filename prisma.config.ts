import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: 'file:gyver?mode=memory&cache=shared' },
  migrations: { path: 'prisma/migrations' },
})
