CREATE TABLE refunds (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id          BIGINT         NOT NULL,
    refunded_by_id   BIGINT         NOT NULL,
    reason           TEXT           NOT NULL,
    refund_amount    DECIMAL(12,2)  NOT NULL,
    refund_method    VARCHAR(20)    NOT NULL DEFAULT 'CASH',
    created_at       DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_refund_sale FOREIGN KEY (sale_id)        REFERENCES sales(id),
    CONSTRAINT fk_refund_user FOREIGN KEY (refunded_by_id) REFERENCES users(id)
) ENGINE = InnoDB;

CREATE TABLE refund_items (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    refund_id     BIGINT         NOT NULL,
    sale_item_id  BIGINT         NOT NULL,
    quantity      DECIMAL(10,3)  NOT NULL,
    refund_amount DECIMAL(10,2)  NOT NULL,
    CONSTRAINT fk_ri_refund    FOREIGN KEY (refund_id)    REFERENCES refunds(id),
    CONSTRAINT fk_ri_sale_item FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
) ENGINE = InnoDB;
