# cPanel Deployment & Process Management Guide

This document outlines the process limit architecture and deployment procedures for MealBook on cPanel shared hosting (domainz.in).

---

## 1. Environment & Architecture Overview

- **Account Constraint**: CloudLinux enforces a hard limit of **150 concurrent processes** (EP limit) across the entire cPanel account.
- **Deployed Instances**:
  1. **Production API**: `/home/mealbook/api/`
  2. **Dev/Staging API**: `/home/mealbook/devapi.mealbook.in/`
- **Process Manager**: Phusion Passenger (LiteSpeed / Apache Node.js Selector)

---

## 2. Process Cap Directives (`.htaccess`)

A `.htaccess` file is placed at the root of `/backend/`:

```apache
# ----------------------------------------------------------------------
# Passenger / LiteSpeed Node.js Process Manager Limits
# Enforce exactly ONE Node.js instance per app root to prevent duplicate
# process spawning during concurrent bursts (e.g. Razorpay payment & webhook)
# and prevent exceeding CloudLinux 150-process account limits.
# ----------------------------------------------------------------------
PassengerMinInstances 1
PassengerMaxInstances 1
PassengerPoolIdleTime 300
```

### Directive Breakdown
| Directive | Value | Purpose |
| :--- | :--- | :--- |
| `PassengerMinInstances` | `1` | Keeps exactly 1 worker warmed up so cold starts don't delay user requests. |
| `PassengerMaxInstances` | `1` | **Hard ceiling** on worker spawning. Prevents dynamic scaling during bursts. |
| `PassengerPoolIdleTime` | `300` | Reaps any idle/orphaned worker after 300 seconds (5 minutes). |

> [!CAUTION]
> **Do NOT remove or increase `PassengerMaxInstances 1`**.
> If this directive is removed, Passenger will spawn up to 6 workers per application under concurrent load, which quickly exhausts the 150-process account limit and triggers host process termination.

---

## 3. Payment Flow Optimization Audit

The payment endpoints (Razorpay checkout, verification, and webhooks) have been audited and hardened against event loop blocking:
1. **Timing-Safe Signatures**: Converted raw string comparisons to `crypto.timingSafeEqual` with matched Buffer lengths to prevent timing attacks without blocking the thread.
2. **Connection Reuse in Token Generation**: `generateTokenNumber` accepts an active MySQL connection parameter, eliminating duplicate connection checkouts and nested transactions within order fulfillment.
3. **No Synchronous File/Crypto Calls**: All database operations use `mysql2/promise` with async/await. No `*Sync` filesystem or crypto methods are used in the request paths.

---

## 4. Server Verification Steps (Post-Deployment)

These directives take effect only in the deployed cPanel environment:

1. **Deploy `/backend/` files**:
   Ensure `.htaccess` is deployed to both app roots:
   - `/home/mealbook/api/.htaccess`
   - `/home/mealbook/devapi.mealbook.in/.htaccess`

2. **Restart Applications**:
   In cPanel -> **"Setup Node.js App"**, click **Restart** for both application instances.

3. **Verify Process Count via SSH**:
   SSH into your cPanel account and run:
   ```bash
   ps aux | grep -E 'node|passenger'
   ```
   Or:
   ```bash
   ps aux | grep node
   ```
   **Expected Result**: Exactly **one** Node.js worker process per app root (2 total across production and dev).

4. **Trigger Payment Burst Test**:
   Execute a test checkout + webhook in the application. Re-run `ps aux | grep node`.
   Confirm that Passenger does **NOT** spawn a second worker process; concurrent requests queue cleanly on the single instance with sub-second execution.
