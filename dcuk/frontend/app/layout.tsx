import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "dCUK Tender Management",
  description: "Illustrative prototype — dnata Catering UK tender management system",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
