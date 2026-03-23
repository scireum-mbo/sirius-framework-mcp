# Tenants

The tenants module provides multi-tenant user management. Every piece of business
data belongs to a tenant, and every user belongs to a tenant. The framework enforces
tenant isolation automatically.

## Core Interfaces

### Tenant<I>

The database-independent interface for a tenant (company/organization):

```java
public interface Tenant<I extends Serializable>
        extends Entity, Transformable, Traced, Journaled, RateLimitedEntity, PerformanceFlagged {

    Mapping TENANT_DATA = Mapping.named("tenantData");
    TenantData getTenantData();
    boolean hasPermission(String permission);
    Set<String> getPermissions();
}
```

### UserAccount<I, T>

The database-independent interface for a user account within a tenant:

```java
public interface UserAccount<I extends Serializable, T extends Tenant<I>>
        extends Entity, Transformable, Traced, Journaled {

    Mapping USER_ACCOUNT_DATA = Mapping.named("userAccountData");
    UserAccountData getUserAccountData();
    BaseEntityRef<I, T> getTenant();
}
```

## TenantData and UserAccountData

All tenant fields live in the `TenantData` composite, shared between SQL and Mongo
implementations. Similarly, user fields live in `UserAccountData`. This avoids
field duplication across implementations.

Key fields in `TenantData`:
- `name` — display name of the tenant
- `accountNumber` — unique business identifier
- `address` — embedded `InternationalAddressData` composite
- `packageData` — permissions/features assigned to this tenant

Key fields in `UserAccountData`:
- `person` — embedded `PersonData` composite (name, salutation, email)
- `login` — embedded `LoginData` composite (username, password hash)
- `permissions` — assigned permissions/roles

## JDBC and MongoDB Implementations

| Interface        | JDBC Implementation    | Mongo Implementation     |
|------------------|------------------------|--------------------------|
| `Tenant<I>`      | `SQLTenant`            | `MongoTenant`            |
| `UserAccount`    | `SQLUserAccount`       | `MongoUserAccount`       |

These follow the entity triple pattern (see entity-triple resource). Both are
gated behind framework flags:
- `biz.tenants-jdbc` for SQL implementations
- `biz.tenants-mongo` for MongoDB implementations

## Tenant-Aware Entities

Entities that belong to a tenant extend `SQLTenantAware` or `MongoTenantAware`:

```java
public class SQLProduct extends SQLTenantAware {
    // Automatically gets a tenant reference field
    // Tenant is auto-filled on create via fillWithCurrentTenant()
}
```

`SQLTenantAware` extends `BizEntity` and adds:
- A `tenant` field (`SQLEntityRef<SQLTenant>`) — write-once, reject-on-delete
- `fillWithCurrentTenant()` — fills the tenant from the current session
- `assertSameTenant()` — validates that a referenced entity belongs to the same tenant

The Mongo equivalent (`MongoTenantAware`) works identically with `MongoRef`.

## Tenants Service

The `Tenants<I, T, U>` service provides tenant operations:

```java
@Part
private Tenants<?, ?, ?> tenants;

// Get current tenant
Tenant<?> currentTenant = tenants.getRequiredTenant();

// Check if current user is in the system tenant
boolean isSystem = tenants.isCurrentTenantSystemTenant();

// Filter a query to the current tenant
SmartQuery<SQLProduct> query = tenants.forCurrentTenant(oma.select(SQLProduct.class));
```

Concrete implementations: `SQLTenants` (JDBC) and `MongoTenants` (MongoDB).

## TenantUserManager

`TenantUserManager` is the `UserManager` implementation for the tenants module.
It bridges the web security framework with the tenant/user database:

- Authenticates users via login credentials
- Resolves permissions from user roles + tenant package
- Provides session management
- Supports "spy" mode (system tenant admins can act as another tenant)

Key permissions:
- `TenantUserManager.PERMISSION_SYSTEM_TENANT_MEMBER` — user belongs to the system tenant
- `TenantUserManager.PERMISSION_SYSTEM_ADMINISTRATOR` — user is a system admin
- `Tenant.PERMISSION_SYSTEM_TENANT` — flag on the tenant entity itself

## Permission Model

Permissions flow from multiple sources:

1. **Tenant package** — `PackageData` on the tenant defines which features are enabled
2. **User roles** — roles assigned to the user, each granting a set of permissions
3. **Role mapping** — configured in HOCON, maps role names to permission sets
4. **System tenant flag** — system tenant users get additional administrative permissions

```hocon
security.tenantPermissions {
    admin = ["permission-manage-users", "permission-manage-products"]
    viewer = ["permission-view-products"]
}
```

## System Tenant

One tenant is designated as the "system tenant" (configured by ID). Users in the
system tenant can:
- Manage all other tenants
- "Spy" on other tenants (act as if they belong to another tenant)
- Access system administration features

The system tenant flag is checked via `Tenant.hasPermission(Tenant.PERMISSION_SYSTEM_TENANT)`.

## Common Mistakes

1. **Not using `findForTenant()`** — Using `find()` in controllers allows access
   to entities from other tenants. Always use `findForTenant()` for tenant-scoped data.

2. **Forgetting to enable the framework** — Without `biz.tenants-jdbc = true` or
   `biz.tenants-mongo = true`, tenant entities are not registered.

3. **Manual tenant assignment** — Do not set the tenant reference manually.
   `SQLTenantAware.fillWithCurrentTenant()` is called automatically during entity
   creation. Manual assignment can cause tenant mismatch errors.

4. **Confusing tenant permissions with user permissions** — `Tenant.hasPermission()`
   checks tenant-level features. User permissions are checked via `UserInfo.hasPermission()`.
