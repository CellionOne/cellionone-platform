"use client"

export function IllustrativeBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`illustrative-badge ${className}`} title="This content is illustrative data for stakeholder review. It does not represent committed business artefacts.">
      ⚠ ILLUSTRATIVE — for stakeholder review, not committed
    </span>
  )
}
