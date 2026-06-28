package com.mart.module.ecommerce.repository;

import com.mart.module.ecommerce.entity.OnlineOrder;
import com.mart.module.ecommerce.entity.OnlineOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface OnlineOrderRepository extends JpaRepository<OnlineOrder, Long> {

    Page<OnlineOrder> findByCustomerIdOrderByPlacedAtDesc(Long customerId, Pageable pageable);

    Page<OnlineOrder> findByStoreIdAndStatusOrderByPlacedAtDesc(
            Long storeId, OnlineOrderStatus status, Pageable pageable);

    Page<OnlineOrder> findByStoreIdOrderByPlacedAtDesc(Long storeId, Pageable pageable);

    @Query("SELECT o FROM OnlineOrder o LEFT JOIN FETCH o.items i LEFT JOIN FETCH i.product " +
           "WHERE o.id = :id AND o.customer.id = :customerId")
    Optional<OnlineOrder> findByIdAndCustomerId(@Param("id") Long id, @Param("customerId") Long customerId);

    @Query("SELECT o FROM OnlineOrder o LEFT JOIN FETCH o.items WHERE o.id = :id AND o.store.id = :storeId")
    Optional<OnlineOrder> findByIdAndStoreId(@Param("id") Long id, @Param("storeId") Long storeId);

    // Admin — live counts
    long countByStoreIdAndStatus(Long storeId, OnlineOrderStatus status);

    // Admin — date-range list (JOIN FETCH customer to avoid N+1; items lazy-loaded in-transaction)
    @Query(value = "SELECT o FROM OnlineOrder o JOIN FETCH o.customer " +
                   "WHERE o.store.id = :storeId AND o.placedAt BETWEEN :from AND :to",
           countQuery = "SELECT COUNT(o) FROM OnlineOrder o " +
                        "WHERE o.store.id = :storeId AND o.placedAt BETWEEN :from AND :to")
    Page<OnlineOrder> findByStoreAndPeriod(
            @Param("storeId") Long storeId,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query(value = "SELECT o FROM OnlineOrder o JOIN FETCH o.customer " +
                   "WHERE o.store.id = :storeId AND o.status = :status AND o.placedAt BETWEEN :from AND :to",
           countQuery = "SELECT COUNT(o) FROM OnlineOrder o " +
                        "WHERE o.store.id = :storeId AND o.status = :status AND o.placedAt BETWEEN :from AND :to")
    Page<OnlineOrder> findByStoreAndStatusAndPeriod(
            @Param("storeId") Long storeId,
            @Param("status") OnlineOrderStatus status,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    // Admin — summary stats: [status, count, sum(totalAmount)]
    @Query("""
            SELECT o.status, COUNT(o), COALESCE(SUM(o.totalAmount), 0)
            FROM OnlineOrder o
            WHERE o.store.id = :storeId
              AND o.placedAt >= :from
              AND o.placedAt <= :to
            GROUP BY o.status
            """)
    List<Object[]> findSummaryByStoreAndPeriod(
            @Param("storeId") Long storeId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    // Admin — daily trend
    @Query(value = """
            SELECT DATE_FORMAT(placed_at, '%Y-%m-%d') AS order_date,
                   COUNT(*)                            AS order_count,
                   COALESCE(SUM(total_amount), 0)      AS revenue
            FROM online_orders
            WHERE store_id  = :storeId
              AND placed_at >= :from
              AND placed_at <= :to
            GROUP BY order_date
            ORDER BY order_date
            """, nativeQuery = true)
    List<Object[]> findDailyTrend(
            @Param("storeId") Long storeId,
            @Param("from") Instant from,
            @Param("to") Instant to);
}
