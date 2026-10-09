
SHELL = /bin/bash
.SHELLFLAGS = -o pipefail -c

.PHONY: help
help: ## Print info about all commands
	@echo "Commands:"
	@echo
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[01;32m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: build-web
build-web: ## Compile web bundle, copy to bskyweb directory
	bun run intl:build
	bun run build-web

.PHONY: build-go
build-go:
	go -C bskyweb mod download
	go -C bskyweb build -v -trimpath -tags timetzdata -o /tmp/bskyweb ./cmd/bskyweb
	npx wrangler r2 object put tmp/bskyweb --file=/tmp/bskyweb --remote

.PHONY: build-web-embed
build-web-embed: ## Compile web embed bundle, copy to bskyweb/static
	cd bskyembed && bun install
	bun run build-embed

.PHONY: test
test: ## Run all tests
	NODE_ENV=test bun test

.PHONY: lint
lint: ## Run style checks and verify syntax
	bun run lint

#.PHONY: fmt
#fmt: ## Run syntax re-formatting
#	bun prettier

.PHONY: deps
deps: ## Installs dependent libs using 'bun install'
	bun install --frozen-lockfile
	cd bskyembed && bun install --frozen-lockfile

.PHONY: nvm-setup
nvm-setup: ## Use NVM/node to install and activate node
	nvm install 20
	nvm use 20
