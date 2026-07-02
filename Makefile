SHELL := /bin/zsh

.PHONY: install dev build test lint typecheck inspect-schema select-pilot sync-pilot

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
