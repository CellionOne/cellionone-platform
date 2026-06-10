"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { api, formatCurrency, getToken, getUser } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"
import Link from "next/link"

interface MPLLineItem {
  category: string
  description: string
  cost: number
  margin_applied: number
  customer_price: number
}

interface MPL {
  id: number
  version_number: number
  status: string
  line_items: MPLLineItem[]
  total_cost: number
  total_price: number
  margin_pct: number
  approved_by_name: string | null
  approved_at: string | null
  is_illustrative: boolean
}

export default function MPLPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [mpl, setMpl] = useState<MPL | null>(null)
  const [tender, setTender] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const user = getUser()

  const load = () => {
    Promise.all([
      api.get(`/api/tenders/${id}`),
      api.get(`/api/tenders/${id}/mpl`),
    ]).then(([t, m]) => {
      setTender(t)
      setMpl(m && m.id ? m : null)
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    load()
  }, [id, router])

  const handleApproval = async (decision: "approved" | "rejected") => {
    setApproving(true)
    setError("")
    try {
      await api.post(`/api/tenders/${id}/mpl/approve`, { decision, comment })
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setApproving(false)
    }
  }

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={`/tenders/${id}`} className="text-sm text-brand-600 hover:underline">← {tender?.tender_ref as string}</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-900">Master Price List (MPL)</h1>
          </div>
          <IllustrativeBadge />
        </div>

        {!mpl ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
            No MPL created yet. MPL is produced at Day 5 (Update financial model + finalise MPL).
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs px-2 py-1 rounded-full font-medium
                ${mpl.status === "approved" ? "bg-green-100 text-green-700" :
                  mpl.status === "rejected" ? "bg-red-100 text-red-700" :
                  mpl.status === "fd_review" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-600"}`}>
                {mpl.status === "fd_review" ? "Awaiting FD review" : mpl.status}
              </span>
              <span className="text-xs text-gray-500">Version {mpl.version_number}</span>
              {mpl.approved_by_name && (
                <span className="text-xs text-gray-500">Approved by {mpl.approved_by_name}</span>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="text-xs font-medium text-gray-500">OWNERSHIP: Sales Strategy (AR — does the work) · Finance Director (A — approves)</div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Line item</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Cost</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Margin %</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Customer price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mpl.line_items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500">{item.category}</td>
                      <td className="px-4 py-3 text-gray-800">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.cost)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{(item.margin_applied * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.customer_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 font-semibold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(mpl.total_cost)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{mpl.margin_pct?.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right font-bold text-brand-700">{formatCurrency(mpl.total_price)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* FD approval panel */}
            {mpl.status === "fd_review" && user?.persona_key === "finance_director" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <div className="text-sm font-semibold text-amber-900 mb-1">Finance Director review required</div>
                <p className="text-xs text-amber-700 mb-3">
                  You are Accountable (A) on MPL finalisation. Sales Strategy has produced this MPL. Your approval advances the tender.
                </p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Approval / rejection comment (optional)"
                  rows={2}
                  className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm mb-3 bg-white"
                />
                {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => handleApproval("approved")} disabled={approving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    Approve MPL
                  </button>
                  <button onClick={() => handleApproval("rejected")} disabled={approving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    Return for revision
                  </button>
                </div>
              </div>
            )}

            {mpl.status === "fd_review" && user?.persona_key !== "finance_director" && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
                Awaiting Finance Director approval. Your RASCI at this stage does not permit MPL approval.
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
