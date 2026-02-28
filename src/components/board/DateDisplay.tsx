'use client'

const formatter = new Intl.DateTimeFormat('fi-FI', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

export default function DateDisplay({ dueDate }: { dueDate: string | null }) {
  if (dueDate === null) {
    return null
  }

  const date = new Date(dueDate)
  const isOverdue = date < new Date()
  const formatted = formatter.format(date)

  return (
    <span
      className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}
    >
      {formatted}
    </span>
  )
}
