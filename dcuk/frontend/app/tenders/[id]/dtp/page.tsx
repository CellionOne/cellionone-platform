"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api, formatCurrency, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import Link from "next/link"

export default function DTPPage() {
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/tenders/${id}`} className="text-sm text-brand-600 hover:underline">← {tender?.tender_ref as string}</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">DTP — Decision to Proceed</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-purple-900">Day 3 — Submit recommendation to ET</div>
            <div className="text-xs text-purple-700 mt-1">Sales Director (AR) submits. Triggers 24h ET SLA clock.</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Opportunity introduction</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3}
              defaultValue={`Strategic opportunity with ${tender?.customer_name}. Estimated contract value ${formatCurrency(tender?.estimated_contract_value_gbp as number)}.`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Win strategy</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3}
              defaultValue="Competitive pricing supported by strong culinary proposition and proven operational reliability at key UK airports." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model sense-check</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2}
              defaultValue="Financial model reviewed. Margin at target parameters. Floor validated by Finance Director." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Recommendation</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="go">Go — proceed to full response</option>
              <option value="conditional">Conditional — proceed subject to ET conditions</option>
              <option value="no_go">No-Go — withdraw from this tender</option>
            </select>
          </div>

          <button className="bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
            Submit DTP to ET — start 24h SLA clock
          </button>
        </div>
      </div>
    </Layout>
  )
}
