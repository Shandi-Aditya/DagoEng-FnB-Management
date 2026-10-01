# Testing & Quality Assurance Documentation

Runner: **Vitest**  
Scope: **Auth Security, RBAC Enforcement, Tenant Isolation, Outlet Boundaries**

---

## 1. Automated Test Suite Overview

All tests are located in `tests/` and run against the isolated test environment:

```
tests/
├── auth.test.ts             # Password hashing, SHA-256 session token hashing
├── rbac.test.ts             # RBAC matrix, permission assertions, dynamic nav filtering
├── tenant-isolation.test.ts # Cross-tenant boundaries (Kopi Senja vs Bali Brew Demo)
└── outlet-isolation.test.ts # Single-outlet operational enforcement vs multi-outlet analytics
```

---

## 2. Running Tests

```bash
# Run all unit and isolation tests
npm run test
```

### Test Results (Phase 1 Baseline):
```
 ✓ tests/outlet-isolation.test.ts (4 tests)
 ✓ tests/tenant-isolation.test.ts (3 tests)
 ✓ tests/rbac.test.ts (4 tests)
 ✓ tests/auth.test.ts (2 tests)

Test Files  4 passed (4)
     Tests  13 passed (13)
```
