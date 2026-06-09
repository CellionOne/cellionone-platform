-- Migration 0017: CIE events, NGX dividends, CIE reports, and real-time price fields on cie_securities

-- ── Real-time price/signal fields on cie_securities ─────────────────────────
ALTER TABLE cie_securities
  ADD COLUMN IF NOT EXISTS last_price_kobo INTEGER,
  ADD COLUMN IF NOT EXISTS previous_close_kobo INTEGER,
  ADD COLUMN IF NOT EXISTS day_change_pct NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS week_change_pct NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS month_change_pct NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS ytd_change_pct NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS latest_volume INTEGER,
  ADD COLUMN IF NOT EXISTS rsi NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS momentum VARCHAR(10),
  ADD COLUMN IF NOT EXISTS signal VARCHAR(5),
  ADD COLUMN IF NOT EXISTS recommendation VARCHAR(10),
  ADD COLUMN IF NOT EXISTS investment_intel TEXT,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ;

-- ── cie_events ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cie_events (
  id SERIAL PRIMARY KEY,
  source_app VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  ticker VARCHAR(20),
  payload JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cie_events_ticker ON cie_events(ticker);
CREATE INDEX IF NOT EXISTS idx_cie_events_type ON cie_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cie_events_processed ON cie_events(is_processed);
CREATE INDEX IF NOT EXISTS idx_cie_events_occurred ON cie_events(occurred_at);

-- ── ngx_dividends ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ngx_dividends (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  dividend_amount_kobo INTEGER NOT NULL,
  qualification_date VARCHAR(20) NOT NULL,
  payment_date VARCHAR(20),
  declared_at TIMESTAMPTZ,
  source VARCHAR(50) DEFAULT 'manual_admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ngx_div_ticker ON ngx_dividends(ticker);
CREATE INDEX IF NOT EXISTS idx_ngx_div_qual_date ON ngx_dividends(qualification_date);
CREATE INDEX IF NOT EXISTS idx_ngx_div_active ON ngx_dividends(is_active);

-- ── cie_reports ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cie_reports (
  id SERIAL PRIMARY KEY,
  report_date VARCHAR(20) NOT NULL,
  file_path VARCHAR(500),
  file_size INTEGER,
  securities_count INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_cie_reports_date ON cie_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_cie_reports_status ON cie_reports(status);
