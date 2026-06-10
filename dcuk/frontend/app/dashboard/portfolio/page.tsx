"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, formatCurrency, formatDate, getToken, STAGE_LABELS } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { StageChip } from "@/components/StageChip"
import Link from "next/link"

interface Tender {
  id: number
  tender_ref: string
  customer_name: string
  current_stage_key: string
  branch: string
  status: string
  estimated_contract_value_gbp: number | null
  customer_deadline: string | null
  et_sla_deadline: string | null
}

interface Summary {
  total_active: number
  by_stage: Record<string, number>
  sla_status: { on_track: number; approaching: number; breached: number }
  by_branch: { full: number; light: number; pending: number }
}

const STAGE_ORDER = [
  "receive_tender", "notify_inner_circle", "interpret_requirements", "initial_financial_view",
  "brief_heads_of", "strategy_floor", "submit_dtp", "et_go_nogo", "branch_decision",
  "communicate_strategy", "element_loop", "element_exceptions", "finalise_mpl",
  "collate_proposal", "review_outputs", "co_approve", "et_approve_submission",
  "submit_to_customer", "post_submission",
]

export default function PortfolioDashboard() {
  const router = useRouter()
  const [tenders, setTenders] = useState<Tender[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    Promise.all([
      api.get("/api/tenders/portfolio/summary"),
      api.get("/api/tenders/"),
    ]).then(([s, t]) => {
      setSummary(s)
      setTenders(t)
    }).catch(console.error).finally(() => setLoading(false))
  }, [router])

  const getSLAStatus = (t: Tender) => {
    if (!t.et_sla_deadline) return null
    const remaining = (new Date(t.et_sla_deadline).getTime() - Date.now()) / 3600000
    if (remaining < 0) return "breached"
    if (remaining < 4) return "approaching"
    return "ok"
  }

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Tender Portfolio</h1>
            <p className="text-sm text-gray-500 mt-0.5">All active tenders across all stages</p>
          </div>
          <Link href="/tenders/new" className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
            + New Tender
          </Link>
        </div>

        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-3xl font-bold text-gray-900">{summary.total_active}</div>
              <div className="text-sm text-gray-500 mt-1">Active tenders</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex gap-3">
                <div>
                  <div className="text-xl font-bold text-green-700">{summary.sla_status.on_track}</div>
                  <div className="text-xs text-gray-500">On track</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-600">{summary.sla_status.approaching}</div>
                  <div className="text-xs text-gray-500">Approaching</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600">{summary.sla_status.breached}</div>
                  <div className="text-xs text-gray-500">Breached</div>
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-1">SLA status</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex gap-3">
                <div>
                  <div className="text-xl font-bold text-blue-700">{summary.by_branch.full}</div>
                  <div className="text-xs text-gray-500">Full path</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-purple-700">{summary.by_branch.light}</div>
                  <div className="text-xs text-gray-500">Light path</div>
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-1">Branch routing</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(tenders.reduce((s, t) => s + (t.estimated_contract_value_gbp || 0), 0))}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total pipeline value</div>
            </div>
          </div>
        )}

        {/* Stage funnel */}
        {summary && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Active tenders by stage</h2>
            <div className="space-y-1.5">
              {STAGE_ORDER.map(sk => {
                const count = summary.by_stage[sk] || 0
                if (count === 0) return null
                return (
                  <div key={sk} className="flex items-center gap-3">
                    <div className="w-48 text-xs text-gray-600 truncate">{STAGE_LABELS[sk]}</div>
                    <div className="flex-1 bg-gray-100 rounded h-5 relative">
                      <div
                        className="bg-brand-500 h-5 rounded transition-all"
                        style={{ width: `${Math.min(100, count * 25)}%` }}
                      />
                    </div>
                    <div className="text-xs font-medium text-gray-700 w-4">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tender list */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Current stage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Value</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Deadline</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenders.map(t => {
                const sla = getSLAStatus(t)
                return (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/tenders/${t.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                        {t.tender_ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.customer_name}</td>
                    <td className="px-4 py-3"><StageChip stageKey={t.current_stage_key} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${t.branch === "full" ? "bg-blue-50 text-blue-700" :
                          t.branch === "light" ? "bg-purple-50 text-purple-700" :
                          "bg-gray-100 text-gray-600"}`}>
                        {t.branch || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatCurrency(t.estimated_contract_value_gbp)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(t.customer_deadline)}</td>
                    <td className="px-4 py-3">
                      {sla && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${sla === "breached" ? "bg-red-100 text-red-700" :
                            sla === "approaching" ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"}`}>
                          {sla === "breached" ? "Breached" : sla === "approaching" ? "Approaching" : "On track"}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
