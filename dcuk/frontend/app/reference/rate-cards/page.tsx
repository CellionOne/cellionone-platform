"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"

interface RateCard {
  id: number
  category: string
  line_item_name: string
  cost_gbp: number
  unit: string
  effective_from: string
}

export default function RateCardsPage() {
  const router = useRouter()
  const [cards, setCards] = useState<RateCard[]>([])
  const [cat, setCat] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get(`/api/reference/rate-cards${cat ? `?category=${cat}` : ""}`)
      .then(setCards).catch(console.error).finally(() => setLoading(false))
  }, [router, cat])

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Rate Cards</h1>
            <p className="text-sm text-gray-500 mt-0.5">{cards.length} line items</p>
          </div>
          <IllustrativeBadge />
        </div>
        <div className="mb-4 flex gap-2">
          {["", "fb", "non_fb"].map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${cat === c ? "bg-brand-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {c === "" ? "All" : c === "fb" ? "F&B" : "Non-F&B"}
            </button>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Line item</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Cost (£)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Unit</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cards.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><span className={`text-xs px-1.5 py-0.5 rounded ${c.category === "fb" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{c.category}</span></td>
                  <td className="px-4 py-3 text-gray-800">{c.line_item_name}</td>
                  <td className="px-4 py-3 text-right font-medium">£{c.cost_gbp.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.unit}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.effective_from}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
