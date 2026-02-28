import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:/var/data/taskboard/taskboard.db',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const columns = [
    { name: 'Idea', order: 1000 },
    { name: 'Suunnittelu', order: 2000 },
    { name: 'Toteutus', order: 3000 },
    { name: 'Testaus', order: 4000 },
    { name: 'Valmis', order: 5000 },
  ]

  for (const col of columns) {
    await prisma.column.upsert({
      where: { name: col.name },
      update: {},
      create: col,
    })
  }

  const labels = [
    { name: 'Bugi', color: '#ef4444' },
    { name: 'Ominaisuus', color: '#3b82f6' },
    { name: 'Kiireinen', color: '#f97316' },
    { name: 'Parannus', color: '#22c55e' },
  ]

  for (const label of labels) {
    await prisma.label.upsert({
      where: { name: label.name },
      update: {},
      create: label,
    })
  }

  console.log('Seed complete: 5 columns and 4 labels created')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
