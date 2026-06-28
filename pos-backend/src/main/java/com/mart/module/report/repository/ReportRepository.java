package com.mart.module.report.repository;

import com.mart.module.sale.entity.PaymentMethod;
import com.mart.module.sale.entity.Sale;
import com.mart.module.sale.entity.SaleStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ReportRepository extends JpaRepository<Sale, Long> {

    // ── Sales summary ─────────────────────────────────────────────────────────

    @Query("""
            SELECT COUNT(s),
                   COALESCE(SUM(s.totalAmount),    0),
                   COALESCE(SUM(s.discountAmount), 0)
            FROM Sale s
            WHERE s.store.id = :storeId
              AND s.status   = :status
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            """)
    List<Object[]> findSalesSummaryStats(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to);

    @Query("""
            SELECT COUNT(s)
            FROM Sale s
            WHERE s.store.id = :storeId
              AND s.status   = :status
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            """)
    long countByStoreAndStatusAndPeriod(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to);

    // ── P&L ───────────────────────────────────────────────────────────────────

    @Query("""
            SELECT COALESCE(SUM(s.totalAmount),            0),
                   COALESCE(SUM(si.quantity * p.costPrice), 0),
                   COALESCE(SUM(s.discountAmount),          0)
            FROM Sale s
            JOIN s.items si
            JOIN si.product p
            WHERE s.store.id = :storeId
              AND s.status   = :status
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            """)
    List<Object[]> findPnlStats(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to);

    // ── Payment breakdown ─────────────────────────────────────────────────────

    @Query("""
            SELECT s.paymentMethod, COUNT(s), COALESCE(SUM(s.totalAmount), 0)
            FROM Sale s
            WHERE s.store.id = :storeId
              AND s.status   = :status
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            GROUP BY s.paymentMethod
            ORDER BY SUM(s.totalAmount) DESC
            """)
    List<Object[]> findPaymentBreakdown(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to);

    // ── Top products ──────────────────────────────────────────────────────────

    @Query("""
            SELECT p.id, p.name, p.barcode,
                   COALESCE(SUM(si.quantity),            0),
                   COALESCE(SUM(si.lineTotal),           0),
                   COALESCE(SUM(si.quantity * p.costPrice), 0)
            FROM Sale s
            JOIN s.items si
            JOIN si.product p
            WHERE s.store.id = :storeId
              AND s.status   = :status
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            GROUP BY p.id, p.name, p.barcode
            ORDER BY SUM(si.lineTotal) DESC
            """)
    List<Object[]> findTopProducts(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to,
            Pageable pageable);

    // ── Daily trend (native — DATE() function) ────────────────────────────────

    @Query(value = """
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS sale_date,
                   COUNT(*)                             AS txn_count,
                   COALESCE(SUM(total_amount), 0)       AS revenue
            FROM sales
            WHERE store_id  = :storeId
              AND status    = 'COMPLETED'
              AND created_at >= :from
              AND created_at <= :to
            GROUP BY sale_date
            ORDER BY sale_date
            """, nativeQuery = true)
    List<Object[]> findDailyTrend(
            @Param("storeId") Long storeId,
            @Param("from")    Instant from,
            @Param("to")      Instant to);

    // ── Transaction list (all methods, nullable status) ──────────────────────

    @Query("""
            SELECT s.id, s.receiptNumber, s.createdAt,
                   s.cashier.firstName, s.cashier.lastName,
                   s.paymentMethod, SIZE(s.items),
                   s.subtotal, s.discountAmount, s.totalAmount,
                   s.status
            FROM Sale s
            WHERE s.store.id = :storeId
              AND (:status IS NULL OR s.status = :status)
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            ORDER BY s.createdAt DESC
            """)
    List<Object[]> findTransactions(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to,
            Pageable pageable);

    // ── Transaction list (filtered by payment method, nullable status) ────────

    @Query("""
            SELECT s.id, s.receiptNumber, s.createdAt,
                   s.cashier.firstName, s.cashier.lastName,
                   s.paymentMethod, SIZE(s.items),
                   s.subtotal, s.discountAmount, s.totalAmount,
                   s.status
            FROM Sale s
            WHERE s.store.id     = :storeId
              AND (:status IS NULL OR s.status = :status)
              AND s.createdAt    >= :from
              AND s.createdAt    <= :to
              AND s.paymentMethod = :paymentMethod
            ORDER BY s.createdAt DESC
            """)
    List<Object[]> findTransactionsByPayment(
            @Param("storeId")       Long storeId,
            @Param("status")        SaleStatus status,
            @Param("from")          Instant from,
            @Param("to")            Instant to,
            @Param("paymentMethod") PaymentMethod paymentMethod,
            Pageable pageable);

    // ── Hourly trend (native — HOUR() function) ───────────────────────────────

    @Query(value = """
            SELECT HOUR(created_at)              AS sale_hour,
                   COUNT(*)                      AS txn_count,
                   COALESCE(SUM(total_amount), 0) AS revenue
            FROM sales
            WHERE store_id   = :storeId
              AND status     = 'COMPLETED'
              AND created_at >= :from
              AND created_at <= :to
            GROUP BY sale_hour
            ORDER BY sale_hour
            """, nativeQuery = true)
    List<Object[]> findHourlyTrend(
            @Param("storeId") Long storeId,
            @Param("from")    Instant from,
            @Param("to")      Instant to);

    // ── Category sales ────────────────────────────────────────────────────────

    @Query("""
            SELECT COALESCE(cat.id,   -1),
                   COALESCE(cat.name, 'Uncategorised'),
                   COALESCE(SUM(si.quantity),               0),
                   COALESCE(SUM(si.lineTotal),              0),
                   COALESCE(SUM(si.quantity * p.costPrice), 0)
            FROM Sale s
            JOIN s.items si
            JOIN si.product p
            LEFT JOIN p.category cat
            WHERE s.store.id = :storeId
              AND s.status   = :status
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            GROUP BY cat.id, cat.name
            ORDER BY SUM(si.lineTotal) DESC
            """)
    List<Object[]> findCategorySales(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to);

    // ── Cashier performance ───────────────────────────────────────────────────

    @Query("""
            SELECT s.cashier.id,
                   s.cashier.firstName,
                   s.cashier.lastName,
                   COUNT(s),
                   COALESCE(SUM(s.totalAmount), 0)
            FROM Sale s
            WHERE s.store.id = :storeId
              AND s.status   = :status
              AND s.createdAt >= :from
              AND s.createdAt <= :to
            GROUP BY s.cashier.id, s.cashier.firstName, s.cashier.lastName
            ORDER BY SUM(s.totalAmount) DESC
            """)
    List<Object[]> findCashierPerformance(
            @Param("storeId") Long storeId,
            @Param("status")  SaleStatus status,
            @Param("from")    Instant from,
            @Param("to")      Instant to);
}
