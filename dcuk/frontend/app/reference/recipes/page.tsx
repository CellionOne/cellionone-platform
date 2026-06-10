"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"

interface Recipe {
  id: number
  name: string
  category: string
  cabin_class: string
  calculated_cost_gbp: number
  last_reviewed_date: string
}

export default function RecipesPage() {
  const router = useRouter()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get("/api/reference/recipes").then(setRecipes).catch(console.error).finally(() => setLoading(false))
  }, [router])

  const filtered = recipes.filter(r =>
    filter === "" || r.name.toLowerCase().includes(filter.toLowerCase()) || r.cabin_class?.includes(filter.toLowerCase())
  )

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Recipe Database</h1>
            <p className="text-sm text-gray-500">{recipes.length} recipes</p>
          </div>
          <IllustrativeBadge />
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search recipes…"
          className="w-full mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Recipe</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cabin class</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Cost (£)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Last reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                      ${r.cabin_class === "first" ? "bg-purple-100 text-purple-700" :
                        r.cabin_class === "business" ? "bg-blue-100 text-blue-700" :
                        r.cabin_class === "crew" ? "bg-gray-100 text-gray-600" :
                        "bg-green-100 text-green-700"}`}>
                      {r.cabin_class}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.category}</td>
                  <td className="px-4 py-3 text-right font-medium">£{r.calculated_cost_gbp?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.last_reviewed_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
