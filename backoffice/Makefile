.PHONY: dev build test lint clean docker-build docker-run deps

dev:
	go run ./cmd/server

build:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/server

test:
	go test ./... -v -race -count=1

test-cover:
	go test ./... -v -race -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html

lint:
	golangci-lint run ./...

clean:
	rm -rf bin/ coverage.out coverage.html

docker-build:
	docker build -t ai-pajak-backoffice .

docker-run:
	docker run --rm -p 8080:8080 --env-file .env ai-pajak-backoffice

deps:
	go mod download && go mod tidy
