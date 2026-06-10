import { STAGE_LABELS } from "@/lib/api"

const TYPE_COLOURS: Record<string, string> = {
  gate_meeting: "bg-purple-100 text-purple-800",
  gate: "bg-red-100 text-red-700",
  stage_meeting: "bg-blue-100 text-blue-800",
  stage: "bg-green-100 text-green-700",
}

export function StageChip({ stageKey, type }: { stageKey: string; type?: string }) {
  const label = STAGE_LABELS[stageKey] || stageKey
  const colour = type ? TYPE_COLOURS[type] || "bg-gray-100 text-gray-600" : "bg-gray-100 text-gray-600"
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colour}`}>
      {label}
    </span>
  )
}
