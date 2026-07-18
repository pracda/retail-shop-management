package com.mart.module.assistant.service;

import com.mart.common.exception.AppException;
import com.mart.module.assistant.config.AssistantProperties;
import com.mart.module.assistant.dto.AssistantConfigResponse;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages the per-store AI assistant gateway key and resolves which key a request should use.
 *
 * <p>Resolution order for a store: the store's own key → the server-wide default
 * ({@code LLM_GATEWAY_API_KEY}). This is what makes a multi-store deployment work — each store
 * can bring its own gateway org key, while single-store setups just use the server default.
 */
@Service
@RequiredArgsConstructor
public class AssistantConfigService {

    private final StoreRepository storeRepository;
    private final AssistantProperties props;

    @Transactional(readOnly = true)
    public AssistantConfigResponse getConfig(Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> AppException.notFound("Store not found"));
        String storeKey = store.getAssistantGatewayApiKey();
        boolean storeKeyConfigured = notBlank(storeKey);
        boolean serverDefault = hasServerDefaultCreds();
        String source = storeKeyConfigured ? "store" : (serverDefault ? "default" : "none");
        return new AssistantConfigResponse(
                props.isEnabled(),
                storeKeyConfigured,
                !storeKeyConfigured && serverDefault,
                storeKeyConfigured ? mask(storeKey) : null,
                source);
    }

    @Transactional
    public void setStoreKey(Long storeId, String rawKey) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> AppException.notFound("Store not found"));
        store.setAssistantGatewayApiKey(notBlank(rawKey) ? rawKey.trim() : null);
        storeRepository.save(store);
    }

    /** The API key to use for this store's requests, or "" if none is configured anywhere. */
    @Transactional(readOnly = true)
    public String resolveApiKey(Long storeId) {
        String storeKey = storeRepository.findById(storeId)
                .map(Store::getAssistantGatewayApiKey).orElse(null);
        if (notBlank(storeKey)) return storeKey.trim();
        return props.getGatewayApiKey() == null ? "" : props.getGatewayApiKey().trim();
    }

    /** True if this store can authenticate to the gateway (store key, default key, or login). */
    @Transactional(readOnly = true)
    public boolean hasUsableCredentials(Long storeId) {
        if (notBlank(resolveApiKey(storeId))) return true;
        return notBlank(props.getGatewayToken()) || notBlank(props.getGatewayUsername());
    }

    private boolean hasServerDefaultCreds() {
        return notBlank(props.getGatewayApiKey())
                || notBlank(props.getGatewayToken())
                || notBlank(props.getGatewayUsername());
    }

    /** Show enough of the key to recognise it, without revealing it: "gw_live_v2…_psk". */
    private static String mask(String key) {
        String k = key.trim();
        if (k.length() <= 14) return "****";
        return k.substring(0, 10) + "…" + k.substring(k.length() - 4);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
