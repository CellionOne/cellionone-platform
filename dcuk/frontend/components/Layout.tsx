"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { clearToken, getUser, PERSONA_LABELS } from "@/lib/api"
import { useEffect, useState } from "react"

const NAV = [
  { href: "/dashboard/sales-strategy", label: "Sales Strategy", personas: ["sales_director", "sales_strategy"] },
  { href: "/dashboard/portfolio", label: "Tender Portfolio", personas: ["sales_director", "head_of_sales", "executive_team"] },
  { href: "/dashboard/persona", label: "My Dashboard", personas: null },
  { href: "/dashboard/performance", label: "Performance", personas: ["sales_director", "executive_team", "finance_director"] },
  { href: "/tenders", label: "Tenders", personas: null },
  { href: "/airlines", label: "Airline Directory", personas: null },
  { href: "/reference/rate-cards", label: "Rate Cards", personas: null },
  { href: "/reference/apl", label: "APL", personas: null },
  { href: "/reference/recipes", label: "Recipes", personas: null },
  { href: "/settings", label: "Settings", personas: ["sales_director", "finance_director", "executive_team"] },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  const handleLogout = () => {
    clearToken()
    router.push("/login")
  }

  const visibleNav = NAV.filter(n => !n.personas || !user || n.personas.includes(user.persona_key))

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-6 flex items-center h-14 gap-6">
          <Link href="/dashboard/portfolio" className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-brand-500 flex items-center justify-center text-white text-xs font-bold">dC</span>
            ACS Tender
          </Link>
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            {visibleNav.map(n => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors
                  ${pathname.startsWith(n.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          {user && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-xs font-medium text-gray-900">{user.full_name}</div>
                <div className="text-xs text-gray-500">{PERSONA_LABELS[user.persona_key] || user.persona_key}</div>
              </div>
              <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
      <footer className="border-t border-gray-100 bg-white py-3 px-6 text-center text-xs text-gray-400">
        ACS Tender Management System · Illustrative prototype · Not a committed system · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
