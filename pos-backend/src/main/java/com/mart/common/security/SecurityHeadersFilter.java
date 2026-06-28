package com.mart.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Adds hardened HTTP security headers to every response.
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        response.setHeader("X-Content-Type-Options",  "nosniff");
        response.setHeader("X-Frame-Options",          "DENY");
        response.setHeader("X-XSS-Protection",         "1; mode=block");
        response.setHeader("Referrer-Policy",           "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy",
                "geolocation=(), microphone=(), camera=(), payment=()");
        // HSTS: only add in production (requires HTTPS)
        // response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

        filterChain.doFilter(request, response);
    }
}
