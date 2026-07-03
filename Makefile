SHELL := /bin/zsh

.PHONY: install dev build test lint typecheck inspect-schema select-pilot sync-pilot \
  pipeline-discover pipeline-eligibility pipeline-consolidate pipeline-classify \
  pipeline-publish-cards progress-list progress-reset review-list review-reset \
  bindings-list bindings-reset traceability-matrix

install:
	bun install

dev:
	bun run dev -- --help

build:
	bun run build

test:
	bun run test

lint:
	bun run lint

typecheck:
	bun run typecheck

inspect-schema:
	bun run dev -- schema:inspect

select-pilot:
	bun run dev -- schema:select-pilot

sync-pilot:
	bun run dev -- sync:pilot

pipeline-discover:
	bun run dev -- pipeline:discover

pipeline-eligibility:
	bun run dev -- pipeline:eligibility --candidates $(CANDIDATES)

pipeline-consolidate:
	bun run dev -- pipeline:consolidate --facts $(FACTS) --eligibility $(ELIGIBILITY) --currency $(CURRENCY)

pipeline-classify:
	bun run dev -- pipeline:classify --transactions $(TRANSACTIONS) --catalog $(CATALOG)

pipeline-publish-cards:
	bun run dev -- pipeline:publish-cards --cards $(CARDS)

progress-list:
	bun run dev -- progress:list

progress-reset:
	bun run dev -- progress:reset $(SCOPE)

review-list:
	bun run dev -- review:list $(SCOPE)

review-reset:
	bun run dev -- review:reset $(SCOPE)

bindings-list:
	bun run dev -- bindings:list

bindings-reset:
	bun run dev -- bindings:reset $(REF)

traceability-matrix:
	bun run dev -- traceability:matrix \
	  --snapshot $(SNAPSHOT) \
	  --eligibility $(ELIGIBILITY) \
	  --consolidated $(CONSOLIDATED) \
	  --classified $(CLASSIFIED) \
	  --issues $(ISSUES) \
	  --output $(OUTPUT)
