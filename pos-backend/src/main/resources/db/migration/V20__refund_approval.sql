-- Add approval workflow to refunds table
ALTER TABLE refunds
    ADD COLUMN status          VARCHAR(20)  NOT NULL DEFAULT 'APPROVED' AFTER refund_method,
    ADD COLUMN approved_by_id  BIGINT       NULL     AFTER status,
    ADD COLUMN approved_at     DATETIME(6)  NULL     AFTER approved_by_id,
    ADD COLUMN rejection_reason TEXT        NULL     AFTER approved_at,
    ADD CONSTRAINT fk_refund_approver FOREIGN KEY (approved_by_id) REFERENCES users(id);

-- Back-fill existing refunds as APPROVED (they were processed immediately before this change)
UPDATE refunds SET status = 'APPROVED';

CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_sale_id ON refunds(sale_id);
