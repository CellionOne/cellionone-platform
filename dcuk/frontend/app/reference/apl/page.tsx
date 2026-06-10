"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"

interface APLItem {
  id: number
  product_name: string
  category: string
  sub_category: string
  supplier: string
  agreed_price_gbp: number
  unit: string
  status: string
}

export default function APLPage() {
  const router = useRouter()
  const [items, setItems] = useState<APLItem[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get("/api/reference/apl").then(setItems).catch(console.error).finally(() => setLoading(false))
  }, [router])

  const filtered = items.filter(i =>
    filter === "" ||
    i.product_name.toLowerCase().includes(filter.toLowerCase()) ||
    i.supplier.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Approved Product List (APL)</h1>
            <p className="text-sm text-gray-500">{items.length} items</p>
          </div>
          <IllustrativeBadge />
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search products or suppliers…"
          className="w-full mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Price (£)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Unit</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 capitalize">{item.category}</span>
                    {item.sub_category && <span className="text-xs text-gray-400"> · {item.sub_category}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{item.supplier}</td>
                  <td className="px-4 py-3 text-right font-medium">£{item.agreed_price_gbp.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.unit}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                      ${item.status === "active" ? "bg-green-100 text-green-700" :
                        item.status === "pending_review" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-500"}`}>
                      {item.status}
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
