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
  received_date: string | null
}

export default function TendersPage() {
  const router = useRouter()
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get("/api/tenders/").then(setTenders).catch(console.error).finally(() => setLoading(false))
  }, [router])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">All Tenders</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tenders.length} tenders</p>
          </div>
          <Link href="/tenders/new" className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
            + New Tender
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Value</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Received</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenders.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tenders/${t.id}`} className="font-mono text-xs text-brand-600 hover:underline">{t.tender_ref}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${t.status === "active" ? "bg-green-100 text-green-700" :
                        t.status === "submitted" ? "bg-blue-100 text-blue-700" :
                        t.status === "won" ? "bg-emerald-100 text-emerald-700" :
                        t.status === "lost" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StageChip stageKey={t.current_stage_key} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                      ${t.branch === "full" ? "bg-blue-50 text-blue-700" :
                        t.branch === "light" ? "bg-purple-50 text-purple-700" :
                        "bg-gray-100 text-gray-500"}`}>
                      {t.branch || "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(t.estimated_contract_value_gbp)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(t.received_date)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(t.customer_deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
