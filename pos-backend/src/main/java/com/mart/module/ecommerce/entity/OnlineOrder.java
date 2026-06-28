package com.mart.module.ecommerce.entity;

import com.mart.module.store.entity.Store;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "online_orders")
public class OnlineOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, length = 30, unique = true)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private OnlineCustomer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private OnlineOrderStatus status = OnlineOrderStatus.PENDING;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount_amount", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "loyalty_points_used", nullable = false)
    @Builder.Default
    private Integer loyaltyPointsUsed = 0;

    @Column(name = "loyalty_points_earned", nullable = false)
    @Builder.Default
    private Integer loyaltyPointsEarned = 0;

    @Column(name = "delivery_address", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "fulfilled_at")
    private Instant fulfilledAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OnlineOrderItem> items = new ArrayList<>();

    @PrePersist
    void onCreate() { if (this.placedAt == null) this.placedAt = Instant.now(); }
}
