.PHONY: demo seed migrate audit

demo:
	@echo "==> Running route audit..."
	node scripts/route-audit.cjs
	@echo "==> Starting dCUK Tender Management System..."
	docker compose up --build

seed:
	docker compose exec backend python -m app.seed.run_seed

migrate:
	docker compose exec backend alembic upgrade head

audit:
	node scripts/route-audit.cjs

dev-backend:
	cd backend && pip install -r requirements.txt && \
	DATABASE_URL=postgresql://dcuk:dcuk2026@localhost:5433/dcuk_tender \
	alembic upgrade head && \
	DATABASE_URL=postgresql://dcuk:dcuk2026@localhost:5433/dcuk_tender \
	python -m app.seed.run_seed && \
	DATABASE_URL=postgresql://dcuk:dcuk2026@localhost:5433/dcuk_tender \
	uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm install && npm run dev -- --port 3001

dev-db:
	docker compose up db -d
