const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("dcuk_token")
}

export function setToken(token: string, user: object) {
  localStorage.setItem("dcuk_token", token)
  localStorage.setItem("dcuk_user", JSON.stringify(user))
}

export function clearToken() {
  localStorage.removeItem("dcuk_token")
  localStorage.removeItem("dcuk_user")
}

export function getUser(): Record<string, string> | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("dcuk_user")
  return raw ? JSON.parse(raw) : null
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    window.location.href = "/login"
    throw new Error("Unauthorised")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Request failed")
  }
  return res.json()
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: object) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: object) => request(path, { method: "PUT", body: JSON.stringify(body) }),

  login: async (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password })
    const res = await fetch(`${API}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    })
    if (!res.ok) throw new Error("Invalid credentials")
    const data = await res.json()
    setToken(data.access_token, data.user)
    return data.user
  },

  uploadAtria: async (file: File) => {
    const token = getToken()
    const form = new FormData()
    form.append("file", file)
    const res = await fetch(`${API}/api/upload/atria`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) throw new Error("Upload failed")
    return res.json()
  },
}

// RASCI codes
export const RASCI_LABELS: Record<string, { label: string; colour: string }> = {
  AR: { label: "Accountable + Responsible", colour: "bg-blue-100 text-blue-800" },
  A:  { label: "Accountable", colour: "bg-purple-100 text-purple-800" },
  R:  { label: "Responsible", colour: "bg-green-100 text-green-800" },
  S:  { label: "Support", colour: "bg-yellow-100 text-yellow-800" },
  C:  { label: "Consulted", colour: "bg-orange-100 text-orange-800" },
  I:  { label: "Informed", colour: "bg-gray-100 text-gray-600" },
  "-": { label: "Not engaged", colour: "bg-gray-50 text-gray-400" },
}

export const STAGE_LABELS: Record<string, string> = {
  receive_tender: "Day 0 — Receive Tender",
  notify_inner_circle: "Day 0–1 — Notify Inner Circle",
  interpret_requirements: "Day 1 — Interpret Requirements",
  initial_financial_view: "Day 1–2 — Initial Financial View",
  brief_heads_of: "Day 2 — Brief Heads of",
  strategy_floor: "Day 2 — Agree Strategy + Floor",
  submit_dtp: "Day 3 — Submit DTP to ET",
  et_go_nogo: "Day 3 — ET Go / No-Go",
  branch_decision: "Day 3 — Branch Decision",
  communicate_strategy: "Day 3 — Communicate Strategy + Assign",
  element_loop: "Day 3–5 — Element Loop (×8)",
  element_exceptions: "Day 3–5 — Element Exceptions",
  finalise_mpl: "Day 5 — Update Model + Finalise MPL",
  collate_proposal: "Day 10 — Collate Proposal",
  review_outputs: "Day 10 — Review vs Strategy",
  co_approve: "Day 11 — Submit + Co-Approve",
  et_approve_submission: "Day 11 — ET Approve Submission",
  submit_to_customer: "Day 12 — Submit to Customer",
  post_submission: "Post — Negotiation & Contracting",
}

export const PERSONA_LABELS: Record<string, string> = {
  sales_director: "Sales Director",
  head_of_sales: "Head of Sales / BG+P",
  sales_strategy: "Sales Strategy",
  finance_director: "Finance Director",
  head_of_function: "Head of Function",
  executive_team: "Executive Team",
  group: "Group",
  supporting_functions: "Supporting Functions",
}

export function formatCurrency(v: number | null | undefined): string {
  if (v == null) return "—"
  if (v >= 1000000) return `£${(v / 1000000).toFixed(1)}m`
  if (v >= 1000) return `£${(v / 1000).toFixed(0)}k`
  return `£${v.toFixed(0)}`
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
