package com.mart.module.assistant.dto;

/**
 * Assistant configuration status for a store. The raw key is never returned — only a masked
 * {@code keyPreview} and flags describing what's in effect.
 */
public record AssistantConfigResponse(
        boolean gatewayConfigured,   // the server has a gateway URL (feature switch)
        boolean storeKeyConfigured,  // this store has its own API key set
        boolean usingServerDefault,  // no store key, but a server-wide default key exists
        String keyPreview,           // masked store key (e.g. "gw_live_v2…_psk"), or null
        String source                // "store" | "default" | "none"
) {}
