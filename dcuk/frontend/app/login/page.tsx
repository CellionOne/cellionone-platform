"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"

const DEMO_USERS = [
  { name: "Sarah Mitchell", email: "sarah.mitchell@acs.demo", role: "Sales Director" },
  { name: "James Patel", email: "james.patel@acs.demo", role: "Head of Sales / BG+P" },
  { name: "Priya Sharma", email: "priya.sharma@acs.demo", role: "Sales Strategy" },
  { name: "Michael O'Connor", email: "michael.oconnor@acs.demo", role: "Finance Director" },
  { name: "Aisha Begum", email: "aisha.begum@acs.demo", role: "Head of F&B Cost" },
  { name: "Helen Ashworth", email: "helen.ashworth@acs.demo", role: "CEO (ET)" },
  { name: "Vikram Mehta", email: "vikram.mehta@acs.demo", role: "Head of Legal" },
  { name: "Jenny Liu", email: "jenny.liu@acs.demo", role: "H&S / Compliance" },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("demo2026")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await api.login(email, password)
      router.push("/dashboard/portfolio")
    } catch {
      setError("Invalid credentials. Use demo2026 as password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">dC</div>
          <h1 className="text-2xl font-semibold text-gray-900">ACS Tender Management</h1>
          <p className="text-sm text-gray-500 mt-1">Illustrative prototype — stakeholder review</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="first.last@acs.demo"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Demo users (password: demo2026)</p>
          <div className="grid grid-cols-2 gap-1">
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                onClick={() => setEmail(u.email)}
                className="text-left px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="text-xs font-medium text-gray-900">{u.name}</div>
                <div className="text-xs text-gray-500">{u.role}</div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          ⚠ Illustrative prototype — not a production system
        </p>
      </div>
    </div>
  )
}
