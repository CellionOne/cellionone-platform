"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, formatCurrency, formatDate, getToken, getUser, PERSONA_LABELS, STAGE_LABELS } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { RASCIBadge } from "@/components/RASCIBadge"
import Link from "next/link"

interface TenderEntry {
  id: number
  tender_ref: string
  customer_name: string
  current_stage_key: string
  estimated_contract_value_gbp: number | null
  customer_deadline: string | null
  rasci_code: string
  sla_status: string
  branch: string
}

interface Summary {
  persona: string
  full_name: string
  action_required: TenderEntry[]
  can_view: TenderEntry[]
}

export default function PersonaDashboard() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const user = getUser()

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get("/api/dashboards/persona-summary")
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  const persona = user?.persona_key || ""

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">My Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {PERSONA_LABELS[persona]} — tenders where you have a RASCI capacity
          </p>
        </div>

        {summary && summary.action_required.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">{summary.action_required.length}</span>
              Action required — you are Accountable at current stage
            </h2>
            <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b border-red-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tender</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">My RASCI</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Value</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Deadline</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.action_required.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/tenders/${t.id}`} className="font-mono text-xs text-brand-600 hover:underline">{t.tender_ref}</Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{t.customer_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{STAGE_LABELS[t.current_stage_key]}</td>
                      <td className="px-4 py-3"><RASCIBadge code={t.rasci_code} /></td>
                      <td className="px-4 py-3">{formatCurrency(t.estimated_contract_value_gbp)}</td>
                      <td className="px-4 py-3">{formatDate(t.customer_deadline)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                          ${t.sla_status === "breached" ? "bg-red-100 text-red-700" :
                            t.sla_status === "approaching" ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"}`}>
                          {t.sla_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {summary && summary.can_view.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3">Tenders you can view (S / C / I)</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tender</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">My RASCI</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.can_view.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/tenders/${t.id}`} className="font-mono text-xs text-brand-600 hover:underline">{t.tender_ref}</Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{t.customer_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{STAGE_LABELS[t.current_stage_key]}</td>
                      <td className="px-4 py-3"><RASCIBadge code={t.rasci_code} /></td>
                      <td className="px-4 py-3">{formatCurrency(t.estimated_contract_value_gbp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {summary && summary.action_required.length === 0 && summary.can_view.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            No active tenders require your attention at this time.
          </div>
        )}
      </div>
    </Layout>
  )
}
