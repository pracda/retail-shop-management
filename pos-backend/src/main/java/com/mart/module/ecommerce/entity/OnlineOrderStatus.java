package com.mart.module.ecommerce.entity;

public enum OnlineOrderStatus {
    PENDING,     // placed, awaiting confirmation
    CONFIRMED,   // store accepted
    FULFILLED,   // ready for pickup / dispatched
    CANCELLED    // cancelled by customer or store
}
