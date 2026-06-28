package com.mart.module.shift.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.expense.service.ExpenseService;
import com.mart.module.refund.repository.RefundRepository;
import com.mart.module.sale.repository.SaleRepository;
import com.mart.module.shift.dto.request.CloseShiftRequest;
import com.mart.module.shift.dto.request.OpenShiftRequest;
import com.mart.module.shift.dto.response.CashReconciliationResponse;
import com.mart.module.shift.dto.response.ShiftResponse;
import com.mart.module.shift.entity.Shift;
import com.mart.module.shift.entity.ShiftStatus;
import com.mart.module.shift.repository.ShiftRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

@Service
public class ShiftService {

    private final ShiftRepository shiftRepository;
    private final StoreRepository storeRepository;
    private final SaleRepository saleRepository;
    private final RefundRepository refundRepository;
    private final UserRepository userRepository;
    private final ExpenseService expenseService;

    @Autowired
    public ShiftService(ShiftRepository shiftRepository,
                        StoreRepository storeRepository,
                        UserRepository userRepository,
                        SaleRepository saleRepository,
                        RefundRepository refundRepository,
                        @Lazy ExpenseService expenseService) {
        this.shiftRepository = shiftRepository;
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.saleRepository = saleRepository;
        this.refundRepository = refundRepository;
        this.expenseService = expenseService;
    }

    @Transactional
    public ShiftResponse openShift(OpenShiftRequest req) {
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        if (shiftRepository.findFirstByStoreIdAndStatus(req.storeId(), ShiftStatus.OPEN).isPresent()) {
            throw AppException.conflict("A shift is already open for this store");
        }

        User opener = currentUser();

        Shift shift = Shift.builder()
                .store(store)
                .cashier(opener)
                .openedBy(opener)
                .openingFloat(req.openingFloat() != null ? req.openingFloat() : java.math.BigDecimal.ZERO)
                .status(ShiftStatus.OPEN)
                .openedAt(Instant.now())
                .build();

        Shift saved = shiftRepository.save(shift);
        return ShiftResponse.from(saved, expenseService.getTotalExpensesForShift(saved.getId()));
    }

    @Transactional
    public ShiftResponse closeShift(Long shiftId, CloseShiftRequest req) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> AppException.notFound("Shift not found"));

        if (shift.getStatus() == ShiftStatus.CLOSED) {
            throw AppException.conflict("Shift is already closed");
        }

        shift.setStatus(ShiftStatus.CLOSED);
        shift.setClosingCash(req.closingCash());
        shift.setNotes(req.notes());
        shift.setClosedBy(currentUser());
        shift.setClosedAt(Instant.now());

        Shift saved = shiftRepository.save(shift);
        return ShiftResponse.from(saved, expenseService.getTotalExpensesForShift(saved.getId()));
    }

    /** Returns the store's currently open shift (store-level — one per store). */
    @Transactional(readOnly = true)
    public Optional<ShiftResponse> getCurrentShift(Long storeId) {
        return shiftRepository
                .findFirstByStoreIdAndStatus(storeId, ShiftStatus.OPEN)
                .map(s -> ShiftResponse.from(s, expenseService.getTotalExpensesForShift(s.getId())));
    }

    @Transactional(readOnly = true)
    public ShiftResponse getShift(Long shiftId) {
        return shiftRepository.findById(shiftId)
                .map(s -> ShiftResponse.from(s, expenseService.getTotalExpensesForShift(s.getId())))
                .orElseThrow(() -> AppException.notFound("Shift not found"));
    }

    @Transactional(readOnly = true)
    public PageResponse<ShiftResponse> getShiftHistory(Long storeId, int page, int size) {
        var pageResult = shiftRepository.findByStoreId(storeId, PageRequest.of(page, size))
                .map(s -> ShiftResponse.from(s, expenseService.getTotalExpensesForShift(s.getId())));
        return PageResponse.from(pageResult);
    }

    @Transactional(readOnly = true)
    public CashReconciliationResponse getReconciliation(Long shiftId) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> AppException.notFound("Shift not found"));

        BigDecimal openingFloat  = shift.getOpeningFloat() != null ? shift.getOpeningFloat() : BigDecimal.ZERO;
        BigDecimal cashSales     = saleRepository.sumCashPaymentsByShift(shiftId);
        BigDecimal cashRefunds   = refundRepository.sumCashRefundsByShift(shiftId);
        BigDecimal expenses      = expenseService.getTotalExpensesForShift(shiftId);

        BigDecimal expectedCash  = openingFloat.add(cashSales).subtract(cashRefunds).subtract(expenses);
        BigDecimal closingCash   = shift.getClosingCash();
        BigDecimal variance      = closingCash != null ? closingCash.subtract(expectedCash) : null;

        String cashierName = shift.getCashier().getFirstName() + " " + shift.getCashier().getLastName();

        return new CashReconciliationResponse(
                shift.getId(),
                cashierName,
                shift.getOpenedAt(),
                shift.getClosedAt(),
                shift.getStatus().name(),
                openingFloat,
                cashSales,
                cashRefunds,
                expenses,
                expectedCash,
                closingCash,
                variance
        );
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound("Authenticated user not found"));
    }
}
