# Makefile for luci-metabase-mcp
# Mirrors luciverse-system-config: `make build` runs `make verify` first.

SHELL := /bin/bash
IMAGE ?= luci-metabase-mcp:local

.PHONY: build verify verify-docs test docker-build threads

build: verify
	npm run build:fast

verify: verify-docs
	@echo "[verify] Shell syntax checks"
	@bash -n scripts/*.sh
	@echo "[verify] TypeScript, lint, format"
	@npm run validate

verify-docs:
	@./scripts/check-changelog.sh

test:
	npm run test:coverage

threads:
	npm run lucia:threads -- --check

docker-build:
	docker build -t $(IMAGE) .
