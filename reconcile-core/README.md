# reconcile-core

Generic reconciliation engine — industry-agnostic core library powered by Claude AI.

## Prerequisites

- Node.js 18+
- An Anthropic API key

## Setup

```bash
cd reconcile-core
npm install
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY
```

## Running tests

```bash
npm test
```

This runs the test harness against both a clean CSV pair and a messy/inconsistent text pair. Results are printed to stdout.

## Building

```bash
npm run build
# Output goes to ./dist/
```

## Usage

```typescript
import { reconcile, ReconciliationConfig } from 'reconcile-core';

const config: ReconciliationConfig = {
  dateToleranceDays: 3,
  amountTolerance: { type: 'absolute', value: 5 },
  nameMatchMode: 'fuzzy',
};

const result = await reconcile(rawSetA, rawSetB, config);
console.log(result.summary.narrative);
```
