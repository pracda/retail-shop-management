package com.mart.module.ecommerce.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.ecommerce.dto.request.PlaceOrderRequest;
import com.mart.module.ecommerce.dto.response.OnlineOrderResponse;
import com.mart.module.ecommerce.entity.*;
import com.mart.module.ecommerce.repository.OnlineCartRepository;
import com.mart.module.ecommerce.repository.OnlineCustomerRepository;
import com.mart.module.ecommerce.repository.OnlineOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class EcommerceOrderService {

    private final OnlineOrderRepository orderRepository;
    private final OnlineCartRepository cartRepository;
    private final OnlineCustomerRepository customerRepository;

    // Simple in-process sequence suffix — production should use DB sequence or UUID
    private static final AtomicLong SEQ = new AtomicLong(System.currentTimeMillis() % 100_000);

    @Transactional
    public OnlineOrderResponse placeOrder(Long customerId, Long storeId, PlaceOrderRequest request) {
        OnlineCustomer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> AppException.notFound("Customer not found"));

        OnlineCart cart = cartRepository.findByCustomerIdAndStoreIdFetched(customerId, storeId)
                .orElseThrow(() -> AppException.badRequest("Cart is empty"));

        if (cart.getItems().isEmpty()) {
            throw AppException.badRequest("Cart is empty");
        }

        // Build order items and compute totals
        BigDecimal subtotal = BigDecimal.ZERO;
        List<OnlineOrderItem> orderItems = new java.util.ArrayList<>();

        for (OnlineCartItem ci : cart.getItems()) {
            var product = ci.getProduct();
            BigDecimal lineTotal = product.getSellingPrice()
                    .multiply(BigDecimal.valueOf(ci.getQuantity()));
            subtotal = subtotal.add(lineTotal);

            orderItems.add(OnlineOrderItem.builder()
                    .product(product)
                    .productName(product.getName())
                    .unitPrice(product.getSellingPrice())
                    .quantity(ci.getQuantity())
                    .lineTotal(lineTotal)
                    .build());
        }

        // Loyalty points redemption (1 point = Rs 0.01 discount, max 50% of order)
        int pointsToRedeem = 0;
        BigDecimal discountAmount = BigDecimal.ZERO;
        if (request.getLoyaltyPointsToRedeem() != null && request.getLoyaltyPointsToRedeem() > 0) {
            int available = customer.getLoyaltyPoints();
            pointsToRedeem = Math.min(request.getLoyaltyPointsToRedeem(), available);
            BigDecimal maxDiscount = subtotal.multiply(BigDecimal.valueOf(0.50));
            BigDecimal requestedDiscount = BigDecimal.valueOf(pointsToRedeem).multiply(BigDecimal.valueOf(0.01));
            discountAmount = requestedDiscount.min(maxDiscount).setScale(2, RoundingMode.HALF_UP);
            // Recalculate actual points used based on applied discount
            pointsToRedeem = discountAmount.multiply(BigDecimal.valueOf(100)).intValue();
        }

        BigDecimal totalAmount = subtotal.subtract(discountAmount);
        int pointsEarned = totalAmount.divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR).intValue();

        String orderNumber = "ORD-" + String.format("%05d", SEQ.incrementAndGet());

        OnlineOrder order = OnlineOrder.builder()
                .orderNumber(orderNumber)
                .customer(customer)
                .store(cart.getStore())
                .subtotal(subtotal)
                .discountAmount(discountAmount)
                .totalAmount(totalAmount)
                .loyaltyPointsUsed(pointsToRedeem)
                .loyaltyPointsEarned(pointsEarned)
                .deliveryAddress(request.getDeliveryAddress())
                .note(request.getNote())
                .build();

        order.setItems(orderItems);
        orderItems.forEach(i -> i.setOrder(order));

        OnlineOrder saved = orderRepository.save(order);

        // Update customer loyalty balance
        customer.setLoyaltyPoints(customer.getLoyaltyPoints() - pointsToRedeem + pointsEarned);
        customerRepository.save(customer);

        // Clear cart
        cart.getItems().clear();
        cartRepository.save(cart);

        log.info("Online order {} placed by customer {} (store {})",
                saved.getOrderNumber(), customerId, storeId);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<OnlineOrderResponse> getOrders(Long customerId, Pageable pageable) {
        return PageResponse.from(
                orderRepository.findByCustomerIdOrderByPlacedAtDesc(customerId, pageable)
                        .map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public OnlineOrderResponse getOrder(Long customerId, Long orderId) {
        return orderRepository.findByIdAndCustomerId(orderId, customerId)
                .map(this::toResponse)
                .orElseThrow(() -> AppException.notFound("Order not found"));
    }

    @Transactional
    public OnlineOrderResponse cancelOrder(Long customerId, Long orderId, String reason) {
        OnlineOrder order = orderRepository.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> AppException.notFound("Order not found"));

        if (order.getStatus() != OnlineOrderStatus.PENDING) {
            throw AppException.badRequest("Only PENDING orders can be cancelled");
        }

        order.setStatus(OnlineOrderStatus.CANCELLED);
        order.setCancelledAt(Instant.now());
        order.setCancelReason(reason);

        // Refund loyalty points
        OnlineCustomer customer = order.getCustomer();
        customer.setLoyaltyPoints(customer.getLoyaltyPoints()
                + order.getLoyaltyPointsUsed()
                - order.getLoyaltyPointsEarned());
        customerRepository.save(customer);

        return toResponse(orderRepository.save(order));
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private OnlineOrderResponse toResponse(OnlineOrder o) {
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
                .build();
    }
}
