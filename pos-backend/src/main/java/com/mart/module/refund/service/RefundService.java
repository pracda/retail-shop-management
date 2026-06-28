package com.mart.module.refund.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.customer.entity.Customer;
import com.mart.module.customer.repository.CustomerRepository;
import com.mart.module.inventory.entity.MovementType;
import com.mart.module.inventory.entity.StockBalance;
import com.mart.module.inventory.entity.StockMovement;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.inventory.repository.StockMovementRepository;
import com.mart.module.refund.dto.CreateRefundRequest;
import com.mart.module.refund.dto.RejectRefundRequest;
import com.mart.module.refund.dto.RefundResponse;
import com.mart.module.refund.entity.Refund;
import com.mart.module.refund.entity.RefundItem;
import com.mart.module.refund.entity.RefundStatus;
import com.mart.module.refund.repository.RefundRepository;
import com.mart.module.sale.entity.Sale;
import com.mart.module.sale.entity.SaleItem;
import com.mart.module.sale.entity.SaleStatus;
import com.mart.module.sale.repository.SaleRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RefundService {

    private final RefundRepository refundRepository;
    private final SaleRepository saleRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final StockBalanceRepository stockBalanceRepository;
    private final StockMovementRepository stockMovementRepository;

    /** Create a PENDING refund. No stock/loyalty changes happen yet. */
    @Transactional
    public RefundResponse createRefund(CreateRefundRequest req) {
        Sale sale = saleRepository.findById(req.saleId())
                .orElseThrow(() -> AppException.notFound("Sale not found"));

        if (sale.getStatus() != SaleStatus.COMPLETED) {
            throw AppException.badRequest("Only completed sales can be refunded");
        }

        User refundedBy = currentUser();

        List<RefundItem> refundItems = new ArrayList<>();
        BigDecimal totalRefund = BigDecimal.ZERO;

        for (var itemReq : req.items()) {
            SaleItem saleItem = sale.getItems().stream()
                    .filter(i -> i.getId().equals(itemReq.saleItemId()))
                    .findFirst()
                    .orElseThrow(() -> AppException.notFound("Sale item not found: " + itemReq.saleItemId()));

            if (itemReq.quantity().compareTo(saleItem.getQuantity()) > 0) {
                throw AppException.badRequest("Refund quantity exceeds original for item " + itemReq.saleItemId());
            }

            BigDecimal itemRefundAmount = saleItem.getUnitPrice().multiply(itemReq.quantity());

            refundItems.add(RefundItem.builder()
                    .saleItem(saleItem)
                    .quantity(itemReq.quantity())
                    .refundAmount(itemRefundAmount)
                    .build());

            totalRefund = totalRefund.add(itemRefundAmount);
        }

        Refund refund = Refund.builder()
                .sale(sale)
                .refundedBy(refundedBy)
                .reason(req.reason())
                .refundAmount(totalRefund)
                .refundMethod(req.refundMethod())
                .status(RefundStatus.PENDING)
                .build();

        for (RefundItem ri : refundItems) {
            ri.setRefund(refund);
            refund.getItems().add(ri);
        }

        return RefundResponse.from(refundRepository.save(refund));
    }

    /** Approve a pending refund — executes stock return and loyalty adjustments. */
    @Transactional
    public RefundResponse approveRefund(Long id) {
        Refund refund = findPending(id);
        User approver = currentUser();

        refund.setStatus(RefundStatus.APPROVED);
        refund.setApprovedBy(approver);
        refund.setApprovedAt(Instant.now());

        refundRepository.save(refund);

        Sale sale = refund.getSale();
        BigDecimal totalRefund = refund.getRefundAmount();

        // Return stock
        for (RefundItem ri : refund.getItems()) {
            SaleItem si = ri.getSaleItem();
            if (si.getProduct() != null) {
                returnStock(sale, si, ri.getQuantity(), refund.getId());
            }
        }

        // Mark sale REFUNDED if all items fully returned
        boolean allRefunded = checkAllItemsRefunded(sale);
        if (allRefunded) {
            sale.setStatus(SaleStatus.REFUNDED);
            saleRepository.save(sale);
        }

        // Restore customer loyalty proportional to refund amount
        if (sale.getCustomer() != null && sale.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
            Customer customer = sale.getCustomer();
            BigDecimal ratio = totalRefund.divide(sale.getTotalAmount(), 10, java.math.RoundingMode.HALF_UP);
            int pointsToRemove = ratio.multiply(BigDecimal.valueOf(sale.getPointsEarned()))
                    .setScale(0, java.math.RoundingMode.FLOOR)
                    .intValue();
            int pointsToRestore = allRefunded ? sale.getLoyaltyPointsRedeemed() : 0;
            customer.setLoyaltyPoints(Math.max(0, customer.getLoyaltyPoints() - pointsToRemove + pointsToRestore));
            customer.setTotalSpent(customer.getTotalSpent().subtract(totalRefund).max(BigDecimal.ZERO));
            customerRepository.save(customer);
        }

        return RefundResponse.from(refund);
    }

    /** Reject a pending refund — no side-effects, just records rejection reason. */
    @Transactional
    public RefundResponse rejectRefund(Long id, RejectRefundRequest req) {
        Refund refund = findPending(id);
        User rejector = currentUser();

        refund.setStatus(RefundStatus.REJECTED);
        refund.setApprovedBy(rejector);
        refund.setApprovedAt(Instant.now());
        refund.setRejectionReason(req.reason());

        return RefundResponse.from(refundRepository.save(refund));
    }

    @Transactional(readOnly = true)
    public PageResponse<RefundResponse> getPendingRefunds(Long storeId, int page, int size) {
        var pg = refundRepository.findByStoreIdAndStatus(storeId, RefundStatus.PENDING, PageRequest.of(page, size));
        return PageResponse.from(pg.map(RefundResponse::from));
    }

    @Transactional(readOnly = true)
    public List<RefundResponse> getRefundsForSale(Long saleId) {
        return refundRepository.findBySaleId(saleId).stream()
                .map(RefundResponse::from)
                .toList();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Refund findPending(Long id) {
        Refund refund = refundRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Refund not found"));
        if (refund.getStatus() != RefundStatus.PENDING) {
            throw AppException.badRequest("Refund is already " + refund.getStatus());
        }
        return refund;
    }

    private boolean checkAllItemsRefunded(Sale sale) {
        List<Refund> approvedRefunds = refundRepository.findBySaleId(sale.getId()).stream()
                .filter(r -> r.getStatus() == RefundStatus.APPROVED)
                .toList();

        for (SaleItem si : sale.getItems()) {
            BigDecimal totalRefunded = approvedRefunds.stream()
                    .flatMap(r -> r.getItems().stream())
                    .filter(ri -> ri.getSaleItem().getId().equals(si.getId()))
                    .map(RefundItem::getQuantity)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (totalRefunded.compareTo(si.getQuantity()) < 0) {
                return false;
            }
        }
        return true;
    }

    private void returnStock(Sale sale, SaleItem si, BigDecimal qty, Long refundId) {
        var store = sale.getStore();
        var product = si.getProduct();

        StockBalance balance = stockBalanceRepository
                .findByStoreIdAndProductIdForUpdate(store.getId(), product.getId())
                .orElseGet(() -> StockBalance.builder()
                        .store(store).product(product).quantity(BigDecimal.ZERO).build());

        BigDecimal before = balance.getQuantity();
        BigDecimal after = before.add(qty);
        balance.setQuantity(after);
        stockBalanceRepository.save(balance);

        stockMovementRepository.save(StockMovement.builder()
                .store(store)
                .product(product)
                .movementType(MovementType.RETURN)
                .quantity(qty)
                .quantityBefore(before)
                .quantityAfter(after)
                .referenceId(refundId)
                .note("Refund approved")
                .build());
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound("Authenticated user not found"));
    }
}
