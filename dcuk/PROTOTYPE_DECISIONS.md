# dCUK Tender Management — Prototype Decisions

*Branch: `claude/laughing-bell-9idlo1` | Built: June 2026*

## Architecture

| Layer | Choice | Rationale |
|---|---|---|
| Backend | Python 3.11 + FastAPI + SQLAlchemy | Async-ready, typed, matches team Python familiarity |
| Database | PostgreSQL 15 | JSONB for audit payloads; mature, transactional |
| Auth | JWT (python-jose) + bcrypt | Stateless; demo-ready; swap to SSO in production |
| Frontend | Next.js 14 App Router + Tailwind + Recharts | SSR capability, file-based routing, charting |
| Containerisation | Docker Compose (postgres + backend + frontend) | One-command `make demo` |

---

## Workbook → Code Decisions

### Personas
The workbook RASCI matrix has 8 columns. Column headers map to persona keys:

| Workbook label | `persona_key` |
|---|---|
| Sales Director | `sales_director` |
| Head of Sales | `head_of_sales` |
| Sales Strategy Team | `sales_strategy` |
| Finance Director | `finance_director` |
| Head of Function | `head_of_function` |
| Executive Team | `executive_team` |
| Group | `group` |
| Supporting Functions | `supporting_functions` |

### RASCI Code Semantics
`can_user_act()` in `backend/app/core/rasci.py` is the **single gate**. No controller performs its own RASCI check.

| Action category | Allowed codes |
|---|---|
| `advance` (move stage) | AR, A |
| `work` (edit content, upload) | AR, R |
| `view` | AR, A, R, S, C, I |
| `approve` | AR, A |

### MPL Ownership Conflict (workbook row 18)
Workbook shows Finance Director as AR on `finalise_mpl`. Prompt explicitly resolves: *Sales Strategy = AR (does the work), Finance Director = A (approves)*. This single chain is implemented: Sales Strategy edits the MPL, Finance Director sees an approval panel only on the MPL page.

### Day 3 "Communicate Strategy" Meeting
Prompt resolution: this is captured in-system (a StrategyMeeting record) rather than as a calendar integration. The stage advances once the meeting record is saved.

### Light Path Branch
At `branch_decision` stage, the system evaluates three criteria from `branch_routing.json`:
- Contract value ≤ £500,000
- Is a renewal (not new business)
- Deadline ≤ 5 working days

If all three met → light path (stages `co_approve` and `et_approve_pre_submission` skipped). Otherwise → full path.

### Atria Integration
The workbook references Atria as an external AI extraction tool. **No direct API integration** is implemented. The upload endpoint (`/api/upload/atria`) accepts:
- JSON output from Atria → fields mapped with `confidence: "high"`
- PDF tender documents → fields extracted with `confidence: "low"` with a review-required note

A Phase 2 enhancement note is displayed to users on the upload page.

---

## Non-Negotiable Disciplines (enforced in code)

1. **Illustrative badge** — `<IllustrativeBadge />` rendered on every screen showing financial models, MPL, rate cards, APL, recipes, historical data, airline directory. Component is in `frontend/components/IllustrativeBadge.tsx`.

2. **Audit trail** — Every tender state mutation calls `audit.log()`. The `TenderAuditEntry` table has no DELETE route. No controller may modify tender state without writing an audit row.

3. **No hard-coded stages/RASCI/SLAs** — All sourced from JSON config loaded at startup:
   - `backend/app/config/journey_stages.json` — 19 stages
   - `backend/app/config/rasci_matrix.json` — 19 × 8 matrix
   - `backend/app/config/branch_routing.json` — routing thresholds
   - `backend/app/config/element_types.json` — 8 tender elements

4. **Route audit** — `make demo` runs `node scripts/route-audit.cjs` before starting containers. Exits non-zero on any broken `href=` link.

---

## Demo Users (all password: `demo2026`)

| Name | Email | Persona |
|---|---|---|
| Sarah Mitchell | sarah.mitchell@dcuk.demo | Sales Director |
| James Patel | james.patel@dcuk.demo | Head of Sales |
| Priya Sharma | priya.sharma@dcuk.demo | Sales Strategy |
| David Okafor | david.okafor@dcuk.demo | Sales Strategy |
| Emma Thornton | emma.thornton@dcuk.demo | Finance Director |
| Marcus Webb | marcus.webb@dcuk.demo | Head of Function (Culinary) |
| Aisha Malik | aisha.malik@dcuk.demo | Head of Function (Ops) |
| Robert Chen | robert.chen@dcuk.demo | Executive Team |
| Helen Foster | helen.foster@dcuk.demo | Executive Team |
| Vijay Nair | vijay.nair@dcuk.demo | Group |
| Claudia Reyes | claudia.reyes@dcuk.demo | Supporting Functions |
| Tom Barker | tom.barker@dcuk.demo | Supporting Functions |
| Diane Wu | diane.wu@dcuk.demo | Finance Director |
| Kwame Asante | kwame.asante@dcuk.demo | Head of Sales |

---

## Seed Data Summary

- 40 airlines with UK airport presence and competitor assignments
- 9 active tenders spread across 9 different stages (one per stage)
- 25 historical tenders (8 won, 12 lost, 5 withdrawn) — all flagged `is_illustrative=True`
- 35 rate cards (F&B + non-F&B)
- 50 APL items
- 30 recipes
- 12 configurable app settings (SLAs, pricing, branch routing)

---

## Production Gaps (out of scope for prototype)

- SSO / Azure AD authentication
- Real Atria API integration (Phase 2)
- Email / Teams notifications (stage advance events fire no external calls)
- Document storage (S3 / SharePoint) — uploads go to local `uploads/` volume
- Row-level security (Postgres RLS) — currently all-or-nothing per persona
- Multi-tenant (this prototype is single-tenant dCUK)
