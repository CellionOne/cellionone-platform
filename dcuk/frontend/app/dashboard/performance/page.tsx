"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

const COLOURS = ["#3b5bdb", "#f03e3e", "#868e96"]

export default function PerformanceDashboard() {
  const router = useRouter()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get("/api/dashboards/performance")
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>
  if (!data) return <Layout><div className="p-8 text-gray-500">No data</div></Layout>

  const monthly = (data.monthly_outcomes as Array<{ month: string; won: number; lost: number; withdrawn: number }>) || []
  const byType = data.win_rate_by_type as Record<string, number> || {}
  const bySize = data.win_rate_by_size as Record<string, number> || {}

  const pieData = [
    { name: "Won", value: data.total_won as number },
    { name: "Lost", value: data.total_lost as number },
    { name: "Withdrawn", value: data.total_withdrawn as number },
  ]

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Performance Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tender outcome metrics and SLA adherence</p>
          </div>
          <IllustrativeBadge />
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-green-600">{data.win_rate_last_12m as number}%</div>
            <div className="text-sm text-gray-500 mt-1">Win rate (last 12m)</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-blue-600">{data.win_rate_last_24m as number}%</div>
            <div className="text-sm text-gray-500 mt-1">Win rate (last 24m)</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-purple-600">{data.sla_adherence_pct as number}%</div>
            <div className="text-sm text-gray-500 mt-1">SLA adherence</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-end gap-1">
              <div className="text-3xl font-bold text-gray-900">~12w</div>
              <div className="text-sm text-gray-500 mb-1">→ target 1w</div>
            </div>
            <div className="text-sm text-gray-500 mt-1">Avg time to submit (current)</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly outcomes (last 24 months)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="won" fill="#2f9e44" name="Won" />
                <Bar dataKey="lost" fill="#f03e3e" name="Lost" />
                <Bar dataKey="withdrawn" fill="#868e96" name="Withdrawn" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Overall outcomes ({data.total_tenders as number} tenders)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={["#2f9e44", "#f03e3e", "#868e96"][i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Win rate by airline type</h2>
            <div className="space-y-3">
              {Object.entries(byType).map(([type, rate]) => (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-gray-600">{type.replace("_", " ")}</span>
                    <span className="font-semibold">{rate}%</span>
                  </div>
                  <div className="bg-gray-100 rounded h-2">
                    <div className="bg-brand-500 h-2 rounded" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Win rate by contract size</h2>
            <div className="space-y-3">
              {Object.entries(bySize).map(([size, rate]) => (
                <div key={size}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-gray-600">
                      {size === "small" ? "Small (&lt;£1m)" : size === "medium" ? "Medium (£1m–£3m)" : "Large (&gt;£3m)"}
                    </span>
                    <span className="font-semibold">{rate}%</span>
                  </div>
                  <div className="bg-gray-100 rounded h-2">
                    <div className="bg-purple-500 h-2 rounded" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          * Performance data based on {data.total_tenders as number} historical tender records. All data is illustrative.
        </p>
      </div>
    </Layout>
  )
}
