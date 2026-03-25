"use client";

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.04] bg-[#0e1525]/60 p-6 animate-pulse ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-32 rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-full rounded bg-white/[0.04]" />
        <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
        <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3.5 h-3.5 rounded bg-white/[0.06]" />
        <div className="h-2 w-20 rounded bg-white/[0.06]" />
      </div>
      <div className="h-6 w-16 rounded bg-white/[0.06]" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-[#0e1525]/60 p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-40 rounded bg-white/[0.06]" />
      </div>
      {/* Header */}
      <div className="flex gap-4 mb-4 pb-3 border-b border-white/[0.04]">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-3 flex-1 rounded bg-white/[0.04]" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-white/[0.02]">
          {[1,2,3,4,5].map(j => (
            <div key={j} className="h-3 flex-1 rounded bg-white/[0.03]" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-[#0e1525]/60 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-32 rounded bg-white/[0.06]" />
        </div>
        <div className="flex gap-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-6 w-10 rounded bg-white/[0.04]" />
          ))}
        </div>
      </div>
      <div style={{ height }} className="rounded-xl bg-white/[0.02] flex items-end justify-center gap-1 p-4">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-white/[0.04] to-transparent"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ title = "Loading..." }: { title?: string }) {
  return (
    <div className="relative z-10 min-h-screen">
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-8 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
          <div>
            <div className="h-5 w-48 rounded bg-white/[0.06] mb-2" />
            <div className="h-3 w-32 rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map(i => <StatSkeleton key={i} />)}
        </div>
        <ChartSkeleton />
      </div>
    </div>
  );
}
