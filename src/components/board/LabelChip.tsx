'use client'

export default function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  )
}
