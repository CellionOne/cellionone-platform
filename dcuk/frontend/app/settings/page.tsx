"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, getToken, getUser } from "@/lib/api"
import { Layout } from "@/components/Layout"

interface Setting {
  key: string
  value: unknown
  description: string
  category: string
  updated_by_name: string | null
  updated_at: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  sla: "SLA Defaults",
  branch_routing: "Branch Routing Rules",
  pricing: "Pricing Parameters",
  general: "General",
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const user = getUser()

  const canEdit = user?.persona_key && ["sales_director", "finance_director", "executive_team"].includes(user.persona_key)

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    api.get("/api/reference/settings").then(setSettings).catch(console.error).finally(() => setLoading(false))
  }, [router])

  const handleSave = async (key: string) => {
    setSaving(key)
    try {
      const val = editing[key]
      const parsed = isNaN(Number(val)) ? (val === "true" ? true : val === "false" ? false : val) : Number(val)
      await api.put(`/api/reference/settings/${key}`, { value: parsed })
      setSavedMsg(key)
      setTimeout(() => setSavedMsg(null), 2000)
      const updated = await api.get("/api/reference/settings")
      setSettings(updated)
      setEditing(prev => { const n = { ...prev }; delete n[key]; return n })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(null)
    }
  }

  const grouped = settings.reduce((acc, s) => {
    const cat = s.category || "general"
    acc[cat] = acc[cat] || []
    acc[cat].push(s)
    return acc
  }, {} as Record<string, Setting[]>)

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            System configuration — SLAs, branch routing, pricing parameters. All changes are audit-logged.
          </p>
          {!canEdit && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Read-only view. Only Sales Director, Finance Director or Executive Team may change settings.
            </div>
          )}
        </div>

        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">{CATEGORY_LABELS[cat] || cat}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map(s => (
                <div key={s.key} className="px-4 py-3 flex items-start gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 font-mono">{s.key}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>
                    {s.updated_by_name && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Last changed by {s.updated_by_name} · {s.updated_at ? new Date(s.updated_at).toLocaleDateString("en-GB") : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <>
                        <input
                          value={editing[s.key] !== undefined ? editing[s.key] : String(s.value)}
                          onChange={e => setEditing(prev => ({ ...prev, [s.key]: e.target.value }))}
                          className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                        />
                        {editing[s.key] !== undefined && editing[s.key] !== String(s.value) && (
                          <button onClick={() => handleSave(s.key)} disabled={saving === s.key}
                            className="px-3 py-1 bg-brand-500 text-white rounded text-xs font-medium hover:bg-brand-600 disabled:opacity-50">
                            {saving === s.key ? "…" : savedMsg === s.key ? "✓" : "Save"}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-gray-900 text-right w-28">{String(s.value)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
