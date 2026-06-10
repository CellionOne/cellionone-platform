"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { api, getToken, formatDate } from "@/lib/api"
import { Layout } from "@/components/Layout"
import Link from "next/link"

export default function StrategyMeetingPage() {
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
          <h1 className="text-xl font-semibold text-gray-900">Day 2 Strategy Meeting</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-blue-900">KEY GATE — Agree response strategy + floor</div>
            <div className="text-xs text-blue-700 mt-1">Chair: Sales Director · RASCI: Sales Director AR, Head of Sales S, Sales Strategy R, FD R</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor (£)</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 2800000" readOnly value={(((tender?.estimated_contract_value_gbp as number) || 0) * 0.88).toFixed(0)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor margin %</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="8.0" defaultValue="8.0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target margin %</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="14.0" defaultValue="14.0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Response posture</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="light">Light</option>
                <option value="tailored">Tailored</option>
                <option value="mastery">Mastery (full)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Decisions recorded</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={4}
              defaultValue={"Full response path agreed\nFloor set at target (8% minimum)\nTarget margin 14%"} />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
            Saving this record writes to the audit trail (actor + RASCI capacity timestamped). Only Sales Director (AR) can sign off.
          </div>

          <button className="bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
            Save strategy meeting record
          </button>
        </div>
      </div>
    </Layout>
  )
}
