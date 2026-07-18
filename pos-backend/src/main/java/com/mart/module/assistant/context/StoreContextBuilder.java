package com.mart.module.assistant.context;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mart.common.response.PageResponse;
import com.mart.module.inventory.dto.response.StockBalanceResponse;
import com.mart.module.inventory.service.InventoryService;
import com.mart.module.product.dto.response.ProductResponse;
import com.mart.module.product.service.ProductService;
import com.mart.module.report.dto.PaymentBreakdownItem;
import com.mart.module.report.dto.ProfitLossResponse;
import com.mart.module.report.dto.SalesSummaryResponse;
import com.mart.module.report.dto.TopProductRow;
import com.mart.module.report.service.ReportService;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds a compact, store-scoped JSON snapshot that the assistant answers from. Because the
 * LLM gateway is text-only (no tool calls), this snapshot IS the assistant's entire view of
 * the store — the model can only report facts present here. Everything is derived from the
 * caller's own {@code storeId}, so there is no way to reach another store's data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StoreContextBuilder {

    private final ReportService reportService;
    private final InventoryService inventoryService;
    private final ProductService productService;
    private final StoreRepository storeRepository;
    private final ObjectMapper objectMapper;

    private static final int MATCHED_PRODUCTS = 8;
    private static final int LOW_STOCK = 15;
    private static final int TOP_PRODUCTS = 5;
    private static final int CATALOG_LIMIT = 40;

    /** Rich snapshot for admins/managers: period totals, P&L, payments, top/low stock. */
    public String buildAdminContext(Long storeId, String userQuestion) {
        Instant now = Instant.now();
        Instant todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant last7 = now.minus(java.time.Duration.ofDays(7));
        Instant last30 = now.minus(java.time.Duration.ofDays(30));

        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("store", storeName(storeId));
        ctx.put("generatedAtUtc", now.toString());
        ctx.put("currency", "NPR (Rs)");

        Map<String, Object> ranges = new LinkedHashMap<>();
        ranges.put("today", salesMap(reportService.getSalesSummary(storeId, todayStart, now)));
        ranges.put("last7Days", salesMap(reportService.getSalesSummary(storeId, last7, now)));
        ranges.put("last30Days", salesMap(reportService.getSalesSummary(storeId, last30, now)));
        ctx.put("salesByRange", ranges);

        ProfitLossResponse pnl = reportService.getProfitLoss(storeId, last30, now);
        Map<String, Object> pnlMap = new LinkedHashMap<>();
        pnlMap.put("revenue", pnl.revenue());
        pnlMap.put("cogs", pnl.cogs());
        pnlMap.put("grossProfit", pnl.grossProfit());
        pnlMap.put("marginPct", pnl.grossMarginPct());
        ctx.put("profitLossLast30Days", pnlMap);

        List<Map<String, Object>> payments = new ArrayList<>();
        for (PaymentBreakdownItem p : reportService.getPaymentBreakdown(storeId, last7, now)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("method", p.paymentMethod());
            m.put("transactions", p.transactionCount());
            m.put("total", p.totalAmount());
            m.put("pctOfTotal", p.pctOfTotal());
            payments.add(m);
        }
        ctx.put("paymentBreakdownLast7Days", payments);

        List<Map<String, Object>> top = new ArrayList<>();
        for (TopProductRow t : reportService.getTopProducts(storeId, last30, now, TOP_PRODUCTS)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", t.productName());
            m.put("qtySold", t.qtySold());
            m.put("revenue", t.revenue());
            top.add(m);
        }
        ctx.put("topProductsLast30Days", top);

        ctx.put("lowStock", lowStock(storeId));
        ctx.put("catalog", catalog(storeId));

        List<Map<String, Object>> matched = matchedProducts(storeId, userQuestion);
        if (!matched.isEmpty()) {
            ctx.put("productsMatchingQuestion", matched);
        }
        return toJson(ctx);
    }

    /** Narrow snapshot for cashiers: today's sales + the product catalogue + question matches. */
    public String buildCashierContext(Long storeId, String userQuestion) {
        Instant now = Instant.now();
        Instant todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);

        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("store", storeName(storeId));
        ctx.put("generatedAtUtc", now.toString());
        ctx.put("currency", "NPR (Rs)");
        ctx.put("todaysSales", salesMap(reportService.getSalesSummary(storeId, todayStart, now)));
        ctx.put("catalog", catalog(storeId));
        List<Map<String, Object>> matched = matchedProducts(storeId, userQuestion);
        if (!matched.isEmpty()) {
            ctx.put("productsMatchingQuestion", matched);
        }
        return toJson(ctx);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> salesMap(SalesSummaryResponse s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("transactions", s.transactionCount());
        m.put("revenue", s.totalRevenue());
        m.put("discounts", s.totalDiscounts());
        m.put("avgTransaction", s.avgTransactionValue());
        m.put("voided", s.voidedCount());
        return m;
    }

    private List<Map<String, Object>> lowStock(Long storeId) {
        PageResponse<StockBalanceResponse> page =
                inventoryService.getLowStock(storeId, PageRequest.of(0, LOW_STOCK));
        List<Map<String, Object>> out = new ArrayList<>();
        for (StockBalanceResponse b : page.getContent()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", b.getProductName());
            m.put("quantity", b.getQuantity());
            m.put("threshold", b.getLowStockThreshold());
            out.add(m);
        }
        return out;
    }

    /**
     * A bounded snapshot of the whole product catalogue so broad questions like "what products
     * do we have" / "how many items are there" can be answered. {@code totalProducts} is the true
     * distinct-product count (independent of the list cap); {@code items} lists up to
     * {@link #CATALOG_LIMIT} products with live stock.
     */
    private Map<String, Object> catalog(Long storeId) {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            PageResponse<ProductResponse> page = productService.getProducts(
                    storeId, null, null, PageRequest.of(0, CATALOG_LIMIT));
            List<Map<String, Object>> items = new ArrayList<>();
            for (ProductResponse p : page.getContent()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", p.getName());
                m.put("barcode", p.getBarcode());
                m.put("price", p.getSellingPrice());
                m.put("stock", p.getCurrentStock());
                items.add(m);
            }
            out.put("totalProducts", page.getTotalElements());
            out.put("listed", items.size());
            out.put("listCappedAt", CATALOG_LIMIT);
            out.put("items", items);
        } catch (Exception e) {
            log.debug("Catalogue snapshot failed (non-fatal): {}", e.getMessage());
            out.put("totalProducts", 0);
            out.put("items", List.of());
        }
        return out;
    }

    /** Words that carry no product signal — dropped before catalogue search. */
    private static final java.util.Set<String> STOP_WORDS = java.util.Set.of(
            "how", "many", "much", "left", "remaining", "remain", "have", "has", "the", "price",
            "prices", "cost", "costs", "stock", "what", "whats", "which", "is", "are", "there",
            "of", "do", "we", "in", "on", "at", "for", "me", "tell", "please", "and", "to", "a",
            "an", "any", "get", "got", "still", "available", "sell", "sells", "selling", "show");

    /**
     * Free-text retrieval over the product catalogue. Tokenises the question and searches per
     * meaningful term (so "how many Lays chips left?" finds "Lays Classic Chips"), aggregating
     * unique matches. Grounds "how many X left / price of X" without needing tool calls.
     */
    private List<Map<String, Object>> matchedProducts(Long storeId, String userQuestion) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (userQuestion == null || userQuestion.isBlank()) return out;

        java.util.LinkedHashSet<Long> seen = new java.util.LinkedHashSet<>();
        for (String term : searchTerms(userQuestion)) {
            if (out.size() >= MATCHED_PRODUCTS) break;
            try {
                PageResponse<ProductResponse> page = productService.getProducts(
                        storeId, null, term, PageRequest.of(0, MATCHED_PRODUCTS));
                for (ProductResponse p : page.getContent()) {
                    if (out.size() >= MATCHED_PRODUCTS || !seen.add(p.getId())) continue;
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", p.getName());
                    m.put("barcode", p.getBarcode());
                    m.put("price", p.getSellingPrice());
                    m.put("stock", p.getCurrentStock());
                    m.put("lowStockThreshold", p.getLowStockThreshold());
                    out.add(m);
                }
            } catch (Exception e) {
                log.debug("Product retrieval for term '{}' failed (non-fatal): {}", term, e.getMessage());
            }
        }
        return out;
    }

    /** Meaningful search terms from a question: content words + any numeric (barcode) tokens. */
    private static List<String> searchTerms(String question) {
        List<String> terms = new ArrayList<>();
        for (String raw : question.toLowerCase().split("[^\\p{Alnum}]+")) {
            if (raw.isBlank() || terms.size() >= 6) continue;
            boolean numeric = raw.chars().allMatch(Character::isDigit);
            if (numeric || (raw.length() >= 3 && !STOP_WORDS.contains(raw))) {
                terms.add(raw);
            }
        }
        return terms;
    }

    private String storeName(Long storeId) {
        return storeRepository.findById(storeId).map(Store::getName).orElse("this store");
    }

    private String toJson(Object ctx) {
        try {
            return objectMapper.writeValueAsString(ctx);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialise assistant context: {}", e.getMessage());
            return "{}";
        }
    }
}
