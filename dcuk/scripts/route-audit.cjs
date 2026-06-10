#!/usr/bin/env node
/**
 * Route audit — scans all Next.js pages for Link href= references
 * and verifies each route exists as a page file.
 * Exits non-zero if any broken link is found.
 */
const fs = require("fs")
const path = require("path")

const FRONTEND = path.join(__dirname, "..", "frontend", "app")

function collectPages(dir, base = "") {
  const pages = new Set()
  if (!fs.existsSync(dir)) return pages
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = base + "/" + entry.name
      for (const p of collectPages(path.join(dir, entry.name), sub)) {
        pages.add(p)
      }
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      pages.add(base || "/")
    }
  }
  return pages
}

function collectLinks(dir) {
  const links = []
  if (!fs.existsSync(dir)) return links
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      links.push(...collectLinks(full))
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      const content = fs.readFileSync(full, "utf8")
      const matches = content.matchAll(/href=["'`]([^"'`\s]+)["'`]/g)
      for (const m of matches) {
        const href = m[1]
        if (href.startsWith("/") && !href.startsWith("//")) {
          links.push({ file: full.replace(path.join(__dirname, ".."), ""), href })
        }
      }
    }
  }
  return links
}

function normalisePath(href) {
  // Strip query strings and hashes
  const clean = href.split("?")[0].split("#")[0]
  // Replace dynamic segments like [id] or [type] with wildcard
  return clean.replace(/\/[^/]*$/g, s => s.includes("${") ? "/*" : s)
}

const pages = collectPages(FRONTEND)
const links = collectLinks(path.join(__dirname, "..", "frontend"))

// Build a matcher: convert page paths to patterns
function routeExists(href) {
  const clean = href.split("?")[0].split("#")[0]
  if (clean === "/") return pages.has("")
  // exact match
  if (pages.has(clean)) return true
  // dynamic segment match: /tenders/123 → /tenders/[id]
  const segments = clean.split("/").filter(Boolean)
  for (const page of pages) {
    const pageSegs = page.split("/").filter(Boolean)
    if (pageSegs.length !== segments.length) continue
    const match = pageSegs.every((ps, i) => ps.startsWith("[") || ps === segments[i])
    if (match) return true
  }
  return false
}

let broken = 0
for (const { file, href } of links) {
  if (!routeExists(href)) {
    console.error(`BROKEN LINK: ${href} in ${file}`)
    broken++
  }
}

console.log(`Route audit: ${links.length} links checked, ${broken} broken.`)
if (broken > 0) {
  process.exit(1)
} else {
  console.log("All links valid. ✓")
}
