package com.mart.module.assistant.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the store AI assistant. All LLM traffic is routed through the
 * external Secure LLM API Gateway — this app never talks to Anthropic/OpenAI directly.
 *
 * <p>The feature is <b>disabled</b> when {@code gatewayUrl} is blank: the assistant
 * endpoints return 503 and the frontend hides the chat entry points.
 */
@Component
@ConfigurationProperties(prefix = "assistant")
@Getter
@Setter
public class AssistantProperties {

    /** Base URL of the gateway, e.g. {@code http://3.81.99.148:8080}. Blank → feature off. */
    private String gatewayUrl = "";

    /**
     * Gateway API key. When set, it is sent as the {@code X-API-Key} header and no login is
     * needed. This is the preferred credential for service-to-service calls.
     */
    private String gatewayApiKey = "";

    /**
     * Static bearer token (a pre-minted gateway JWT). If set (and no API key is configured),
     * it is sent as {@code Authorization: Bearer <token>} and username/password login is skipped.
     */
    private String gatewayToken = "";

    /** Gateway username — used to log in for a JWT when {@code gatewayToken} is blank. */
    private String gatewayUsername = "";

    /** Gateway password — used together with {@code gatewayUsername}. */
    private String gatewayPassword = "";

    /** Provider to request from the gateway. The gateway validates the model per provider. */
    private String provider = "ANTHROPIC";

    /**
     * Model for admin/manager answers. The live gateway currently only allows
     * {@code claude-haiku-4-5-20251001} for ANTHROPIC; leave blank to use the gateway default.
     */
    private String adminModel = "claude-haiku-4-5-20251001";

    /** Model for cashier answers (kept cheap/fast). */
    private String cashierModel = "claude-haiku-4-5-20251001";

    /** Per-user daily query cap — a second layer under the gateway's own rate limiting. */
    private int dailyQueryCapPerUser = 50;

    /** Request timeout for gateway calls, in seconds. */
    private int requestTimeoutSeconds = 45;

    public boolean isEnabled() {
        return gatewayUrl != null && !gatewayUrl.isBlank();
    }
}
