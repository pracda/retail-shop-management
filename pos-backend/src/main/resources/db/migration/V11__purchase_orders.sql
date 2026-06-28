CREATE TABLE purchase_orders (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id        BIGINT        NOT NULL,
    supplier_id     BIGINT        NOT NULL,
    created_by_id   BIGINT        NOT NULL,
    received_by_id  BIGINT        NULL,
    po_number       VARCHAR(60)   NOT NULL UNIQUE,
    status          VARCHAR(25)   NOT NULL DEFAULT 'DRAFT',
        -- DRAFT | ORDERED | PARTIALLY_RECEIVED | RECEIVED | CANCELLED
    notes           TEXT          NULL,
    ordered_at      DATETIME(6)   NULL,
    received_at     DATETIME(6)   NULL,
    created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_po_store    FOREIGN KEY (store_id)      REFERENCES stores(id),
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id)   REFERENCES suppliers(id),
    CONSTRAINT fk_po_creator  FOREIGN KEY (created_by_id) REFERENCES users(id),
    CONSTRAINT fk_po_receiver FOREIGN KEY (received_by_id) REFERENCES users(id)
) ENGINE = InnoDB;

CREATE TABLE purchase_order_items (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    po_id             BIGINT         NOT NULL,
    product_id        BIGINT         NOT NULL,
    quantity_ordered  DECIMAL(10,3)  NOT NULL,
    quantity_received DECIMAL(10,3)  NOT NULL DEFAULT 0,
    unit_cost         DECIMAL(10,2)  NOT NULL,
    CONSTRAINT fk_poi_po      FOREIGN KEY (po_id)      REFERENCES purchase_orders(id),
    CONSTRAINT fk_poi_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE = InnoDB;
