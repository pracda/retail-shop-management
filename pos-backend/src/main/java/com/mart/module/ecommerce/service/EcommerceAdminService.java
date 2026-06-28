package com.mart.module.ecommerce.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.ecommerce.dto.response.OnlineOrderDailyRow;
import com.mart.module.ecommerce.dto.response.OnlineOrderResponse;
import com.mart.module.ecommerce.dto.response.OnlineOrderSummaryResponse;
import com.mart.module.ecommerce.entity.OnlineCustomer;
import com.mart.module.ecommerce.entity.OnlineOrder;
import com.mart.module.ecommerce.entity.OnlineOrderStatus;
import com.mart.module.ecommerce.repository.OnlineCustomerRepository;
import com.mart.module.ecommerce.repository.OnlineOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EcommerceAdminService {

    private final OnlineOrderRepository orderRepository;
    private final OnlineCustomerRepository customerRepository;

    // ── List / detail ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<OnlineOrderResponse> listOrders(
            Long storeId, OnlineOrderStatus status, Instant from, Instant to, Pageable pageable) {

        Page<OnlineOrder> page = status != null
                ? orderRepository.findByStoreAndStatusAndPeriod(storeId, status, from, to, pageable)
                : orderRepository.findByStoreAndPeriod(storeId, from, to, pageable);

        return PageResponse.from(page.map(this::toAdminResponse));
    }

    @Transactional(readOnly = true)
    public OnlineOrderResponse getOrder(Long storeId, Long orderId) {
        return orderRepository.findByIdAndStoreId(orderId, storeId)
                .map(this::toAdminResponse)
                .orElseThrow(() -> AppException.notFound("Order not found"));
    }

    // ── Status transitions ─────────────────────────────────────────────────────

    @Transactional
    public OnlineOrderResponse confirmOrder(Long storeId, Long orderId) {
        OnlineOrder order = loadForStore(storeId, orderId);
        if (order.getStatus() != OnlineOrderStatus.PENDING) {
            throw AppException.badRequest("Only PENDING orders can be confirmed");
        }
        order.setStatus(OnlineOrderStatus.CONFIRMED);
        order.setConfirmedAt(Instant.now());
        return toAdminResponse(orderRepository.save(order));
    }

    @Transactional
    public OnlineOrderResponse fulfillOrder(Long storeId, Long orderId) {
        OnlineOrder order = loadForStore(storeId, orderId);
        if (order.getStatus() != OnlineOrderStatus.CONFIRMED) {
            throw AppException.badRequest("Only CONFIRMED orders can be fulfilled");
        }
        order.setStatus(OnlineOrderStatus.FULFILLED);
        order.setFulfilledAt(Instant.now());
        return toAdminResponse(orderRepository.save(order));
    }

    @Transactional
    public OnlineOrderResponse cancelOrder(Long storeId, Long orderId, String reason) {
        OnlineOrder order = loadForStore(storeId, orderId);
        if (order.getStatus() == OnlineOrderStatus.FULFILLED || order.getStatus() == OnlineOrderStatus.CANCELLED) {
            throw AppException.badRequest("Cannot cancel a " + order.getStatus() + " order");
        }

        order.setStatus(OnlineOrderStatus.CANCELLED);
        order.setCancelledAt(Instant.now());
        order.setCancelReason(reason != null ? reason : "Cancelled by store");

        // Refund loyalty points to customer
        OnlineCustomer customer = order.getCustomer();
        customer.setLoyaltyPoints(customer.getLoyaltyPoints()
                + order.getLoyaltyPointsUsed()
                - order.getLoyaltyPointsEarned());
        customerRepository.save(customer);

        return toAdminResponse(orderRepository.save(order));
    }

    // ── Reports ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public long getPendingCount(Long storeId) {
        return orderRepository.countByStoreIdAndStatus(storeId, OnlineOrderStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public OnlineOrderSummaryResponse getSummary(Long storeId, Instant from, Instant to) {
        List<Object[]> rows = orderRepository.findSummaryByStoreAndPeriod(storeId, from, to);

        Map<String, long[]> byStatus = rows.stream().collect(Collectors.toMap(
                r -> ((OnlineOrderStatus) r[0]).name(),
                r -> new long[]{ ((Number) r[1]).longValue(),
                                  ((BigDecimal) r[2]).longValue() }
        ));

        long pending   = count(byStatus, "PENDING");
        long confirmed = count(byStatus, "CONFIRMED");
        long fulfilled = count(byStatus, "FULFILLED");
        long cancelled = count(byStatus, "CANCELLED");
        long total = pending + confirmed + fulfilled + cancelled;

        BigDecimal totalRevenue = rows.stream()
                .map(r -> (BigDecimal) r[2])
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal avg = total > 0
                ? totalRevenue.divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return OnlineOrderSummaryResponse.builder()
                .totalOrders(total)
                .pendingCount(pending)
                .confirmedCount(confirmed)
                .fulfilledCount(fulfilled)
                .cancelledCount(cancelled)
                .totalRevenue(totalRevenue)
                .avgOrderValue(avg)
                .build();
    }

    @Transactional(readOnly = true)
    public List<OnlineOrderDailyRow> getDailyTrend(Long storeId, Instant from, Instant to) {
        return orderRepository.findDailyTrend(storeId, from, to).stream()
                .map(r -> OnlineOrderDailyRow.builder()
                        .date((String) r[0])
                        .orderCount(((Number) r[1]).longValue())
                        .revenue(new BigDecimal(r[2].toString()))
                        .build())
                .toList();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private OnlineOrder loadForStore(Long storeId, Long orderId) {
        return orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> AppException.notFound("Order not found"));
    }

    private long count(Map<String, long[]> map, String key) {
        return map.containsKey(key) ? map.get(key)[0] : 0L;
    }

    private OnlineOrderResponse toAdminResponse(OnlineOrder o) {
        List<OnlineOrderResponse.OrderItemResponse> items = o.getItems().stream()
                .map(i -> OnlineOrderResponse.OrderItemResponse.builder()
                        .productId(i.getProduct().getId())
                        .productName(i.getProductName())
                        .unitPrice(i.getUnitPrice())
                        .quantity(i.getQuantity())
                        .lineTotal(i.getLineTotal())
                        .build())
                .toList();

        return OnlineOrderResponse.builder()
                .id(o.getId())
                .orderNumber(o.getOrderNumber())
                .status(o.getStatus().name())
                .subtotal(o.getSubtotal())
                .discountAmount(o.getDiscountAmount())
                .totalAmount(o.getTotalAmount())
                .loyaltyPointsUsed(o.getLoyaltyPointsUsed())
                .loyaltyPointsEarned(o.getLoyaltyPointsEarned())
                .deliveryAddress(o.getDeliveryAddress())
                .note(o.getNote())
                .placedAt(o.getPlacedAt())
                .confirmedAt(o.getConfirmedAt())
                .fulfilledAt(o.getFulfilledAt())
                .cancelledAt(o.getCancelledAt())
                .cancelReason(o.getCancelReason())
                .items(items)
                .customerName(o.getCustomer().getFirstName() + " " + o.getCustomer().getLastName())
                .customerEmail(o.getCustomer().getEmail())
                .build();
    }
}
