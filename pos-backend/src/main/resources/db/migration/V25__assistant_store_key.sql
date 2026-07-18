-- Per-store AI assistant gateway API key.
-- NULL/blank => the store falls back to the server default (LLM_GATEWAY_API_KEY env).
-- This lets each store in a multi-store deployment use its own gateway org key.
ALTER TABLE stores ADD COLUMN assistant_gateway_api_key VARCHAR(255) NULL;
