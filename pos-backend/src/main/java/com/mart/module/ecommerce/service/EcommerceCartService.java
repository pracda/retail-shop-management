package com.mart.module.ecommerce.service;

import com.mart.common.exception.AppException;
import com.mart.module.ecommerce.dto.request.CartItemRequest;
import com.mart.module.ecommerce.dto.response.CartResponse;
import com.mart.module.ecommerce.entity.OnlineCart;
import com.mart.module.ecommerce.entity.OnlineCartItem;
import com.mart.module.ecommerce.entity.OnlineCustomer;
import com.mart.module.ecommerce.repository.OnlineCartRepository;
import com.mart.module.ecommerce.repository.OnlineCustomerRepository;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.product.entity.Product;
import com.mart.module.product.repository.ProductRepository;
import com.mart.module.store.entity.Store;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EcommerceCartService {

    private final OnlineCartRepository cartRepository;
    private final OnlineCustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final StockBalanceRepository stockBalanceRepository;

    @Transactional(readOnly = true)
    public CartResponse getCart(Long customerId, Long storeId) {
        return cartRepository.findByCustomerIdAndStoreIdFetched(customerId, storeId)
                .map(this::toResponse)
                .orElse(emptyCart());
    }

    @Transactional
    public CartResponse upsertItem(Long customerId, Long storeId, CartItemRequest request) {
        OnlineCart cart = getOrCreateCart(customerId, storeId);

        // Purge any stale zero-quantity items left over from previous bugs or orders
        cart.getItems().removeIf(i -> i.getQuantity() == null || i.getQuantity() <= 0);

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> AppException.notFound("Product not found"));

        if (!product.getStore().getId().equals(storeId) || !Boolean.TRUE.equals(product.getIsActive())) {
            throw AppException.badRequest("Product is not available");
        }

        // Treat quantity=0 as an explicit remove
        if (request.getQuantity() <= 0) {
            cart.getItems().removeIf(i -> i.getProduct().getId().equals(request.getProductId()));
            return toResponse(cartRepository.save(cart));
        }

        cart.getItems().stream()
                .filter(i -> i.getProduct().getId().equals(request.getProductId()))
                .findFirst()
                .ifPresentOrElse(
                        i -> i.setQuantity(request.getQuantity()),
                        () -> cart.getItems().add(OnlineCartItem.builder()
                                .cart(cart).product(product).quantity(request.getQuantity()).build())
                );

        return toResponse(cartRepository.save(cart));
    }

    @Transactional
    public CartResponse removeItem(Long customerId, Long storeId, Long productId) {
        OnlineCart cart = cartRepository.findByCustomerIdAndStoreIdFetched(customerId, storeId)
                .orElseThrow(() -> AppException.notFound("Cart not found"));
        cart.getItems().removeIf(i -> i.getProduct().getId().equals(productId));
        return toResponse(cartRepository.save(cart));
    }

    @Transactional
    public void clearCart(Long customerId, Long storeId) {
        cartRepository.findByCustomerIdAndStoreId(customerId, storeId)
                .ifPresent(cart -> {
                    cart.getItems().clear();
                    cartRepository.save(cart);
                });
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private OnlineCart getOrCreateCart(Long customerId, Long storeId) {
        return cartRepository.findByCustomerIdAndStoreIdFetched(customerId, storeId)
                .orElseGet(() -> {
                    OnlineCustomer customer = customerRepository.findById(customerId)
                            .orElseThrow(() -> AppException.notFound("Customer not found"));
                    Store store = customer.getStore(); // already store-scoped by auth
                    OnlineCart newCart = OnlineCart.builder()
                            .customer(customer).store(store).build();
                    return cartRepository.save(newCart);
                });
    }

    private CartResponse toResponse(OnlineCart cart) {
        List<CartResponse.CartItemResponse> items = cart.getItems().stream()
                .filter(i -> i.getQuantity() != null && i.getQuantity() > 0)
                .map(i -> {
                    Product p = i.getProduct();
                    var stockOpt = stockBalanceRepository.findByStoreIdAndProductId(
                            cart.getStore().getId(), p.getId());
                    BigDecimal stock = stockOpt.map(sb -> sb.getQuantity()).orElse(BigDecimal.ZERO);
                    BigDecimal lineTotal = p.getSellingPrice()
                            .multiply(BigDecimal.valueOf(i.getQuantity()));
                    return CartResponse.CartItemResponse.builder()
                            .productId(p.getId())
                            .productName(p.getName())
                            .unitPrice(p.getSellingPrice())
                            .quantity(i.getQuantity())
                            .lineTotal(lineTotal)
                            .currentStock(stock)
                            .inStock(stock.compareTo(BigDecimal.ZERO) > 0)
                            .build();
                })
                .toList();

        BigDecimal subtotal = items.stream()
                .map(CartResponse.CartItemResponse::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return CartResponse.builder()
                .cartId(cart.getId())
                .items(items)
                .subtotal(subtotal)
                .itemCount(items.stream().mapToInt(CartResponse.CartItemResponse::getQuantity).sum())
                .build();
    }

    private CartResponse emptyCart() {
        return CartResponse.builder()
                .items(List.of()).subtotal(BigDecimal.ZERO).itemCount(0).build();
    }
}
