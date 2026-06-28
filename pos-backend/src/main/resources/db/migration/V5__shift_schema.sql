-- ============================================================
-- V5: Shift schema
-- ============================================================

CREATE TABLE shifts (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    store_id        BIGINT          NOT NULL,
    cashier_id      BIGINT          NOT NULL,
    opened_by       BIGINT          NOT NULL,
    closed_by       BIGINT,
    status          VARCHAR(20)     NOT NULL DEFAULT 'OPEN',
    opening_float   DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    closing_cash    DECIMAL(10,2),
    notes           TEXT,
    opened_at       DATETIME(6)     NOT NULL,
    closed_at       DATETIME(6),
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_shifts_store    FOREIGN KEY (store_id)   REFERENCES stores (id),
    CONSTRAINT fk_shifts_cashier  FOREIGN KEY (cashier_id) REFERENCES users  (id),
    CONSTRAINT fk_shifts_opened_by FOREIGN KEY (opened_by) REFERENCES users  (id),
    CONSTRAINT fk_shifts_closed_by FOREIGN KEY (closed_by) REFERENCES users  (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_shifts_store   ON shifts(store_id);
CREATE INDEX idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX idx_shifts_status  ON shifts(status);
