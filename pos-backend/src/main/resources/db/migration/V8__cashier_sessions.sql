-- Track individual cashier clock-in / clock-out times (separate from store shifts)
CREATE TABLE cashier_sessions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id        BIGINT        NOT NULL,
    cashier_id      BIGINT        NOT NULL,
    clocked_in_at   DATETIME(6)   NOT NULL,
    clocked_out_at  DATETIME(6)   NULL,
    notes           VARCHAR(500)  NULL,
    created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_cs_store   FOREIGN KEY (store_id)   REFERENCES stores(id),
    CONSTRAINT fk_cs_cashier FOREIGN KEY (cashier_id) REFERENCES users(id)
) ENGINE = InnoDB;

-- Also change shifts to be store-level (remove cashier-level uniqueness)
-- The `cashier_id` column stays but now means "opened by whom" (same as opened_by)
-- No schema change needed — just behaviour change in the service layer
