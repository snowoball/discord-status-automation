# Stage 1: Build
FROM golang:1.25.1-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Install git (for go mod downloads)
RUN apk add --no-cache git

# Copy go.mod and go.sum first (better caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the Go binary
RUN go build -o /discord-status-bot main.go

# Stage 2: Runtime
FROM alpine:latest

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /discord-status-bot .

# Copy static files and default configuration
COPY configuration ./configuration
COPY src ./src

# Copy the environment file
COPY .env .env

# Expose port for webserver
EXPOSE 8080

# Environment variable (default: webserver enabled)
ENV NO_WEB=false

# Volume for persistent configuration
VOLUME ["/app/configuration"]

# Healthcheck (optional, checks if webserver is up)
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/health || exit 0

# Start command - can toggle via env or flag
CMD if [ "$NO_WEB" = "true" ]; then \
        echo "Launching without webserver..." && ./discord-status-bot --no-web; \
    else \
        echo "Launching with webserver..." && ./discord-status-bot; \
    fi
