// ETag-aware API client — implemented in Phase 8
// Caches version per ticket id; auto-applies If-Match on mutations.
// Selective single auto-retry on 412 for idempotent operations (PUT, auto-classify).
export {};
