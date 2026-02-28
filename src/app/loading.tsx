export default function Loading() {
  return (
    <div className="flex h-screen overflow-x-auto bg-slate-100 p-4 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-[280px] shrink-0 bg-slate-200 rounded-xl animate-pulse"
        >
          <div className="px-3 py-2.5 h-10 bg-slate-300 rounded-t-xl" />
          <div className="p-2 flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-20 bg-slate-300 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
