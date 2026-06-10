"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { api, getToken, STAGE_LABELS } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { RASCIBadge } from "@/components/RASCIBadge"
import Link from "next/link"

interface AuditEntry {
  id: number
  timestamp_utc: string
  stage_key: string
  actor_name: string
  rasci_capacity: string
  action: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  comment: string | null
}

export default function AuditTrailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [tender, setTender] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    Promise.all([
      api.get(`/api/tenders/${id}`),
      api.get(`/api/tenders/${id}/audit`),
    ]).then(([t, a]) => {
      setTender(t)
      setEntries(a.reverse())
    }).catch(console.error).finally(() => setLoading(false))
  }, [id, router])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/tenders/${id}`} className="text-sm text-brand-600 hover:underline">← {tender?.tender_ref as string}</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Audit Trail</h1>
          <span className="text-xs text-gray-500">— immutable, {entries.length} entries</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Timestamp (UTC)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">RASCI</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                    {new Date(e.timestamp_utc).toLocaleString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit"
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{STAGE_LABELS[e.stage_key] || e.stage_key}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">{e.actor_name}</td>
                  <td className="px-4 py-3"><RASCIBadge code={e.rasci_capacity} /></td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-mono">{e.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Audit entries are immutable. No entry can be deleted or edited. Every action is timestamped and attributed.
        </p>
      </div>
    </Layout>
  )
}
