package com.mart.module.sale.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.audit.service.AuditLogService;
import com.mart.module.customer.entity.Customer;
import com.mart.module.customer.repository.CustomerRepository;
import com.mart.module.inventory.entity.MovementType;
import com.mart.module.inventory.entity.StockBalance;
import com.mart.module.inventory.entity.StockMovement;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.inventory.repository.StockMovementRepository;
import com.mart.module.product.entity.Product;
import com.mart.module.product.repository.ProductRepository;
import com.mart.module.sale.dto.request.CreateSaleRequest;
import com.mart.module.sale.dto.request.SaleItemRequest;
import com.mart.module.sale.dto.request.VoidSaleRequest;
import com.mart.module.sale.dto.response.SaleResponse;
import com.mart.module.sale.entity.*;
import com.mart.module.sale.repository.SaleRepository;
import com.mart.module.shift.entity.Shift;
import com.mart.module.shift.entity.ShiftStatus;
import com.mart.module.shift.repository.ShiftRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleRepository            saleRepository;
    private final ShiftRepository           shiftRepository;
    private final StoreRepository           storeRepository;
    private final UserRepository            userRepository;
    private final ProductRepository         productRepository;
    private final StockBalanceRepository    stockBalanceRepository;
    private final StockMovementRepository   stockMovementRepository;
    private final CustomerRepository        customerRepository;
    private final AuditLogService           auditLogService;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    private static final DateTimeFormatter RECEIPT_FMT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.systemDefault());

    // ── Queries ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public SaleResponse getSale(Long id) {
        return saleRepository.findById(id)
                .map(SaleResponse::from)
                .orElseThrow(() -> AppException.notFound("Sale not found"));
    }

    @Transactional(readOnly = true)
    public PageResponse<SaleResponse> getSales(Long storeId, SaleStatus status,
                                               Instant from, Instant to,
                                               int page, int size) {
        var pageResult = saleRepository.findByStoreId(storeId, status, from, to,
                PageRequest.of(page, size));
        return PageResponse.from(pageResult.map(SaleResponse::from));
    }

    @Transactional(readOnly = true)
    public PageResponse<SaleResponse> getShiftSales(Long shiftId, int page, int size) {
        return PageResponse.from(
                saleRepository.findByShiftId(shiftId, PageRequest.of(page, size))
                        .map(SaleResponse::from));
    }

    // ── Create sale ───────────────────────────────────────────────────────────

    @Transactional
    public SaleResponse createSale(CreateSaleRequest req) {
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        Shift shift = shiftRepository.findById(req.shiftId())
                .orElseThrow(() -> AppException.notFound("Shift not found"));

        if (shift.getStatus() != ShiftStatus.OPEN) {
            throw AppException.badRequest("Shift is not open");
        }
        if (!shift.getStore().getId().equals(req.storeId())) {
            throw AppException.badRequest("Shift does not belong to this store");
        }

        User cashier = currentUser();

        // Resolve customer if provided
        Customer customer = null;
        if (req.customerId() != null) {
            customer = customerRepository.findById(req.customerId())
                    .orElseThrow(() -> AppException.notFound("Customer not found"));
        }

        // Build items and calculate totals
        List<SaleItem> saleItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxAmount = BigDecimal.ZERO;

        for (SaleItemRequest itemReq : req.items()) {
            BigDecimal itemDiscount = itemReq.discountAmount() != null
                    ? itemReq.discountAmount() : BigDecimal.ZERO;

            if (itemReq.productId() == null) {
                // ── Manual / ad-hoc item ─────────────────────────────────
                if (itemReq.manualDescription() == null || itemReq.manualDescription().isBlank()) {
                    throw AppException.badRequest("manualDescription is required for manual items");
                }
                if (itemReq.manualUnitPrice() == null || itemReq.manualUnitPrice().compareTo(BigDecimal.ZERO) <= 0) {
                    throw AppException.badRequest("manualUnitPrice must be > 0 for manual items");
                }
                BigDecimal lineTotal = itemReq.manualUnitPrice()
                        .multiply(itemReq.quantity())
                        .subtract(itemDiscount);

                saleItems.add(SaleItem.builder()
                        .product(null)
                        .manualDescription(itemReq.manualDescription().trim())
                        .quantity(itemReq.quantity())
                        .unitPrice(itemReq.manualUnitPrice())
                        .discountAmount(itemDiscount)
                        .lineTotal(lineTotal)
                        .build());

                subtotal = subtotal.add(lineTotal);
            } else {
                // ── Regular product item ─────────────────────────────────
                Product product = productRepository.findById(itemReq.productId())
                        .orElseThrow(() -> AppException.notFound("Product not found: " + itemReq.productId()));

                BigDecimal lineTotal = product.getSellingPrice()
                        .multiply(itemReq.quantity())
                        .subtract(itemDiscount);

                // Compute tax for this line item
                if (Boolean.TRUE.equals(product.getIsTaxable())) {
                    BigDecimal effectiveTaxRate = product.getTaxRate() != null
                            ? product.getTaxRate()
                            : store.getTaxRate();
                    taxAmount = taxAmount.add(lineTotal.multiply(effectiveTaxRate).setScale(2, RoundingMode.HALF_UP));
                }

                saleItems.add(SaleItem.builder()
                        .product(product)
                        .quantity(itemReq.quantity())
                        .unitPrice(product.getSellingPrice())
                        .discountAmount(itemDiscount)
                        .lineTotal(lineTotal)
                        .build());

                subtotal = subtotal.add(lineTotal);
            }
        }

        BigDecimal saleDiscount = req.discountAmount() != null ? req.discountAmount() : BigDecimal.ZERO;

        // Loyalty points redemption: 1 point = Rs. 1 discount
        int pointsToRedeem = req.loyaltyPointsRedeemed() != null ? req.loyaltyPointsRedeemed() : 0;
        if (pointsToRedeem > 0) {
            if (customer == null) {
                throw AppException.badRequest("A customer must be attached to redeem loyalty points");
            }
            if (customer.getLoyaltyPoints() < pointsToRedeem) {
                throw AppException.badRequest("Insufficient loyalty points");
            }
            saleDiscount = saleDiscount.add(BigDecimal.valueOf(pointsToRedeem));
        }

        BigDecimal totalAmount  = subtotal.subtract(saleDiscount).add(taxAmount);
        if (totalAmount.compareTo(BigDecimal.ZERO) < 0) totalAmount = BigDecimal.ZERO;

        // Determine payment method and handle split payments
        PaymentMethod paymentMethod = req.paymentMethod() != null ? req.paymentMethod() : PaymentMethod.CASH;
        List<SalePayment> payments = new ArrayList<>();

        if (req.payments() != null && !req.payments().isEmpty()) {
            paymentMethod = PaymentMethod.MIXED;
            BigDecimal paymentsTotal = req.payments().stream()
                    .map(p -> p.amount())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (paymentsTotal.compareTo(totalAmount) < 0) {
                throw AppException.badRequest("Total payment amount is less than sale total");
            }
        }

        BigDecimal amountTendered = req.amountTendered() != null ? req.amountTendered() : totalAmount;
        BigDecimal changeDue = amountTendered.subtract(totalAmount);

        if (changeDue.compareTo(BigDecimal.ZERO) < 0 && (req.payments() == null || req.payments().isEmpty())) {
            throw AppException.badRequest("Amount tendered is less than total");
        }
        if (changeDue.compareTo(BigDecimal.ZERO) < 0) {
            changeDue = BigDecimal.ZERO;
        }

        // Compute points earned: each product line contributes (lineTotal * multiplier / 100) points.
        // Manual items earn 1x by default.
        BigDecimal weightedTotal = BigDecimal.ZERO;
        for (SaleItem si : saleItems) {
            int multiplier = si.getProduct() != null ? si.getProduct().getLoyaltyMultiplier() : 1;
            weightedTotal = weightedTotal.add(si.getLineTotal().multiply(BigDecimal.valueOf(multiplier)));
        }
        int pointsEarned = weightedTotal.divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR).intValue();

        String receiptNumber = "RCP-" + RECEIPT_FMT.format(Instant.now())
                + "-" + store.getId();

        Sale sale = Sale.builder()
                .store(store)
                .shift(shift)
                .cashier(cashier)
                .customer(customer)
                .receiptNumber(receiptNumber)
                .status(SaleStatus.COMPLETED)
                .subtotal(subtotal)
                .discountAmount(saleDiscount)
                .taxAmount(taxAmount)
                .totalAmount(totalAmount)
                .amountTendered(amountTendered)
                .changeDue(changeDue)
                .paymentMethod(paymentMethod)
                .notes(req.notes())
                .loyaltyPointsRedeemed(pointsToRedeem)
                .pointsEarned(customer != null ? pointsEarned : 0)
                .build();

        // Associate items with sale
        for (SaleItem item : saleItems) {
            item.setSale(sale);
            sale.getItems().add(item);
        }

        // Associate split payments if provided
        if (req.payments() != null && !req.payments().isEmpty()) {
            for (var payReq : req.payments()) {
                SalePayment sp = SalePayment.builder()
                        .sale(sale)
                        .paymentMethod(payReq.paymentMethod())
                        .amount(payReq.amount())
                        .build();
                sale.getPayments().add(sp);
            }
        }

        saleRepository.save(sale);

        // Deduct inventory for product items only (manual items have no stock)
        for (SaleItem item : saleItems) {
            if (item.getProduct() != null) {
                deductStock(store, item.getProduct(), item.getQuantity(), sale.getId());
            }
        }

        // Update customer loyalty points and total spent
        if (customer != null) {
            customer.setTotalSpent(customer.getTotalSpent().add(totalAmount));
            int newPoints = customer.getLoyaltyPoints() - pointsToRedeem + pointsEarned;
            customer.setLoyaltyPoints(Math.max(0, newPoints));
            customerRepository.save(customer);
        }

        log.info("Sale {} created in store {} shift {}", receiptNumber, store.getId(), shift.getId());
        return SaleResponse.from(sale);
    }

    // ── Void sale ─────────────────────────────────────────────────────────────

    @Transactional
    public SaleResponse voidSale(Long saleId, VoidSaleRequest req) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> AppException.notFound("Sale not found"));

        if (sale.getStatus() == SaleStatus.VOIDED) {
            throw AppException.conflict("Sale is already voided");
        }

        User voidUser = currentUser();
        sale.setStatus(SaleStatus.VOIDED);
        sale.setVoidedBy(voidUser);
        sale.setVoidedAt(Instant.now());
        sale.setVoidReason(req.reason());

        // Return stock for product items only
        for (SaleItem item : sale.getItems()) {
            if (item.getProduct() != null) {
                returnStock(sale.getStore(), item.getProduct(), item.getQuantity(), saleId);
            }
        }

        // Restore customer loyalty points
        if (sale.getCustomer() != null) {
            Customer customer = sale.getCustomer();
            // Remove points this sale earned, add back points that were redeemed
            int restored = customer.getLoyaltyPoints()
                    - sale.getPointsEarned()
                    + sale.getLoyaltyPointsRedeemed();
            customer.setLoyaltyPoints(Math.max(0, restored));
            BigDecimal newTotalSpent = customer.getTotalSpent().subtract(sale.getTotalAmount());
            customer.setTotalSpent(newTotalSpent.max(BigDecimal.ZERO));
            customerRepository.save(customer);
        }

        log.info("Sale {} voided by {}", sale.getReceiptNumber(), voidUser.getEmail());
        SaleResponse result = SaleResponse.from(saleRepository.save(sale));
        auditLogService.log(sale.getStore().getId(), "VOID", "SALE", saleId,
                "Voided: " + sale.getReceiptNumber() + " reason=" + req.reason());
        return result;
    }

    // ── Email receipt ─────────────────────────────────────────────────────────

    public void emailReceipt(Long saleId, String toEmail) {
        if (mailSender == null) {
            throw AppException.badRequest("Email is not configured on this server");
        }
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> AppException.notFound("Sale not found"));

        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject("Your receipt – " + sale.getReceiptNumber());
            helper.setText(buildReceiptText(sale), false);
            mailSender.send(message);
            log.info("Receipt {} emailed to {}", sale.getReceiptNumber(), toEmail);
        } catch (Exception e) {
            throw AppException.badRequest("Failed to send email: " + e.getMessage());
        }
    }

    private String buildReceiptText(Sale sale) {
        StringBuilder sb = new StringBuilder();
        sb.append("Receipt #: ").append(sale.getReceiptNumber()).append("\n");
        sb.append("Date: ").append(sale.getCreatedAt()).append("\n\n");
        for (var item : sale.getItems()) {
            String name = item.getProduct() != null ? item.getProduct().getName() : item.getManualDescription();
            sb.append(name).append("  x").append(item.getQuantity())
              .append("  Rs.").append(item.getLineTotal()).append("\n");
        }
        sb.append("\nSubtotal: Rs.").append(sale.getSubtotal());
        if (sale.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0)
            sb.append("\nDiscount: -Rs.").append(sale.getDiscountAmount());
        sb.append("\nTotal: Rs.").append(sale.getTotalAmount());
        sb.append("\n\nThank you for your purchase!");
        return sb.toString();
    }

    // ── Stock helpers ─────────────────────────────────────────────────────────

    private void deductStock(Store store, Product product, BigDecimal qty, Long saleId) {
        StockBalance balance = stockBalanceRepository
                .findByStoreIdAndProductIdForUpdate(store.getId(), product.getId())
                .orElseGet(() -> StockBalance.builder()
                        .store(store).product(product).quantity(BigDecimal.ZERO).build());

        BigDecimal before = balance.getQuantity();
        if (before.compareTo(qty) < 0) {
            log.warn("Selling {} units of {} but only {} in stock — allowing oversell",
                    qty, product.getName(), before);
        }

        BigDecimal after = before.subtract(qty);
        balance.setQuantity(after);
        stockBalanceRepository.save(balance);

        stockMovementRepository.save(StockMovement.builder()
                .store(store)
                .product(product)
                .movementType(MovementType.SALE)
                .quantity(qty.negate())
                .quantityBefore(before)
                .quantityAfter(after)
                .referenceId(saleId)
                .note("Sale")
                .build());
    }

    private void returnStock(Store store, Product product, BigDecimal qty, Long saleId) {
        StockBalance balance = stockBalanceRepository
                .findByStoreIdAndProductIdForUpdate(store.getId(), product.getId())
                .orElseGet(() -> StockBalance.builder()
                        .store(store).product(product).quantity(BigDecimal.ZERO).build());

        BigDecimal before = balance.getQuantity();
        BigDecimal after  = before.add(qty);
        balance.setQuantity(after);
        stockBalanceRepository.save(balance);

        stockMovementRepository.save(StockMovement.builder()
                .store(store)
                .product(product)
                .movementType(MovementType.VOID)
                .quantity(qty)
                .quantityBefore(before)
                .quantityAfter(after)
                .referenceId(saleId)
                .note("Void")
                .build());
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound("Authenticated user not found"));
    }
}
