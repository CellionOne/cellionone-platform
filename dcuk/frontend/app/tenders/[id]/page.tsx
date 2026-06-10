"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { api, formatCurrency, formatDate, getToken, getUser, STAGE_LABELS, PERSONA_LABELS } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { StageChip } from "@/components/StageChip"
import { RASCIBadge } from "@/components/RASCIBadge"
import { IllustrativeBadge } from "@/components/IllustrativeBadge"
import Link from "next/link"

interface Tender {
  id: number
  tender_ref: string
  customer_name: string
  current_stage_key: string
  branch: string
  status: string
  estimated_contract_value_gbp: number | null
  customer_deadline: string | null
  received_date: string | null
  submission_format: string | null
  scope_summary: string | null
  response_posture: string | null
  is_renewal: boolean
  et_sla_deadline: string | null
  my_rasci: string
  can_advance: boolean
}

interface AuditEntry {
  id: number
  timestamp_utc: string
  stage_key: string
  actor_name: string
  rasci_capacity: string
  action: string
  comment: string | null
}

const STAGE_ORDER = [
  "receive_tender", "notify_inner_circle", "interpret_requirements", "initial_financial_view",
  "brief_heads_of", "strategy_floor", "submit_dtp", "et_go_nogo", "branch_decision",
  "communicate_strategy", "element_loop", "element_exceptions", "finalise_mpl",
  "collate_proposal", "review_outputs", "co_approve", "et_approve_submission",
  "submit_to_customer", "post_submission",
]

export default function TenderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [tender, setTender] = useState<Tender | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [advanceComment, setAdvanceComment] = useState("")
  const [rasciError, setRasciError] = useState("")
  const [loading, setLoading] = useState(true)
  const user = getUser()

  const load = () => {
    Promise.all([
      api.get(`/api/tenders/${id}`),
      api.get(`/api/tenders/${id}/audit`),
    ]).then(([t, a]) => {
      setTender(t)
      setAudit(a)
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    load()
  }, [id, router])

  const handleAdvance = async () => {
    if (!tender) return
    setAdvancing(true)
    setRasciError("")
    try {
      await api.post(`/api/tenders/${id}/advance`, { comment: advanceComment })
      load()
      setAdvanceComment("")
    } catch (err: unknown) {
      setRasciError(err instanceof Error ? err.message : "Advance failed")
    } finally {
      setAdvancing(false)
    }
  }

  const handleBranch = async (branch: "light" | "full") => {
    setRasciError("")
    try {
      await api.post(`/api/tenders/${id}/branch`, { branch, comment: `Branch set to ${branch} path` })
      load()
    } catch (err: unknown) {
      setRasciError(err instanceof Error ? err.message : "Branch failed")
    }
  }

  const handleETDecision = async (decision: string) => {
    setRasciError("")
    try {
      await api.post(`/api/tenders/${id}/et-decision`, {
        stage_key: tender?.current_stage_key,
        decision,
        rationale: advanceComment || `${decision} decision recorded.`,
      })
      load()
      setAdvanceComment("")
    } catch (err: unknown) {
      setRasciError(err instanceof Error ? err.message : "ET decision failed")
    }
  }

  const handleCoApprove = async () => {
    setRasciError("")
    try {
      await api.post(`/api/tenders/${id}/co-approve`, {})
      load()
    } catch (err: unknown) {
      setRasciError(err instanceof Error ? err.message : "Co-approval failed")
    }
  }

  if (loading) return <Layout><div className="p-8 text-gray-500">Loading…</div></Layout>
  if (!tender) return <Layout><div className="p-8 text-red-500">Tender not found</div></Layout>

  const stageIdx = STAGE_ORDER.indexOf(tender.current_stage_key)
  const currentStage = tender.current_stage_key

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm text-gray-500">{tender.tender_ref}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${tender.status === "active" ? "bg-green-100 text-green-700" :
                  tender.status === "submitted" ? "bg-blue-100 text-blue-700" :
                  tender.status === "won" ? "bg-emerald-100 text-emerald-700" :
                  "bg-gray-100 text-gray-600"}`}>
                {tender.status}
              </span>
              {tender.is_renewal && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Renewal</span>}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{tender.customer_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>Received {formatDate(tender.received_date)}</span>
              <span>Deadline {formatDate(tender.customer_deadline)}</span>
              <span>{formatCurrency(tender.estimated_contract_value_gbp)}</span>
              {tender.response_posture && <span className="capitalize">{tender.response_posture} response</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Your RASCI at current stage</div>
              <RASCIBadge code={tender.my_rasci} />
            </div>
          </div>
        </div>

        {/* Stage progress */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {STAGE_ORDER.map((sk, i) => {
              const isLight = tender.branch === "light" && (sk === "element_loop" || sk === "element_exceptions")
              const isPast = i < stageIdx
              const isCurrent = i === stageIdx
              const isFuture = i > stageIdx
              return (
                <div key={sk} className="flex items-center gap-1">
                  <div className={`text-xs px-2 py-1 rounded whitespace-nowrap transition-colors
                    ${isCurrent ? "bg-brand-500 text-white font-semibold" :
                      isPast ? "bg-green-100 text-green-700" :
                      isLight ? "bg-gray-50 text-gray-300 line-through" :
                      "bg-gray-100 text-gray-400"}`}
                    title={STAGE_LABELS[sk]}>
                    {sk.replace(/_/g, " ").slice(0, 12)}
                  </div>
                  {i < STAGE_ORDER.length - 1 && <div className="text-gray-200 text-xs">›</div>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Main area */}
          <div className="col-span-2 space-y-5">
            {/* Current stage card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Current stage</h2>
                  <StageChip stageKey={currentStage} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium
                    ${tender.branch === "full" ? "bg-blue-50 text-blue-700" :
                      tender.branch === "light" ? "bg-purple-50 text-purple-700" :
                      "bg-gray-100 text-gray-500"}`}>
                    {tender.branch || "pending"} path
                  </span>
                </div>
              </div>

              {/* Branch decision */}
              {currentStage === "branch_decision" && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-sm font-medium text-amber-900 mb-2">Branch routing decision required</div>
                  <p className="text-xs text-amber-700 mb-3">
                    Light path criteria: renewal ✓, value &lt; £500k, deadline &lt; 5 working days.
                    Auto-suggested: <strong>{(tender.is_renewal && (tender.estimated_contract_value_gbp || 0) < 500000) ? "light" : "full"}</strong>
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => handleBranch("full")}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      Full path (element loop)
                    </button>
                    <button onClick={() => handleBranch("light")}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                      Light path (skip element loop)
                    </button>
                  </div>
                </div>
              )}

              {/* ET Go/No-Go */}
              {currentStage === "et_go_nogo" && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm font-medium text-red-900 mb-1">ET Go / No-Go — 24h SLA</div>
                  {tender.et_sla_deadline && (
                    <div className="text-xs text-red-700 mb-3">
                      SLA deadline: {new Date(tender.et_sla_deadline).toLocaleString("en-GB")}
                      {" "}({Math.max(0, Math.round((new Date(tender.et_sla_deadline).getTime() - Date.now()) / 3600000))}h remaining)
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleETDecision("go")}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                      Go ✓
                    </button>
                    <button onClick={() => handleETDecision("no_go")}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                      No-Go ✗
                    </button>
                  </div>
                </div>
              )}

              {/* Co-approve */}
              {currentStage === "co_approve" && (
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-sm font-medium text-purple-900 mb-2">Co-approval required — Sales Director + Finance Director</div>
                  <button onClick={handleCoApprove}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                    Record my approval
                  </button>
                </div>
              )}

              {/* Advance stage */}
              <div className="space-y-2">
                <input
                  value={advanceComment}
                  onChange={e => setAdvanceComment(e.target.value)}
                  placeholder="Optional comment for audit trail"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                {rasciError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    🚫 {rasciError}
                  </div>
                )}
                <button
                  onClick={handleAdvance}
                  disabled={advancing || !tender.can_advance}
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={!tender.can_advance ? `RASCI block: your code is ${tender.my_rasci} — only AR or A can advance` : ""}
                >
                  {advancing ? "Advancing…" : "→ Advance to next stage"}
                </button>
                {!tender.can_advance && (
                  <p className="text-xs text-gray-500">
                    Your RASCI at this stage is <strong>{tender.my_rasci}</strong>. Only Accountable (A or AR) users can advance the stage.
                  </p>
                )}
              </div>
            </div>

            {/* Navigation to sub-pages */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: `/tenders/${id}/capture-plan`, label: "Capture Plan", desc: "Day 2 templated document", icon: "📋" },
                { href: `/tenders/${id}/strategy-meeting`, label: "Strategy Meeting", desc: "Day 2 — floor + decisions", icon: "🎯" },
                { href: `/tenders/${id}/dtp`, label: "DTP Pack", desc: "Day 3 ET recommendation", icon: "📊" },
                { href: `/tenders/${id}/elements/fb_cost`, label: "Element Loop", desc: "Day 3–5 — 8 elements", icon: "🔄" },
                { href: `/tenders/${id}/mpl`, label: "MPL", desc: "Day 5 — Master Price List", icon: "💷", illustrative: true },
                { href: `/tenders/${id}/submission-pack`, label: "Submission Pack", desc: "Day 10 collation", icon: "📦" },
                { href: `/tenders/${id}/audit-trail`, label: "Audit Trail", desc: "Full immutable history", icon: "📜" },
              ].map(({ href, label, desc, icon, illustrative }) => (
                <Link key={href} href={href}
                  className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition-colors">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                      {label}
                      {illustrative && <span className="text-xs text-amber-600">⚠</span>}
                    </div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Details */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Tender details</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Scope</dt>
                  <dd className="text-gray-800 text-xs mt-0.5">{tender.scope_summary || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Format</dt>
                  <dd className="text-gray-800">{tender.submission_format || "—"}</dd>
                </div>
              </dl>
            </div>

            {/* Recent audit */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Recent activity</h3>
                <Link href={`/tenders/${id}/audit-trail`} className="text-xs text-brand-600 hover:underline">View all</Link>
              </div>
              <div className="space-y-2">
                {audit.slice(-5).reverse().map(e => (
                  <div key={e.id} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">{e.actor_name}</span>
                      <RASCIBadge code={e.rasci_capacity} />
                    </div>
                    <div className="text-gray-600 mt-0.5">{e.action}</div>
                    <div className="text-gray-400">{new Date(e.timestamp_utc).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
