package com.mart.module.inventory.entity;

public enum MovementType {
    RECEIVE,      // goods received from vendor
    PURCHASE,     // purchase order receiving increases stock
    SALE,         // sold at POS (quantity decreases)
    ADJUSTMENT,   // manual stock correction
    RETURN,       // customer refund restores stock
    VOID          // voided sale restores stock
}
