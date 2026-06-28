CREATE TABLE shift_expenses (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id        BIGINT        NOT NULL,
    shift_id        BIGINT        NOT NULL,
    recorded_by_id  BIGINT        NOT NULL,
    description     VARCHAR(500)  NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    category        VARCHAR(100)  NULL,
    created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_exp_store FOREIGN KEY (store_id)       REFERENCES stores(id),
    CONSTRAINT fk_exp_shift FOREIGN KEY (shift_id)       REFERENCES shifts(id),
    CONSTRAINT fk_exp_user  FOREIGN KEY (recorded_by_id) REFERENCES users(id)
) ENGINE = InnoDB;
