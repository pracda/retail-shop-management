package com.mart.module.assistant.service;

import com.mart.common.exception.AppException;
import com.mart.module.assistant.config.AssistantProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory per-user daily query cap — a lightweight second layer beneath the gateway's own
 * rate limiting, mainly to protect the shared demo account from runaway cost. Counts reset at
 * UTC midnight. (In-memory is fine for the single-instance deployment; move to Redis/DB if the
 * API is ever horizontally scaled.)
 */
@Component
@RequiredArgsConstructor
public class DailyQueryLimiter {

    private final AssistantProperties props;
    private final ConcurrentHashMap<Long, Counter> counters = new ConcurrentHashMap<>();

    public void checkAndIncrement(Long userId) {
        int cap = props.getDailyQueryCapPerUser();
        if (cap <= 0) return; // 0 or negative = unlimited
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Counter c = counters.compute(userId, (id, existing) -> {
            if (existing == null || !existing.date.equals(today)) {
                return new Counter(today, 1);
            }
            existing.count++;
            return existing;
        });
        if (c.count > cap) {
            throw new AppException(HttpStatus.TOO_MANY_REQUESTS, "ASSISTANT_DAILY_LIMIT",
                    "You've reached today's AI assistant limit (" + cap + " questions). "
                            + "Please try again tomorrow.");
        }
    }

    private static final class Counter {
        private final LocalDate date;
        private int count;

        private Counter(LocalDate date, int count) {
            this.date = date;
            this.count = count;
        }
    }
}
