"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import Link from "next/link"

export default function CapturePlanPage() {
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

  const sections = [
    { key: "customer_brief", label: "Customer brief", placeholder: "Describe the customer, their routes, and why they are going to market." },
    { key: "why_in_market", label: "Why customer is in market", placeholder: "Contract expiry, cost review, service issues with incumbent, new routes…" },
    { key: "key_dates", label: "Key dates", placeholder: "Tender receipt, strategy meeting, DTP, element loop, MPL, submission." },
    { key: "response_posture", label: "Response posture", placeholder: "Light / Tailored / Mastery — and rationale." },
    { key: "initial_financial_summary", label: "Initial financial summary", placeholder: "Estimated value, margin target, floor, key cost drivers." },
    { key: "decisions_to_take", label: "Decisions for strategy meeting", placeholder: "List the specific decisions the Day 2 strategy meeting must resolve." },
  ]

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/tenders/${id}`} className="text-sm text-brand-600 hover:underline">← {tender?.tender_ref as string}</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Capture Plan</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
            Day 2 deliverable · Owner: Head of Sales / BG+P (AR) · Required before strategy meeting.
          </div>

          {sections.map(s => (
            <div key={s.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{s.label}</label>
              <textarea
                rows={3}
                placeholder={s.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          ))}

          <button className="bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
            Save capture plan
          </button>
        </div>
      </div>
    </Layout>
  )
}
