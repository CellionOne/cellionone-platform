"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api, formatDate, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"
import Link from "next/link"

export default function AirlineDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [airline, setAirline] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get(`/api/airlines/${id}`).then(setAirline).catch(console.error).finally(() => setLoading(false))
  }, [id, router])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>
  if (!airline) return <Layout><div className="p-8 text-red-500">Airline not found</div></Layout>

  const presence = airline.airport_presence as Array<{ airport: string; caterer: string; is_acs: boolean }> || []

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/airlines" className="text-sm text-brand-600 hover:underline">← Airlines</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">{airline.name as string}</h1>
          <IllustrativeBadge />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Profile</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium capitalize">{(airline.type as string).replace("_", " ")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">HQ Country</dt>
                <dd className="font-medium">{airline.hq_country as string}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Annual spend</dt>
                <dd className="font-medium">{airline.estimated_annual_spend_gbp_m ? `£${airline.estimated_annual_spend_gbp_m as number}m` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Next review</dt>
                <dd className="font-medium">{formatDate(airline.estimated_next_review_date as string)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">ACS customer</dt>
                <dd>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${airline.is_acs_customer ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {airline.is_acs_customer ? "Yes" : "No — prospect"}
                  </span>
                </dd>
              </div>
            </dl>
            {airline.notes && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Notes</div>
                <div className="text-xs text-gray-700 bg-gray-50 rounded p-2">{airline.notes as string}</div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">UK airport presence</h2>
              <div className="space-y-2">
                {presence.map(p => (
                  <div key={p.airport} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.airport}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium
                      ${p.is_acs ? "bg-blue-100 text-blue-700" :
                        p.caterer === "unknown" ? "bg-gray-100 text-gray-400" :
                        "bg-red-50 text-red-700"}`}>
                      {p.caterer}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Operations</h2>
              <div className="text-xs text-gray-600">
                <div className="mb-1"><span className="font-medium">UK airports:</span> {(airline.uk_airports_served as string[])?.join(", ") || "—"}</div>
                <div><span className="font-medium">Other countries:</span> {(airline.other_countries_operated as string[])?.join(", ") || "—"}</div>
              </div>
            </div>

            <Link href={`/tenders/new?airline=${id}`}
              className="block text-center bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
              Create tender for this airline
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}
