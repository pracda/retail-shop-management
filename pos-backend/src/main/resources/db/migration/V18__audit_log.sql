CREATE TABLE audit_logs (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id    BIGINT       NOT NULL,
    user_id     BIGINT,
    action      VARCHAR(50)  NOT NULL,
    entity_type VARCHAR(50)  NOT NULL,
    entity_id   BIGINT,
    details     TEXT,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_store FOREIGN KEY (store_id) REFERENCES stores(id),
    CONSTRAINT fk_audit_user  FOREIGN KEY (user_id)  REFERENCES users(id)
);

CREATE INDEX idx_audit_store_created ON audit_logs(store_id, created_at DESC);
CREATE INDEX idx_audit_entity        ON audit_logs(entity_type, entity_id);
