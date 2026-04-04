# Cellion Intelligence Engine (CIE) — API Reference

**Version:** 1.0  
**Base URL:** `https://cellionone.com/api/v1/cie`  
**Contact:** api@cellionone.com

---

## Overview

The **Cellion Intelligence Engine (CIE)** is a subscription API that delivers NGX equity intelligence — IAS/RS/CS scores, ranked recommendations, dividend calendars, analyst signals, and sector-rotation insights — to stockbroking firms, fintechs, and wealth managers.

---

## Authentication

All requests must include your API key in the `X-API-Key` header:

```http
X-API-Key: co_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

Keys use the `co_live_` prefix followed by 32 hexadecimal characters. Generate your key at **`/cie/api-keys`** (requires an active CIE subscription).

---

## Subscription Tiers

CIE access is gated by the tier associated with your API key. Pro keys include all Subscriber capabilities.

| Tier | Monthly Price | Rate Limit | Endpoints |
|---|---|---|---|
| **Subscriber** | ₦5,000/mo | 500 req/min | /pulse, /securities, /securities/:ticker, /securities/:ticker/history, /dividends |
| **Pro** | ₦10,000/mo | 1,000 req/min | All Subscriber endpoints + /signals, /sector-rotation |

**Required scopes per tier:**

| Tier | Scope(s) |
|---|---|
| Subscriber | `cie:read` + `cie:subscriber` |
| Pro | `cie:read` + `cie:subscriber` + `cie:pro` |

> **Note:** `/pulse` is readable with any valid CIE key, including free-tier keys.

---

## Error Responses

All errors follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common error codes

| HTTP Status | Code | Description |
|---|---|---|
| `401` | `MISSING_API_KEY` / `INVALID_API_KEY` | Key absent or not found |
| `403` | `INSUFFICIENT_CIE_TIER` | Your key tier is below what the endpoint requires |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many requests — back off and retry |
| `500` | `INTERNAL_ERROR` | Server error |

**403 tier error example:**

```json
{
  "error": "This endpoint requires CIE subscriber tier or higher",
  "currentTier": "free",
  "requiredTier": "subscriber",
  "upgradeUrl": "https://cellionone.com/cie/subscribe",
  "code": "INSUFFICIENT_CIE_TIER"
}
```

---

## Endpoints

---

### GET /api/v1/cie/pulse

**Tier required:** Any (all CIE keys)

Snapshot of Nigerian market macro indicators — ASI index, daily % change, Brent crude price, and Naira/USD rate.

**Request:**

```bash
curl -H "X-API-Key: co_live_YOUR_KEY" \
  https://cellionone.com/api/v1/cie/pulse
```

**Response:**

```json
{
  "available": true,
  "asiIndex": 98752.34,
  "asiDailyChangePct": 0.0042,
  "brentCrudeUsd": 85.12,
  "ngnPerUsd": 1610.50,
  "source": "ngx_official",
  "updatedAt": "2026-04-04T07:30:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `available` | boolean | Whether pulse data is available today |
| `asiIndex` | number | NGX All-Share Index value |
| `asiDailyChangePct` | number | Day-over-day % change (e.g. 0.0042 = +0.42%) |
| `brentCrudeUsd` | number | Brent crude in USD per barrel |
| `ngnPerUsd` | number | Naira per 1 USD (mid rate) |
| `updatedAt` | ISO 8601 | Timestamp of last update |

---

### GET /api/v1/cie/securities

**Tier required:** Subscriber+

Paginated list of all NGX-listed securities with their latest IAS, RS, and CS scores and recommendations.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | integer | No | `1` | Page number |
| `limit` | integer | No | `50` | Results per page (max 100) |
| `sector` | string | No | — | Filter by NGX sector name (case-insensitive) |

**Request:**

```bash
curl -H "X-API-Key: co_live_YOUR_KEY" \
  "https://cellionone.com/api/v1/cie/securities?sector=Banking&limit=20"
```

**Response:**

```json
{
  "securities": [
    {
      "ticker": "DANGCEM",
      "name": "Dangote Cement PLC",
      "sector": "Industrial Goods",
      "ias": 74,
      "rs": 28,
      "cs": 82,
      "recommendation": "Accumulate",
      "scoreDate": "2026-04-04",
      "updatedAt": "2026-04-04T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 148,
    "pages": 3
  }
}
```

**Score fields:**

| Field | Range | Description |
|---|---|---|
| `ias` | 0–100 | Integrated Aggregate Score — composite of 6 weighted pillars |
| `rs` | 0–100 | Relative Strength — security's IAS rank within its sector |
| `cs` | 0–100 | Composite Score — blended technicals and fundamentals |
| `recommendation` | string | Strong Buy \| Accumulate \| Hold \| Reduce \| Sell |

---

### GET /api/v1/cie/securities/:ticker

**Tier required:** Subscriber+

Full score detail for a single NGX security, including pillar breakdown and latest OHLCV price data.

**Path Parameters:**

| Parameter | Description |
|---|---|
| `ticker` | NGX ticker symbol (e.g. `DANGCEM`, `ZENITHBANK`) |

**Request:**

```bash
curl -H "X-API-Key: co_live_YOUR_KEY" \
  https://cellionone.com/api/v1/cie/securities/DANGCEM
```

**Response:**

```json
{
  "ticker": "DANGCEM",
  "name": "Dangote Cement PLC",
  "sector": "Industrial Goods",
  "isin": "NGDANGCEM0008",
  "listingDate": "2010-10-26",
  "sharesOutstanding": 17040507405,
  "latestPrice": {
    "date": "2026-04-04",
    "closeNaira": 512.00,
    "openNaira": 508.50,
    "highNaira": 515.00,
    "lowNaira": 507.00,
    "volume": 1250000
  },
  "scores": {
    "scoreDate": "2026-04-04",
    "ias": 74,
    "rs": 28,
    "cs": 82,
    "recommendation": "Accumulate",
    "pillarBreakdown": {
      "momentum": 68,
      "liquidity": 72,
      "valuation": 80,
      "quality": 76,
      "growth": 71,
      "financialStrength": 79
    },
    "dataPointsUsed": 46,
    "updatedAt": "2026-04-04T08:00:00.000Z"
  }
}
```

**Pillar breakdown (all 0–100):**

| Pillar | Description |
|---|---|
| `momentum` | Price trend and relative performance |
| `liquidity` | Trading volume and bid-ask spread depth |
| `valuation` | P/E, P/B, EV/EBITDA ratios vs sector |
| `quality` | Return on equity, debt/equity, earnings consistency |
| `growth` | Revenue and earnings growth trajectory |
| `financialStrength` | Balance sheet health and solvency ratios |

---

### GET /api/v1/cie/securities/:ticker/history

**Tier required:** Subscriber+

IAS/RS/CS score time series for a security over a configurable lookback window (up to 90 days).

**Path Parameters:**

| Parameter | Description |
|---|---|
| `ticker` | NGX ticker symbol |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `days` | integer | No | `30` | Lookback window, 1–90 |

**Request:**

```bash
curl -H "X-API-Key: co_live_YOUR_KEY" \
  "https://cellionone.com/api/v1/cie/securities/DANGCEM/history?days=14"
```

**Response:**

```json
{
  "ticker": "DANGCEM",
  "name": "Dangote Cement PLC",
  "days": 30,
  "count": 22,
  "history": [
    {
      "date": "2026-04-04",
      "ias": 74,
      "rs": 28,
      "cs": 82,
      "recommendation": "Accumulate"
    },
    {
      "date": "2026-04-03",
      "ias": 71,
      "rs": 30,
      "cs": 80,
      "recommendation": "Accumulate"
    }
  ]
}
```

> Scores are computed after each NGX trading session. Non-trading days (weekends, public holidays) have no entries.

---

### GET /api/v1/cie/dividends

**Tier required:** Subscriber+

NGX ex-dividend calendar with urgency flags, sorted by ex-dividend date ascending.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `upcomingOnly` | boolean | No | `true` | Only return future ex-dates |

**Request:**

```bash
curl -H "X-API-Key: co_live_YOUR_KEY" \
  https://cellionone.com/api/v1/cie/dividends
```

**Response:**

```json
{
  "count": 3,
  "dividends": [
    {
      "ticker": "ZENITHBANK",
      "name": "Zenith Bank PLC",
      "exDividendDate": "2026-04-10",
      "paymentDate": "2026-04-25",
      "amountPerShareNaira": 3.50,
      "urgency": "urgent",
      "notes": "Final dividend FY2025"
    }
  ]
}
```

**Urgency values:**

| Value | Meaning |
|---|---|
| `urgent` | Ex-date ≤ 7 days away |
| `soon` | Ex-date ≤ 21 days away |
| `upcoming` | Ex-date > 21 days away |

---

### GET /api/v1/cie/signals

**Tier required:** Pro

Published analyst intelligence signals — rumours, breaking news, trade calls, and market-wide commentary. Credibility-rated and tagged by security.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `limit` | integer | No | `20` | Max signals returned (1–50) |
| `type` | string | No | `all` | Filter: `rumour` \| `news` \| `trade_call` \| `sector_rotation` \| `all` |

**Request:**

```bash
curl -H "X-API-Key: co_live_YOUR_KEY" \
  "https://cellionone.com/api/v1/cie/signals?type=trade_call&limit=10"
```

**Response:**

```json
{
  "count": 5,
  "signals": [
    {
      "id": 12,
      "ticker": "MTNN",
      "type": "trade_call",
      "sentiment": "bullish",
      "credibility": 4,
      "content": "MTN Nigeria is likely to beat Q1 consensus on ARPU recovery...",
      "tags": ["telecom", "earnings"],
      "publishedAt": "2026-04-04T09:00:00.000Z",
      "expiresAt": "2026-04-11T09:00:00.000Z"
    }
  ]
}
```

**Field reference:**

| Field | Type | Description |
|---|---|---|
| `ticker` | string \| null | NGX ticker (null for market-wide signals) |
| `type` | string | `rumour`, `news`, `trade_call`, `sector_rotation` |
| `sentiment` | string | `bullish`, `bearish`, `neutral` |
| `credibility` | integer 1–5 | 5 = very high confidence, 1 = speculative |
| `content` | string | Full signal text |
| `publishedAt` | ISO 8601 | When the signal was released |
| `expiresAt` | ISO 8601 \| null | Signal expiry (null = no expiry) |

---

### GET /api/v1/cie/sector-rotation

**Tier required:** Pro

Cross-sectional sector rankings derived from average IAS scores. Returns momentum direction and top-3 securities per sector — useful for sector allocation and rotation strategies.

**Request:**

```bash
curl -H "X-API-Key: co_live_YOUR_KEY" \
  https://cellionone.com/api/v1/cie/sector-rotation
```

**Response:**

```json
{
  "scoreDate": "2026-04-04",
  "totalSecurities": 148,
  "sectors": [
    {
      "sector": "Banking",
      "avgIas": 71,
      "maxIas": 88,
      "minIas": 45,
      "count": 22,
      "momentum": "bullish",
      "top3": [
        { "ticker": "ZENITHBANK", "name": "Zenith Bank PLC", "ias": 88, "recommendation": "Strong Buy" },
        { "ticker": "GTCO", "name": "Guaranty Trust Holding Company", "ias": 82, "recommendation": "Accumulate" },
        { "ticker": "ACCESS", "name": "Access Holdings PLC", "ias": 78, "recommendation": "Accumulate" }
      ]
    },
    {
      "sector": "Oil & Gas",
      "avgIas": 34,
      "maxIas": 51,
      "minIas": 18,
      "count": 11,
      "momentum": "bearish",
      "top3": []
    }
  ]
}
```

**Momentum values:**

| Value | Meaning |
|---|---|
| `bullish` | Sector avg IAS ≥ 60 |
| `neutral` | Sector avg IAS 40–59 |
| `bearish` | Sector avg IAS < 40 |

---

## Rate Limiting

When you exceed your tier's rate limit the API returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 15
```

```json
{
  "error": "Rate limit exceeded. Please slow down.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

Implement exponential back-off starting at 1 second when you receive a 429.

---

## Changelog

| Date | Change |
|---|---|
| 2026-04-04 | Initial public release of CIE API v1 |

---

*Cellion One · Lagos, Nigeria · [cellionone.com](https://cellionone.com)*
