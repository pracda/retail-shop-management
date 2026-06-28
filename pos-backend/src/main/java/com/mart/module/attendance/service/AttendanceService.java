package com.mart.module.attendance.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.attendance.dto.CashierSessionResponse;
import com.mart.module.attendance.dto.ClockInRequest;
import com.mart.module.attendance.dto.ClockOutRequest;
import com.mart.module.attendance.dto.UpdateSessionRequest;
import com.mart.module.attendance.entity.CashierSession;
import com.mart.module.attendance.repository.CashierSessionRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final CashierSessionRepository sessionRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    @Transactional
    public CashierSessionResponse clockIn(ClockInRequest req) {
        User cashier = currentUser();
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        if (sessionRepository.existsByStoreIdAndCashierIdAndClockedOutAtIsNull(
                req.storeId(), cashier.getId())) {
            throw AppException.conflict("Already clocked in at this store");
        }

        CashierSession session = CashierSession.builder()
                .store(store)
                .cashier(cashier)
                .clockedInAt(Instant.now())
                .build();

        return CashierSessionResponse.from(sessionRepository.save(session));
    }

    @Transactional
    public CashierSessionResponse clockOut(Long storeId, ClockOutRequest req) {
        User cashier = currentUser();

        CashierSession session = sessionRepository
                .findByStoreIdAndCashierIdAndClockedOutAtIsNull(storeId, cashier.getId())
                .orElseThrow(() -> AppException.badRequest("You are not currently clocked in at this store"));

        session.setClockedOutAt(Instant.now());
        if (req != null && req.notes() != null) {
            session.setNotes(req.notes());
        }

        return CashierSessionResponse.from(sessionRepository.save(session));
    }

    @Transactional(readOnly = true)
    public Optional<CashierSessionResponse> getActiveSession(Long storeId, Long cashierId) {
        return sessionRepository
                .findByStoreIdAndCashierIdAndClockedOutAtIsNull(storeId, cashierId)
                .map(CashierSessionResponse::from);
    }

    @Transactional(readOnly = true)
    public PageResponse<CashierSessionResponse> getHistory(
            Long storeId, Long cashierId, java.time.Instant from, java.time.Instant to, int page, int size) {
        var pageable = PageRequest.of(page, size);
        var result = cashierId != null
                ? sessionRepository.findByStoreIdAndCashierIdAndDateRange(storeId, cashierId, from, to, pageable)
                : sessionRepository.findByStoreIdAndDateRange(storeId, from, to, pageable);
        return PageResponse.from(result.map(CashierSessionResponse::from));
    }

    @Transactional
    public CashierSessionResponse updateSession(Long sessionId, UpdateSessionRequest req) {
        CashierSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> AppException.notFound("Session not found"));

        if (req.clockedOutAt() != null && req.clockedOutAt().isBefore(req.clockedInAt())) {
            throw AppException.badRequest("Clock-out time must be after clock-in time");
        }

        session.setClockedInAt(req.clockedInAt());
        session.setClockedOutAt(req.clockedOutAt());
        if (req.notes() != null) {
            session.setNotes(req.notes());
        }

        return CashierSessionResponse.from(sessionRepository.save(session));
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> AppException.notFound("Authenticated user not found"));
    }
}
