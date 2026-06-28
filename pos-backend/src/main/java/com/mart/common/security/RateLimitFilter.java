package com.mart.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-process sliding-window rate limiter for public ecommerce endpoints.
 *
 * Limits:
 *  - Auth endpoints (/ecommerce/auth/*): 20 req/min per IP  — brute-force protection
 *  - Catalog endpoints (/ecommerce/catalog/*): 120 req/min per IP
 *
 * Production systems should replace this with Redis-backed rate limiting
 * (e.g., Bucket4j + Redis) for multi-instance support.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long  WINDOW_MS       = 60_000L;
    private static final int   AUTH_LIMIT       = 20;
    private static final int   CATALOG_LIMIT    = 120;

    /** IP → sliding window of request timestamps */
    private final ConcurrentHashMap<String, Deque<Long>> authWindows    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Long>> catalogWindows = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.contains("/ecommerce/");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String ip   = getClientIp(request);

        boolean isAuth    = path.contains("/ecommerce/auth/");
        boolean isCatalog = path.contains("/ecommerce/catalog/");

        if (isAuth && isRateLimited(ip, authWindows, AUTH_LIMIT)) {
            writeTooManyRequests(response);
            return;
        }
        if (isCatalog && isRateLimited(ip, catalogWindows, CATALOG_LIMIT)) {
            writeTooManyRequests(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isRateLimited(
            String ip,
            ConcurrentHashMap<String, Deque<Long>> windows,
            int limit) {

        long now = System.currentTimeMillis();
        windows.compute(ip, (k, deque) -> {
            if (deque == null) deque = new ArrayDeque<>();
            while (!deque.isEmpty() && now - deque.peekFirst() > WINDOW_MS) {
                deque.pollFirst();
            }
            deque.addLast(now);
            return deque;
        });
        Deque<Long> deque = windows.get(ip);
        return deque != null && deque.size() > limit;
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"success\":false,\"message\":\"Too many requests. Please slow down.\"}");
    }
}
