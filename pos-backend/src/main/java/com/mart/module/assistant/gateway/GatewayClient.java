package com.mart.module.assistant.gateway;

import com.mart.common.exception.AppException;
import com.mart.module.assistant.config.AssistantProperties;
import com.mart.module.assistant.gateway.dto.GatewayChatRequest;
import com.mart.module.assistant.gateway.dto.GatewayChatResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Thin HTTP client for the Secure LLM API Gateway. Handles auth three ways, in priority order:
 *
 * <ul>
 *   <li>an API key ({@code assistant.gateway-api-key}) sent as the {@code X-API-Key} header
 *       (preferred for service-to-service calls — no login round-trip), or</li>
 *   <li>a configured static JWT ({@code assistant.gateway-token}) sent as
 *       {@code Authorization: Bearer <token>}, or</li>
 *   <li>username/password login against {@code POST /api/v1/auth/token}, with the returned
 *       JWT cached and transparently refreshed on a 401.</li>
 * </ul>
 *
 * No Anthropic/OpenAI SDK is involved — the gateway is the only upstream this app knows.
 */
@Slf4j
@Component
public class GatewayClient {

    private static final String CHAT_PATH = "/api/v1/chat";
    private static final String TOKEN_PATH = "/api/v1/auth/token";
    private static final String API_KEY_HEADER = "X-API-Key";

    private final AssistantProperties props;
    private final RestClient http;
    /** Cached JWT from username/password login (null when using a static token). */
    private final AtomicReference<String> cachedToken = new AtomicReference<>();

    public GatewayClient(AssistantProperties props) {
        this.props = props;
        this.http = RestClient.builder()
                .baseUrl(props.getGatewayUrl() == null ? "" : props.getGatewayUrl())
                .build();
    }

    /**
     * Send a chat request using an explicit API key (a store's own key, or the resolved
     * default). Falls back to the global auth chain when {@code apiKeyOverride} is blank.
     */
    public GatewayChatResponse chat(GatewayChatRequest request, String apiKeyOverride) {
        if (apiKeyOverride != null && !apiKeyOverride.isBlank()) {
            try {
                return doChat(request, API_KEY_HEADER, apiKeyOverride.trim());
            } catch (UnauthorizedException e) {
                throw new AppException(HttpStatus.BAD_GATEWAY, "GATEWAY_AUTH_FAILED",
                        "The AI gateway rejected this store's API key. Check the key in Settings.");
            }
        }
        return chat(request);
    }

    /**
     * Send a chat request through the gateway using globally-configured credentials. With an
     * API key the auth header is static; with a login JWT, a 401 triggers one transparent
     * re-authentication and retry.
     */
    public GatewayChatResponse chat(GatewayChatRequest request) {
        if (usingApiKey()) {
            return doChat(request, API_KEY_HEADER, props.getGatewayApiKey().trim());
        }
        try {
            return doChat(request, "Authorization", "Bearer " + bearer());
        } catch (UnauthorizedException e) {
            log.info("Gateway returned 401 — refreshing token and retrying once");
            cachedToken.set(null);
            return doChat(request, "Authorization", "Bearer " + bearer());
        }
    }

    private GatewayChatResponse doChat(GatewayChatRequest request, String headerName, String headerValue) {
        try {
            return http.post()
                    .uri(CHAT_PATH)
                    .header(headerName, headerValue)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .onStatus(status -> status.value() == 401, (req, res) -> {
                        throw new UnauthorizedException();
                    })
                    .body(GatewayChatResponse.class);
        } catch (UnauthorizedException e) {
            throw e;
        } catch (Exception e) {
            log.error("LLM gateway chat call failed: {}", e.getMessage());
            throw new AppException(HttpStatus.BAD_GATEWAY, "GATEWAY_ERROR",
                    "The AI service is temporarily unavailable. Please try again.");
        }
    }

    private boolean usingApiKey() {
        return props.getGatewayApiKey() != null && !props.getGatewayApiKey().isBlank();
    }

    /** Resolve a bearer token: static token if configured, else a cached/fresh login JWT. */
    private String bearer() {
        if (props.getGatewayToken() != null && !props.getGatewayToken().isBlank()) {
            return props.getGatewayToken().trim();
        }
        String token = cachedToken.get();
        if (token != null) {
            return token;
        }
        token = login();
        cachedToken.set(token);
        return token;
    }

    private String login() {
        if (props.getGatewayUsername().isBlank() || props.getGatewayPassword().isBlank()) {
            throw new AppException(HttpStatus.SERVICE_UNAVAILABLE, "ASSISTANT_MISCONFIGURED",
                    "AI assistant credentials are not configured.");
        }
        try {
            Map<?, ?> body = http.post()
                    .uri(TOKEN_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "username", props.getGatewayUsername(),
                            "password", props.getGatewayPassword()))
                    .retrieve()
                    .body(Map.class);
            String token = extractToken(body);
            if (token == null || token.isBlank()) {
                throw new IllegalStateException("no token field in gateway login response");
            }
            log.info("Obtained a fresh gateway JWT for user '{}'", props.getGatewayUsername());
            return token;
        } catch (Exception e) {
            log.error("Gateway login failed: {}", e.getMessage());
            throw new AppException(HttpStatus.BAD_GATEWAY, "GATEWAY_AUTH_FAILED",
                    "Could not authenticate with the AI service.");
        }
    }

    /** The gateway's /auth/token response shape is a generic object — probe common keys. */
    private static String extractToken(Map<?, ?> body) {
        if (body == null) return null;
        for (String key : new String[]{"token", "accessToken", "access_token", "jwt", "idToken"}) {
            Object v = body.get(key);
            if (v instanceof String s && !s.isBlank()) return s;
        }
        return null;
    }

    /** Marker to distinguish an auth failure (retryable once) from other errors. */
    private static final class UnauthorizedException extends RuntimeException {}
}
