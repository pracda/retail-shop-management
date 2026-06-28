package com.mart.module.purchaseorder.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.inventory.entity.MovementType;
import com.mart.module.inventory.entity.StockBalance;
import com.mart.module.inventory.entity.StockMovement;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.inventory.repository.StockMovementRepository;
import com.mart.module.product.entity.Product;
import com.mart.module.product.repository.ProductRepository;
import com.mart.module.purchaseorder.dto.CreatePurchaseOrderRequest;
import com.mart.module.purchaseorder.dto.PurchaseOrderResponse;
import com.mart.module.purchaseorder.dto.ReceiveItemsRequest;
import com.mart.module.purchaseorder.entity.PurchaseOrder;
import com.mart.module.purchaseorder.entity.PurchaseOrderItem;
import com.mart.module.purchaseorder.entity.PurchaseOrderStatus;
import com.mart.module.purchaseorder.repository.PurchaseOrderItemRepository;
import com.mart.module.purchaseorder.repository.PurchaseOrderRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.supplier.entity.Supplier;
import com.mart.module.supplier.repository.SupplierRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class PurchaseOrderService {

    private final PurchaseOrderRepository poRepository;
    private final PurchaseOrderItemRepository poItemRepository;
    private final SupplierRepository supplierRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final StockBalanceRepository stockBalanceRepository;
    private final StockMovementRepository stockMovementRepository;

    private static final DateTimeFormatter PO_DATE_FMT =
            DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneId.systemDefault());

    @Transactional(readOnly = true)
    public PageResponse<PurchaseOrderResponse> getOrders(Long storeId, int page, int size) {
        return PageResponse.from(
                poRepository.findByStoreId(storeId, PageRequest.of(page, size))
                        .map(PurchaseOrderResponse::from));
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse getOrder(Long id) {
        return poRepository.findById(id)
                .map(PurchaseOrderResponse::from)
                .orElseThrow(() -> AppException.notFound("Purchase order not found"));
    }

    @Transactional
    public PurchaseOrderResponse createOrder(CreatePurchaseOrderRequest req) {
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));
        Supplier supplier = supplierRepository.findById(req.supplierId())
                .orElseThrow(() -> AppException.notFound("Supplier not found"));
        User creator = currentUser();

        String poNumber = "PO-" + PO_DATE_FMT.format(Instant.now())
                + "-" + store.getId()
                + "-" + System.currentTimeMillis() % 10000;

        PurchaseOrder po = PurchaseOrder.builder()
                .store(store)
                .supplier(supplier)
                .createdBy(creator)
                .poNumber(poNumber)
                .status(PurchaseOrderStatus.DRAFT)
                .notes(req.notes())
                .build();

        if (req.items() != null) {
            for (var itemReq : req.items()) {
                Product product = productRepository.findById(itemReq.productId())
                        .orElseThrow(() -> AppException.notFound("Product not found: " + itemReq.productId()));
                PurchaseOrderItem item = PurchaseOrderItem.builder()
                        .purchaseOrder(po)
                        .product(product)
                        .quantityOrdered(itemReq.quantityOrdered())
                        .quantityReceived(BigDecimal.ZERO)
                        .unitCost(itemReq.unitCost())
                        .build();
                po.getItems().add(item);
            }
        }

        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse markOrdered(Long id) {
        PurchaseOrder po = poRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Purchase order not found"));
        if (po.getStatus() != PurchaseOrderStatus.DRAFT) {
            throw AppException.badRequest("Order must be in DRAFT status to mark as ordered");
        }
        po.setStatus(PurchaseOrderStatus.ORDERED);
        po.setOrderedAt(Instant.now());
        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse receiveItems(Long id, ReceiveItemsRequest req) {
        PurchaseOrder po = poRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Purchase order not found"));

        if (po.getStatus() == PurchaseOrderStatus.CANCELLED || po.getStatus() == PurchaseOrderStatus.RECEIVED) {
            throw AppException.badRequest("Cannot receive items for this order in status: " + po.getStatus());
        }

        Store store = po.getStore();

        for (var line : req.lines()) {
            PurchaseOrderItem item = poItemRepository.findById(line.poItemId())
                    .orElseThrow(() -> AppException.notFound("PO item not found: " + line.poItemId()));

            if (!item.getPurchaseOrder().getId().equals(id)) {
                throw AppException.badRequest("PO item does not belong to this order");
            }

            BigDecimal toReceive = line.quantityReceived();
            item.setQuantityReceived(item.getQuantityReceived().add(toReceive));
            poItemRepository.save(item);

            // Update stock balance
            Product product = item.getProduct();
            StockBalance balance = stockBalanceRepository
                    .findByStoreIdAndProductIdForUpdate(store.getId(), product.getId())
                    .orElseGet(() -> StockBalance.builder()
                            .store(store).product(product).quantity(BigDecimal.ZERO).build());

            BigDecimal before = balance.getQuantity();
            BigDecimal after = before.add(toReceive);
            balance.setQuantity(after);
            stockBalanceRepository.save(balance);

            stockMovementRepository.save(StockMovement.builder()
                    .store(store)
                    .product(product)
                    .movementType(MovementType.PURCHASE)
                    .quantity(toReceive)
                    .quantityBefore(before)
                    .quantityAfter(after)
                    .referenceId(id)
                    .note("Purchase Order: " + po.getPoNumber())
                    .build());
        }

        // Recalculate status
        boolean allReceived = po.getItems().stream().allMatch(
                item -> item.getQuantityReceived().compareTo(item.getQuantityOrdered()) >= 0);
        boolean anyReceived = po.getItems().stream().anyMatch(
                item -> item.getQuantityReceived().compareTo(BigDecimal.ZERO) > 0);

        if (allReceived) {
            po.setStatus(PurchaseOrderStatus.RECEIVED);
            po.setReceivedAt(Instant.now());
        } else if (anyReceived) {
            po.setStatus(PurchaseOrderStatus.PARTIALLY_RECEIVED);
        }

        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse cancelOrder(Long id) {
        PurchaseOrder po = poRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Purchase order not found"));
        if (po.getStatus() == PurchaseOrderStatus.RECEIVED) {
            throw AppException.badRequest("Cannot cancel a fully received order");
        }
        po.setStatus(PurchaseOrderStatus.CANCELLED);
        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    /**
     * Auto-reorder: create a DRAFT PO for all low-stock products in a store.
     * Each item ordered up to 2× the low-stock threshold.
     */
    @Transactional
    public PurchaseOrderResponse fromLowStock(Long storeId, Long supplierId, String notes) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> AppException.notFound("Store not found"));
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> AppException.notFound("Supplier not found"));

        var lowStock = stockBalanceRepository.findLowStock(storeId,
                org.springframework.data.domain.PageRequest.of(0, 200));

        if (lowStock.isEmpty()) {
            throw AppException.badRequest("No low-stock products found for this store");
        }

        String poNumber = "PO-AUTO-" + PO_DATE_FMT.format(Instant.now())
                + "-" + store.getId()
                + "-" + System.currentTimeMillis() % 10000;

        PurchaseOrder po = PurchaseOrder.builder()
                .store(store)
                .supplier(supplier)
                .createdBy(currentUser())
                .poNumber(poNumber)
                .status(PurchaseOrderStatus.DRAFT)
                .notes(notes != null ? notes : "Auto-generated reorder")
                .build();

        for (var balance : lowStock.getContent()) {
            Product product = balance.getProduct();
            BigDecimal currentQty  = balance.getQuantity();
            BigDecimal targetQty   = BigDecimal.valueOf(product.getLowStockThreshold() * 2L);
            BigDecimal toOrder     = targetQty.subtract(currentQty).max(BigDecimal.ONE);

            po.getItems().add(PurchaseOrderItem.builder()
                    .purchaseOrder(po)
                    .product(product)
                    .quantityOrdered(toOrder)
                    .quantityReceived(BigDecimal.ZERO)
                    .unitCost(product.getCostPrice())
                    .build());
        }

        return PurchaseOrderResponse.from(poRepository.save(po));
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound("Authenticated user not found"));
    }
}
