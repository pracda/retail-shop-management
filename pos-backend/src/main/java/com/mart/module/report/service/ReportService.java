package com.mart.module.report.service;

import com.mart.module.expense.repository.ShiftExpenseRepository;
import com.mart.module.refund.repository.RefundRepository;
import com.mart.module.report.dto.*;
import com.mart.module.report.repository.ReportRepository;
import com.mart.module.sale.entity.PaymentMethod;
import com.mart.module.sale.entity.Sale;
import com.mart.module.sale.entity.SaleStatus;
import com.mart.module.sale.repository.SaleRepository;
import com.mart.module.shift.entity.Shift;
import com.mart.module.shift.repository.ShiftRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository repo;
    private final SaleRepository saleRepository;
    private final ShiftRepository shiftRepository;
    private final StoreRepository storeRepository;
    private final RefundRepository refundRepository;
    private final ShiftExpenseRepository expenseRepository;

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final MathContext MC = new MathContext(10, RoundingMode.HALF_UP);

    // ── Sales Summary ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public SalesSummaryResponse getSalesSummary(Long storeId, Instant from, Instant to) {
        List<Object[]> rows = repo.findSalesSummaryStats(storeId, SaleStatus.COMPLETED, from, to);
        Object[] row = rows.isEmpty() ? new Object[]{0L, BigDecimal.ZERO, BigDecimal.ZERO} : rows.get(0);
        long txnCount       = toLong(row[0]);
        BigDecimal revenue  = toBD(row[1]);
        BigDecimal discounts = toBD(row[2]);
        BigDecimal avg = txnCount > 0
                ? revenue.divide(BigDecimal.valueOf(txnCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        long voided = repo.countByStoreAndStatusAndPeriod(storeId, SaleStatus.VOIDED, from, to);
        return new SalesSummaryResponse(txnCount, voided, revenue, discounts, avg);
    }

    // ── P&L ───────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ProfitLossResponse getProfitLoss(Long storeId, Instant from, Instant to) {
        List<Object[]> rows = repo.findPnlStats(storeId, SaleStatus.COMPLETED, from, to);
        Object[] row = rows.isEmpty() ? new Object[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO} : rows.get(0);
        BigDecimal revenue   = toBD(row[0]);
        BigDecimal cogs      = toBD(row[1]);
        BigDecimal discounts = toBD(row[2]);
        BigDecimal profit    = revenue.subtract(cogs);
        BigDecimal margin    = revenue.compareTo(BigDecimal.ZERO) > 0
                ? profit.divide(revenue, MC).multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return new ProfitLossResponse(revenue, cogs, profit, margin, discounts);
    }

    // ── Payment breakdown ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PaymentBreakdownItem> getPaymentBreakdown(Long storeId, Instant from, Instant to) {
        List<Object[]> rows = repo.findPaymentBreakdown(storeId, SaleStatus.COMPLETED, from, to);
        BigDecimal grandTotal = rows.stream()
                .map(r -> toBD(r[2]))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return rows.stream().map(r -> {
            String method      = r[0].toString();
            long count         = toLong(r[1]);
            BigDecimal total   = toBD(r[2]);
            BigDecimal pct     = grandTotal.compareTo(BigDecimal.ZERO) > 0
                    ? total.divide(grandTotal, MC).multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            return new PaymentBreakdownItem(method, count, total, pct);
        }).toList();
    }

    // ── Top products ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TopProductRow> getTopProducts(Long storeId, Instant from, Instant to, int limit) {
        List<Object[]> rows = repo.findTopProducts(
                storeId, SaleStatus.COMPLETED, from, to, PageRequest.of(0, limit));
        return rows.stream().map(r -> {
            Long   pid     = toLong(r[0]);
            String name    = r[1].toString();
            String barcode = r[2] != null ? r[2].toString() : null;
            BigDecimal qty     = toBD(r[3]);
            BigDecimal revenue = toBD(r[4]);
            BigDecimal cogs    = toBD(r[5]);
            return new TopProductRow(pid, name, barcode, qty, revenue, cogs, revenue.subtract(cogs));
        }).toList();
    }

    // ── Daily trend ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DailyTrendRow> getDailyTrend(Long storeId, Instant from, Instant to) {
        return repo.findDailyTrend(storeId, from, to).stream().map(r ->
                new DailyTrendRow(r[0].toString(), toLong(r[1]), toBD(r[2]))
        ).toList();
    }

    // ── Cashier performance ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CashierReportRow> getCashierPerformance(Long storeId, Instant from, Instant to) {
        return repo.findCashierPerformance(storeId, SaleStatus.COMPLETED, from, to).stream().map(r -> {
            Long cashierId     = toLong(r[0]);
            String name        = r[1] + " " + r[2];
            long count         = toLong(r[3]);
            BigDecimal revenue = toBD(r[4]);
            BigDecimal avg     = count > 0
                    ? revenue.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            return new CashierReportRow(cashierId, name.trim(), count, revenue, avg);
        }).toList();
    }

    // ── Transaction list ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TransactionReportRow> getTransactions(Long storeId, Instant from, Instant to,
                                                       String paymentMethodStr, String statusStr, int page, int size) {
        SaleStatus status = (statusStr == null || statusStr.isBlank())
                ? null
                : SaleStatus.valueOf(statusStr.toUpperCase());
        var pageable = PageRequest.of(page, size);
        List<Object[]> rows;
        if (paymentMethodStr != null && !paymentMethodStr.isBlank()) {
            PaymentMethod pm = PaymentMethod.valueOf(paymentMethodStr.toUpperCase());
            rows = repo.findTransactionsByPayment(storeId, status, from, to, pm, pageable);
        } else {
            rows = repo.findTransactions(storeId, status, from, to, pageable);
        }
        return rows.stream().map(r -> {
            Long   saleId       = toLong(r[0]);
            String receipt      = r[1].toString();
            Instant createdAt   = toInstant(r[2]);
            String cashier      = r[3] + " " + r[4];
            String method       = r[5].toString();
            int itemCount       = toInt(r[6]);
            BigDecimal subtotal = toBD(r[7]);
            BigDecimal discount = toBD(r[8]);
            BigDecimal total    = toBD(r[9]);
            String txnStatus    = r[10] != null ? r[10].toString() : "COMPLETED";
            return new TransactionReportRow(saleId, receipt, createdAt,
                    cashier.trim(), method, itemCount, subtotal, discount, total, txnStatus);
        }).toList();
    }

    // ── Hourly trend ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HourlyTrendRow> getHourlyTrend(Long storeId, Instant from, Instant to) {
        return repo.findHourlyTrend(storeId, from, to).stream().map(r ->
                new HourlyTrendRow(toInt(r[0]), toLong(r[1]), toBD(r[2]))
        ).toList();
    }

    // ── Category sales ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CategorySalesRow> getCategorySales(Long storeId, Instant from, Instant to) {
        return repo.findCategorySales(storeId, SaleStatus.COMPLETED, from, to).stream().map(r -> {
            Long       catId    = toLong(r[0]);
            String     catName  = r[1].toString();
            BigDecimal qty      = toBD(r[2]);
            BigDecimal revenue  = toBD(r[3]);
            BigDecimal cogs     = toBD(r[4]);
            return new CategorySalesRow(catId < 0 ? null : catId,
                    catName, qty, revenue, cogs, revenue.subtract(cogs));
        }).toList();
    }

    // ── Z-Report ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ZReportResponse getZReport(Long storeId, LocalDate date) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("Store not found"));

        ZoneId zone = ZoneId.systemDefault();
        Instant from = date.atStartOfDay(zone).toInstant();
        Instant to   = date.plusDays(1).atStartOfDay(zone).toInstant();

        // Completed sales for the day
        var completedSales = saleRepository.findByStoreId(storeId, SaleStatus.COMPLETED, from, to,
                Pageable.unpaged());
        BigDecimal totalSales = completedSales.getContent().stream()
                .map(Sale::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long saleCount = completedSales.getTotalElements();

        // Voided sales
        var voidedSales = saleRepository.findByStoreId(storeId, SaleStatus.VOIDED, from, to,
                Pageable.unpaged());
        BigDecimal totalVoids = voidedSales.getContent().stream()
                .map(Sale::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long voidCount = voidedSales.getTotalElements();

        // Refunds for the day — get from all refunds of sales in this period
        var allSalesForDay = saleRepository.findByStoreId(storeId, null, from, to, Pageable.unpaged());
        BigDecimal totalRefunds = allSalesForDay.getContent().stream()
                .flatMap(s -> refundRepository.findBySaleId(s.getId()).stream())
                .filter(r -> r.getCreatedAt().isAfter(from) && r.getCreatedAt().isBefore(to))
                .map(r -> r.getRefundAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long refundCount = allSalesForDay.getContent().stream()
                .flatMap(s -> refundRepository.findBySaleId(s.getId()).stream())
                .filter(r -> r.getCreatedAt().isAfter(from) && r.getCreatedAt().isBefore(to))
                .count();

        // Tax collected
        BigDecimal taxCollected = completedSales.getContent().stream()
                .map(Sale::getTaxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Payment breakdown
        Map<String, BigDecimal> paymentBreakdown = new HashMap<>();
        for (Sale s : completedSales.getContent()) {
            if (s.getPayments().isEmpty()) {
                // Single payment method
                String method = s.getPaymentMethod().name();
                paymentBreakdown.merge(method, s.getTotalAmount(), BigDecimal::add);
            } else {
                for (var p : s.getPayments()) {
                    String method = p.getPaymentMethod().name();
                    paymentBreakdown.merge(method, p.getAmount(), BigDecimal::add);
                }
            }
        }

        // Expenses
        BigDecimal totalExpenses = BigDecimal.ZERO;
        List<Shift> shifts = shiftRepository.findByStoreId(storeId, Pageable.unpaged())
                .getContent().stream()
                .filter(s -> s.getOpenedAt().isAfter(from) && s.getOpenedAt().isBefore(to))
                .toList();

        // Shift summaries
        List<ZReportResponse.ShiftSummary> shiftSummaries = new java.util.ArrayList<>();
        for (Shift shift : shifts) {
            BigDecimal shiftExpenses = expenseRepository.sumAmountByShiftId(shift.getId());
            totalExpenses = totalExpenses.add(shiftExpenses);

            var shiftSales = saleRepository.findByStoreId(storeId, SaleStatus.COMPLETED, from, to, Pageable.unpaged())
                    .getContent().stream()
                    .filter(s -> s.getShift().getId().equals(shift.getId()))
                    .toList();
            BigDecimal shiftSalesTotal = shiftSales.stream().map(Sale::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

            shiftSummaries.add(new ZReportResponse.ShiftSummary(
                    shift.getId(),
                    shift.getCashier().getFirstName() + " " + shift.getCashier().getLastName(),
                    shift.getOpeningFloat(),
                    shiftSalesTotal,
                    shiftSales.size(),
                    shiftExpenses,
                    shift.getClosingCash()
            ));
        }

        // Expected cash in drawer: openingFloat + cashSales - cashRefunds - expenses
        BigDecimal cashSales = paymentBreakdown.getOrDefault("CASH", BigDecimal.ZERO);
        BigDecimal openingFloat = shifts.stream().map(Shift::getOpeningFloat).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expectedCash = openingFloat.add(cashSales).subtract(totalExpenses);

        return new ZReportResponse(
                date, storeId, store.getName(),
                totalSales, saleCount,
                totalRefunds, refundCount,
                totalVoids, voidCount,
                totalExpenses, taxCollected,
                paymentBreakdown, expectedCash,
                shiftSummaries
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static BigDecimal toBD(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal bd) return bd;
        return new BigDecimal(v.toString());
    }

    private static long toLong(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number n) return n.longValue();
        return Long.parseLong(v.toString());
    }

    private static int toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.intValue();
        return Integer.parseInt(v.toString());
    }

    private static Instant toInstant(Object v) {
        if (v == null) return Instant.EPOCH;
        if (v instanceof Instant i) return i;
        if (v instanceof java.sql.Timestamp ts) return ts.toInstant();
        // Hibernate 6 may also give java.time.LocalDateTime for DATETIME(6) columns
        if (v instanceof java.time.LocalDateTime ldt)
            return ldt.toInstant(java.time.ZoneOffset.UTC);
        return Instant.parse(v.toString());
    }
}
