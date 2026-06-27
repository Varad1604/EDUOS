# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM rust:1.75-slim-bookworm AS builder

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies by copying only manifests first
COPY Cargo.toml Cargo.lock ./
COPY backend/Cargo.toml ./backend/

# Create dummy main to cache the dependency build
RUN mkdir -p backend/src && echo "fn main() {}" > backend/src/main.rs
RUN cargo build --release --package eduos-backend 2>/dev/null || true
RUN rm -rf backend/src

# Copy actual source
COPY backend/src ./backend/src
COPY migrations ./migrations

# Build the real binary
RUN touch backend/src/main.rs && cargo build --release --package eduos-backend

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y \
    ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/eduos-backend ./eduos-backend
COPY --from=builder /app/migrations ./migrations

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["./eduos-backend"]
