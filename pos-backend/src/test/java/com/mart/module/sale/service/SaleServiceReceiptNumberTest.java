package com.mart.module.sale.service;

import com.mart.common.exception.AppException;
import com.mart.module.audit.service.AuditLogService;
import com.mart.module.customer.repository.CustomerRepository;
import com.mart.module.inventory.repository.StockBalanceRepository;
import com.mart.module.inventory.repository.StockMovementRepository;
import com.mart.module.product.repository.ProductRepository;
import com.mart.module.sale.repository.SaleRepository;
import com.mart.module.shift.repository.ShiftRepository;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SaleServiceReceiptNumberTest {

    @Mock private SaleRepository          saleRepository;
    @Mock private ShiftRepository         shiftRepository;
    @Mock private StoreRepository         storeRepository;
    @Mock private UserRepository          userRepository;
    @Mock private ProductRepository       productRepository;
    @Mock private StockBalanceRepository  stockBalanceRepository;
    @Mock private StockMovementRepository stockMovementRepository;
    @Mock private CustomerRepository      customerRepository;
    @Mock private AuditLogService         auditLogService;

    @InjectMocks
    private SaleService saleService;

    @Test
    void receiptNumberMatchesExpectedFormat() {
        when(saleRepository.existsByReceiptNumber(anyString())).thenReturn(false);

        String receipt = saleService.generateReceiptNumber(7L);

        assertThat(receipt).matches("RCP-\\d{14}-7-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}");
    }

    @Test
    void rapidCallsWithinTheSameSecondProduceUniqueNumbers() {
        when(saleRepository.existsByReceiptNumber(anyString())).thenReturn(false);

        Set<String> receipts = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            receipts.add(saleService.generateReceiptNumber(1L));
        }

        // Before the fix every call in the same second produced the same value.
        assertThat(receipts).hasSize(200);
    }

    @Test
    void regeneratesWhenCandidateAlreadyExists() {
        when(saleRepository.existsByReceiptNumber(anyString()))
                .thenReturn(true, true, false);

        String receipt = saleService.generateReceiptNumber(1L);

        assertThat(receipt).isNotBlank();
        verify(saleRepository, times(3)).existsByReceiptNumber(anyString());
    }

    @Test
    void failsClearlyWhenNoUniqueCandidateFound() {
        when(saleRepository.existsByReceiptNumber(anyString())).thenReturn(true);

        assertThatThrownBy(() -> saleService.generateReceiptNumber(1L))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("receipt number");
    }
}
