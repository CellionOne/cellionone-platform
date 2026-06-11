"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, formatDate, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"
import Link from "next/link"

interface Airline {
  id: number
  name: string
  type: string
  hq_country: string
  uk_airports_served: string[]
  estimated_annual_spend_gbp_m: number | null
  estimated_next_review_date: string | null
  is_acs_customer: boolean
}

export default function AirlinesPage() {
  const router = useRouter()
  const [airlines, setAirlines] = useState<Airline[]>([])
  const [filter, setFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get("/api/airlines/").then(setAirlines).catch(console.error).finally(() => setLoading(false))
  }, [router])

  const filtered = airlines.filter(a =>
    (filter === "" || a.name.toLowerCase().includes(filter.toLowerCase()) || a.hq_country.toLowerCase().includes(filter.toLowerCase())) &&
    (typeFilter === "" || a.type === typeFilter)
  )

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Airline Directory</h1>
            <p className="text-sm text-gray-500 mt-0.5">{airlines.length} airlines — strategic reference data</p>
          </div>
          <IllustrativeBadge />
        </div>

        <div className="flex gap-3 mb-5">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search by name or country…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All types</option>
            <option value="full_service">Full service</option>
            <option value="low_cost">Low cost</option>
            <option value="charter">Charter</option>
            <option value="cargo">Cargo</option>
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Airline</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">HQ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">UK airports</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Annual spend</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Next review</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/airlines/${a.id}`} className="font-medium text-brand-600 hover:underline">{a.name}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${a.type === "full_service" ? "bg-blue-50 text-blue-700" :
                        a.type === "low_cost" ? "bg-orange-50 text-orange-700" :
                        a.type === "charter" ? "bg-purple-50 text-purple-700" :
                        "bg-gray-100 text-gray-600"}`}>
                      {a.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.hq_country}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{a.uk_airports_served?.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">
                    {a.estimated_annual_spend_gbp_m ? `£${a.estimated_annual_spend_gbp_m}m` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(a.estimated_next_review_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${a.is_acs_customer ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.is_acs_customer ? "ACS customer" : "prospect"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
