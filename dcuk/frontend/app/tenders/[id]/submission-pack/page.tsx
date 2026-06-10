"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api, getToken, formatDate } from "@/lib/api"
import { Layout } from "@/components/Layout"
import Link from "next/link"

export default function SubmissionPackPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [tender, setTender] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get(`/api/tenders/${id}`).then(setTender).catch(console.error).finally(() => setLoading(false))
  }, [id, router])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  const components = [
    { name: "F&B Cost element", status: "complete", version: "v2" },
    { name: "Culinary Proposition", status: "complete", version: "v1" },
    { name: "Price element", status: "complete", version: "v3" },
    { name: "Procurement element", status: "in_progress", version: "v1" },
    { name: "Business Info", status: "complete", version: "v1" },
    { name: "Contract (Legal)", status: "complete", version: "v1" },
    { name: "Ops Solution", status: "complete", version: "v2" },
    { name: "Value Proposition", status: "complete", version: "v1" },
    { name: "Master Price List (MPL)", status: "complete", version: "v2" },
    { name: "Financial model", status: "complete", version: "v3" },
    { name: "Audit trail summary", status: "auto", version: "—" },
    { name: "Win strategy narrative", status: "complete", version: "v1" },
  ]

  const gaps = components.filter(c => c.status === "in_progress")

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/tenders/${id}`} className="text-sm text-brand-600 hover:underline">← {tender?.tender_ref as string}</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Submission Pack — Day 10</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
            Day 10 — Collate parts of proposal. Head of Sales / BG+P (AR). One-click assembly pulling latest versions.
          </div>

          {gaps.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm font-medium text-red-800 mb-1">⚠ {gaps.length} gap(s) detected</div>
              {gaps.map(g => (
                <div key={g.name} className="text-xs text-red-700">· {g.name} — not complete</div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {components.map(c => (
              <div key={c.name} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="text-sm text-gray-800">{c.name}</div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{c.version}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${c.status === "complete" ? "bg-green-100 text-green-700" :
                      c.status === "auto" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"}`}>
                    {c.status === "auto" ? "auto-generated" : c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button disabled={gaps.length > 0}
              className="bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Assemble submission pack
            </button>
            {gaps.length > 0 && <span className="text-xs text-gray-500 self-center">Resolve gaps before assembling</span>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
