ALTER TABLE sales
    ADD COLUMN loyalty_points_redeemed INT NOT NULL DEFAULT 0,
    ADD COLUMN points_earned            INT NOT NULL DEFAULT 0;
