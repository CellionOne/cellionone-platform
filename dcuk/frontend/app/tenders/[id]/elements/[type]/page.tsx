"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"
import Link from "next/link"

const ELEMENT_NAMES: Record<string, string> = {
  fb_cost: "F&B Cost",
  culinary_proposition: "Culinary Proposition",
  price: "Price",
  procurement: "Procurement",
  business_info: "Business Info",
  contract_legal: "Contract (Legal)",
  ops_solution: "Ops Solution",
  value_proposition: "Value Proposition",
}

const ALL_ELEMENTS = Object.keys(ELEMENT_NAMES)

const STATUS_COLOURS: Record<string, string> = {
  prepare: "bg-gray-100 text-gray-600",
  review: "bg-amber-100 text-amber-700",
  approve: "bg-blue-100 text-blue-700",
  refine: "bg-orange-100 text-orange-700",
  closed: "bg-green-100 text-green-700",
}

export default function ElementPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const type = params?.type as string
  const [elements, setElements] = useState<Array<Record<string, unknown>>>([])
  const [tender, setTender] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState("")

  const load = () => {
    Promise.all([
      api.get(`/api/tenders/${id}`),
      api.get(`/api/tenders/${id}/elements`),
    ]).then(([t, e]) => {
      setTender(t)
      setElements(e)
      const current = e.find((el: Record<string, unknown>) => el.element_key === type)
      if (current?.draft_content) {
        setNotes((current.draft_content as Record<string, unknown>).notes as string || "")
      }
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    load()
  }, [id, type, router])

  const currentElement = elements.find(e => e.element_key === type)

  const handleSave = async (newStatus?: string) => {
    setSaving(true)
    try {
      await api.put(`/api/tenders/${id}/elements/${type}`, {
        draft_content: { notes, sections: {} },
        ...(newStatus ? { status: newStatus } : {}),
      })
      load()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/tenders/${id}`} className="text-sm text-brand-600 hover:underline">← {tender?.tender_ref as string}</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Element Loop — {ELEMENT_NAMES[type] || type}</h1>
          <IllustrativeBadge />
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Element nav */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500 mb-2">8 Elements</div>
            {ALL_ELEMENTS.map(ek => {
              const el = elements.find(e => e.element_key === ek)
              const st = (el?.status as string) || "pending"
              return (
                <Link key={ek} href={`/tenders/${id}/elements/${ek}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                    ${ek === type ? "bg-brand-500 text-white" : "hover:bg-gray-100 text-gray-700"}`}>
                  <span>{ELEMENT_NAMES[ek]}</span>
                  {el && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${ek === type ? "bg-white/20 text-white" : STATUS_COLOURS[st] || "bg-gray-100"}`}>
                      {st}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Element detail */}
          <div className="col-span-3 space-y-5">
            {currentElement ? (
              <>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold">{ELEMENT_NAMES[type]}</h2>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Owner: {currentElement.owner_name as string || "Unassigned"} · Version {currentElement.version_number as number}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOURS[(currentElement.status as string)] || "bg-gray-100"}`}>
                      {currentElement.status as string}
                    </span>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Prepare → Review loop</label>
                    <div className="flex gap-2 text-xs">
                      {["prepare", "review", "approve", "refine", "closed"].map(s => (
                        <span key={s} className={`px-2 py-1 rounded font-medium ${currentElement.status === s ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Draft content / notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={6}
                      placeholder="Enter element draft content, assumptions, and key decisions here..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleSave()} disabled={saving}
                      className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
                      {saving ? "Saving…" : "Save draft"}
                    </button>
                    {currentElement.status === "prepare" && (
                      <button onClick={() => handleSave("review")} disabled={saving}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                        Submit for review →
                      </button>
                    )}
                    {currentElement.status === "review" && (
                      <>
                        <button onClick={() => handleSave("approve")} disabled={saving}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                          Approve →
                        </button>
                        <button onClick={() => handleSave("refine")} disabled={saving}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                          Return for refinement
                        </button>
                      </>
                    )}
                    {currentElement.status === "approve" && (
                      <button onClick={() => handleSave("closed")} disabled={saving}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                        Close element ✓
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Raise exception</h3>
                  <p className="text-xs text-gray-500 mb-3">Flag APL deviation, pricing override, supplier substitution, recipe substitution, or contract clause deviation.</p>
                  <button className="px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-xs font-medium hover:bg-amber-100">
                    ⚠ Raise element exception
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                No element loop started yet. Elements are created when the tender reaches the element loop stage.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
