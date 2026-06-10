import { RASCI_LABELS } from "@/lib/api"

export function RASCIBadge({ code }: { code: string }) {
  const info = RASCI_LABELS[code] || RASCI_LABELS["-"]
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${info.colour}`} title={info.label}>
      {code}
    </span>
  )
}
