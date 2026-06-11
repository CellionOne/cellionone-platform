"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, formatCurrency, formatDate, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"
import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface Airline {
  id: number
  name: string
  type: string
  review_date: string | null
  spend_gbp_m: number | null
  is_acs_customer: boolean
  uk_airports: string[]
  Apex_overlap_countries?: string[]
}

interface AirportData {
  airport: string
  total_spend: number
  caterers: Record<string, number>
  airlines: Array<{ name: string; caterer: string; spend_gbp_m: number; is_acs: boolean }>
}

const CATERER_COLOURS: Record<string, string> = {
  "acs": "#3b5bdb",
  "Gate Gourmet": "#f03e3e",
  "Alpha LSG": "#f59e0b",
  "Swissport": "#7950f2",
  "self-catering": "#868e96",
  "unknown": "#ced4da",
}

export default function SalesStrategyDashboard() {
  const router = useRouter()
  const [pipeline, setPipeline] = useState<Airline[]>([])
  const [airports, setAirports] = useState<AirportData[]>([])
  const [opportunities, setOpportunities] = useState<Airline[]>([])
  const [widgets, setWidgets] = useState<Record<string, unknown> | null>(null)
  const [hoveredAirport, setHoveredAirport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    Promise.all([
      api.get("/api/airlines/pipeline"),
      api.get("/api/airlines/competitor-map"),
      api.get("/api/airlines/global-opportunities"),
      api.get("/api/dashboards/sales-strategy/widgets"),
    ]).then(([p, a, o, w]) => {
      setPipeline(p)
      setAirports(a.sort((x: AirportData, y: AirportData) => y.total_spend - x.total_spend))
      setOpportunities(o)
      setWidgets(w)
    }).catch(console.error).finally(() => setLoading(false))
  }, [router])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  const upcomingPipeline = pipeline.filter(a => {
    if (!a.review_date) return false
    const months = (new Date(a.review_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
    return months <= 24
  })

  const winLoss = widgets?.win_loss_summary as Record<string, number> | null

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Sales Strategy Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Strategic market intelligence — contract pipeline, competitor map, global opportunities</p>
          </div>
          <IllustrativeBadge />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Widget A — Contract Pipeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Contract pipeline — next 24 months</h2>
            <p className="text-xs text-gray-400 mb-4">Upcoming airline contract reviews</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {upcomingPipeline.map(a => {
                const reviewDate = a.review_date ? new Date(a.review_date) : null
                const monthsOut = reviewDate ? Math.round((reviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)) : null
                return (
                  <Link key={a.id} href={`/airlines/${a.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{a.name}</div>
                      <div className="text-xs text-gray-500">
                        {a.type.replace("_", " ")} · {a.uk_airports.slice(0, 3).join(", ")}
                        {a.uk_airports.length > 3 ? ` +${a.uk_airports.length - 3}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-900">{formatDate(a.review_date)}</div>
                      <div className={`text-xs ${monthsOut && monthsOut <= 3 ? "text-red-600 font-medium" : monthsOut && monthsOut <= 6 ? "text-amber-600" : "text-gray-500"}`}>
                        {monthsOut != null ? `${monthsOut}m` : ""}
                      </div>
                      <div className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${a.is_acs_customer ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.is_acs_customer ? "ACS" : "competitor"}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Widget B — Competitor Map */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Competitor map — UK airports</h2>
            <p className="text-xs text-gray-400 mb-4">Bubble size = total airline spend. Hover for airline detail.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {airports.map(ap => {
                const dominant = Object.entries(ap.caterers).sort((a, b) => b[1] - a[1])[0]
                const isHovered = hoveredAirport === ap.airport
                return (
                  <div key={ap.airport}
                    onMouseEnter={() => setHoveredAirport(ap.airport)}
                    onMouseLeave={() => setHoveredAirport(null)}
                    className="border border-gray-100 rounded-lg p-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: CATERER_COLOURS[dominant?.[0]] || "#ccc", fontSize: 11 }}>
                        {ap.airport}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{ap.airport} · £{ap.total_spend.toFixed(1)}m total</div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {Object.entries(ap.caterers).map(([cat, spend]) => (
                            <span key={cat} className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: (CATERER_COLOURS[cat] || "#ccc") + "20", color: CATERER_COLOURS[cat] || "#666" }}>
                              {cat}: £{spend.toFixed(1)}m
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {isHovered && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Airlines at {ap.airport}:</div>
                        {ap.airlines.map(al => (
                          <div key={al.name} className="text-xs text-gray-700 py-0.5">
                            {al.name} — <span style={{ color: CATERER_COLOURS[al.caterer] || "#666" }}>{al.caterer}</span> · £{al.spend_gbp_m.toFixed(1)}m
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Widget C — Global Opportunities */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Global opportunity finder</h2>
            <p className="text-xs text-gray-400 mb-4">Airlines not yet ACS customers where Apex Group has presence</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {opportunities.slice(0, 12).map(a => (
                <Link key={a.id} href={`/airlines/${a.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{a.name}</div>
                    <div className="text-xs text-gray-500">
                      Apex overlap: {a.Apex_overlap_countries?.join(", ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold">{formatCurrency((a.spend_gbp_m || 0) * 1000000)}</div>
                    <div className="text-xs text-gray-400">{formatDate(a.review_date)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Widget D — Tenders Won/Lost */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Tenders won / lost — historical</h2>
            <p className="text-xs text-gray-400 mb-4">Last 24 months. All illustrative data.</p>
            {winLoss && (
              <div className="space-y-4">
                <div className="flex gap-6">
                  {Object.entries(winLoss).map(([outcome, count]) => (
                    <div key={outcome}>
                      <div className={`text-2xl font-bold ${outcome === "won" ? "text-green-600" : outcome === "lost" ? "text-red-600" : "text-gray-500"}`}>
                        {count as number}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{outcome}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={[{ name: "Outcomes", ...winLoss }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="won" fill="#2f9e44" name="Won" />
                    <Bar dataKey="lost" fill="#f03e3e" name="Lost" />
                    <Bar dataKey="withdrawn" fill="#868e96" name="Withdrawn" />
                  </BarChart>
                </ResponsiveContainer>
                <Link href="/dashboard/performance" className="text-xs text-brand-600 hover:underline">
                  → Full performance analysis
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
