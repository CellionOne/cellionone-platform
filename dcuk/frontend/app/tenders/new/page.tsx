"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, getToken } from "@/lib/api"
import { Layout } from "@/components/Layout"
import { useEffect } from "react"

export default function NewTenderPage() {
  const router = useRouter()
  const [step, setStep] = useState<"upload" | "form">("upload")
  const [uploading, setUploading] = useState(false)
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null)
  const [uploadNote, setUploadNote] = useState("")
  const [lowConfidence, setLowConfidence] = useState<string[]>([])
  const [form, setForm] = useState({
    customer_name: "",
    scope_summary: "",
    estimated_contract_value_gbp: "",
    submission_format: "",
    is_renewal: false,
    customer_deadline: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!getToken()) router.replace("/login")
  }, [router])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await api.uploadAtria(file)
      const ext = result.extracted || {}
      setExtracted(ext)
      setUploadNote(result.note)
      setLowConfidence(ext.low_confidence_fields || [])
      setForm(prev => ({
        ...prev,
        customer_name: ext.customer || "",
        scope_summary: ext.scope_summary || "",
        submission_format: ext.submission_format || "",
        customer_deadline: ext.submission_deadline || "",
      }))
      setStep("form")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const tender = await api.post("/api/tenders/", {
        ...form,
        estimated_contract_value_gbp: form.estimated_contract_value_gbp ? Number(form.estimated_contract_value_gbp) : null,
        atria_raw_json: extracted,
      })
      router.push(`/tenders/${tender.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create tender")
    } finally {
      setSubmitting(false)
    }
  }

  const isLowConf = (field: string) => lowConfidence.includes(field)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">New Tender — Day 0 Receipt</h1>
        <p className="text-sm text-gray-500 mb-6">Upload Atria JSON output to pre-fill, or fill manually.</p>

        {step === "upload" && (
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-gray-400 text-sm mb-4">
                <div className="text-4xl mb-2">📄</div>
                <div className="font-medium text-gray-700">Upload Atria extraction output</div>
                <div className="text-xs text-gray-400 mt-1">JSON or PDF</div>
              </div>
              <input
                type="file"
                accept=".json,.pdf"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
                id="atria-upload"
              />
              <label htmlFor="atria-upload"
                className="cursor-pointer bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors inline-block">
                {uploading ? "Uploading…" : "Choose file"}
              </label>
              <div className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                ⚠ Atria must be run externally. Upload the JSON or PDF output here. Direct API integration is a Phase 2 enhancement.
              </div>
            </div>
            <div className="mt-4 text-center">
              <button onClick={() => setStep("form")} className="text-sm text-brand-600 hover:underline">
                Skip — fill manually
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-gray-200 rounded-xl p-6">
            {uploadNote && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                {uploadNote}
              </div>
            )}
            {lowConfidence.length > 0 && (
              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-3">
                Low-confidence extraction: review highlighted fields carefully before confirming.
              </div>
            )}

            {(["customer_name", "scope_summary", "submission_format", "customer_deadline"] as const).map(field => (
              <div key={field}>
                <label className={`block text-sm font-medium mb-1 ${isLowConf(field) ? "text-orange-700" : "text-gray-700"}`}>
                  {field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  {isLowConf(field) && <span className="ml-2 text-xs font-normal text-orange-500">⚠ low confidence — verify</span>}
                </label>
                {field === "scope_summary" ? (
                  <textarea
                    value={form[field]}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                    rows={3}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500
                      ${isLowConf(field) ? "border-orange-300 bg-orange-50" : "border-gray-300"}`}
                  />
                ) : (
                  <input
                    type={field === "customer_deadline" ? "datetime-local" : "text"}
                    value={form[field] as string}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500
                      ${isLowConf(field) ? "border-orange-300 bg-orange-50" : "border-gray-300"}`}
                  />
                )}
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated contract value (£)</label>
              <input
                type="number"
                value={form.estimated_contract_value_gbp}
                onChange={e => setForm(prev => ({ ...prev, estimated_contract_value_gbp: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. 2500000"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_renewal"
                checked={form.is_renewal}
                onChange={e => setForm(prev => ({ ...prev, is_renewal: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="is_renewal" className="text-sm text-gray-700">This is a renewal / re-tender of an existing contract</label>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting}
                className="bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors">
                {submitting ? "Creating…" : "Create tender"}
              </button>
              <button type="button" onClick={() => setStep("upload")}
                className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-4 py-2">
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
