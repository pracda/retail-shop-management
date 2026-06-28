package com.mart.module.attendance.entity;

import com.mart.module.store.entity.Store;
import com.mart.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cashier_sessions")
@EntityListeners(AuditingEntityListener.class)
public class CashierSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cashier_id", nullable = false)
    private User cashier;

    @Column(name = "clocked_in_at", nullable = false)
    private Instant clockedInAt;

    @Column(name = "clocked_out_at")
    private Instant clockedOutAt;

    @Column(length = 500)
    private String notes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public boolean isActive() {
        return clockedOutAt == null;
    }
}
