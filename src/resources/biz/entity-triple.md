# Entity Triple Pattern

The entity triple is the standard pattern for database-portable entities in sirius-biz.
Every entity exists as three artifacts: an interface, a JDBC implementation, and a
MongoDB implementation. This lets application code program against the interface while
the framework routes persistence to whichever database is active.

## Step 1 — Interface (Base Package)

Define the interface in the main package (e.g., `sirius.biz.tenants`). It extends
`Entity` plus any mixins and declares `Mapping` constants and accessor methods:

```java
@SuppressWarnings("squid:S1214")
@Explain("We rather keep the constants here, as this emulates the behaviour and layout of a real entity.")
public interface Tenant<I extends Serializable>
        extends Entity, Transformable, Traced, Journaled, RateLimitedEntity, PerformanceFlagged {

    String PERMISSION_SYSTEM_TENANT = "flag-system-tenant";

    Mapping PARENT = Mapping.named("parent");
    Mapping TENANT_DATA = Mapping.named("tenantData");

    BaseEntityRef<I, ? extends Tenant<I>> getParent();
    TenantData getTenantData();
    boolean hasPermission(String permission);
}
```

Key rules:
- Use `@Explain` to justify constants in the interface (SonarQube rule S1214).
- Parameterize with `<I extends Serializable>` for the database ID type.
- Keep all field data in a `Composite` (e.g., `TenantData`) so that both
  implementations share the same field definitions.

## Step 2 — JDBC Implementation (`jdbc/` Subpackage)

Place the SQL entity in a `jdbc/` subpackage. It extends `BizEntity` (which gives
you `TraceData`) or `SQLTenantAware` (if tenant-scoped) and implements the interface:

```java
@Framework(SQLTenants.FRAMEWORK_TENANTS_JDBC)
@TranslationSource(Tenant.class)
public class SQLTenant extends BizEntity implements Tenant<Long> {

    @Autoloaded
    @AutoImport
    @NullAllowed
    private final SQLEntityRef<SQLTenant> parent =
            SQLEntityRef.on(SQLTenant.class, SQLEntityRef.OnDelete.SET_NULL);

    public static final Mapping TENANT_DATA = Mapping.named("tenantData");
    private final TenantData tenantData = new TenantData(this);

    private final SQLPerformanceData performanceData = new SQLPerformanceData(this);

    // ... implement interface methods
}
```

Key annotations:
- **`@Framework("biz.tenants-jdbc")`** — gates this entity behind a framework flag.
  Only loaded when `sirius.frameworks { biz.tenants-jdbc = true }` is set.
- **`@TranslationSource(Tenant.class)`** — tells the i18n system to look up property
  labels from the interface, not this class. Without this, you need duplicate `.properties`.
- Use `SQLEntityRef<T>` for references to other SQL entities.
- The ID type is `Long` (auto-increment).

## Step 3 — MongoDB Implementation (`mongo/` Subpackage)

Place the Mongo entity in a `mongo/` subpackage. It extends `MongoBizEntity` (which
gives `TraceData` and prefix search) or `MongoTenantAware` (if tenant-scoped):

```java
@Framework(MongoTenants.FRAMEWORK_TENANTS_MONGO)
@TranslationSource(Tenant.class)
public class MongoTenant extends MongoBizEntity implements Tenant<String> {

    @Autoloaded
    @NullAllowed
    private final MongoRef<MongoTenant> parent =
            MongoRef.on(MongoTenant.class, MongoRef.OnDelete.SET_NULL);

    public static final Mapping TENANT_DATA = Mapping.named("tenantData");
    private final TenantData tenantData = new TenantData(this);

    private final MongoPerformanceData performanceData = new MongoPerformanceData(this);

    // ... implement interface methods
}
```

Key differences from SQL:
- Use `MongoRef<T>` instead of `SQLEntityRef<T>`.
- The ID type is `String` (MongoDB ObjectId).
- `MongoBizEntity` extends `PrefixSearchableEntity` for built-in text search.

## Base Class Selection

| Scenario                        | JDBC Base Class    | Mongo Base Class     |
|---------------------------------|--------------------|----------------------|
| Standalone entity               | `BizEntity`        | `MongoBizEntity`     |
| Tenant-scoped entity            | `SQLTenantAware`   | `MongoTenantAware`   |
| No tracing needed (rare)        | `SQLEntity`        | `MongoEntity`        |

## @Framework vs @Register(framework = ...)

This distinction is critical and a frequent source of bugs:

- **`@Framework`** — used on **entity classes**. Controls whether the entity is
  registered in the schema and ORM. Without it, the entity loads unconditionally.
- **`@Register(framework = "...")`** — used on **services, controllers, and other
  components**. Controls whether the class participates in dependency injection.

```java
// Entity — use @Framework
@Framework("biz.tenants-jdbc")
public class SQLTenant extends BizEntity { ... }

// Service — use @Register(framework = ...)
@Register(classes = Processes.class, framework = "biz.processes")
public class Processes { ... }
```

## Common Mistakes

1. **Wrong base class** — Using `SQLEntity` instead of `BizEntity` loses `TraceData`.
   Using `BizEntity` for a tenant-scoped entity misses the automatic tenant reference.

2. **Missing `@Framework`** — The entity loads in all configurations and creates
   database tables even when the feature is disabled.

3. **Missing `@TranslationSource`** — Property labels defined for the interface
   (e.g., `Tenant.tenantData.name`) are not found by the SQL/Mongo implementation.
   You end up with raw property names in the UI.

4. **Forgetting the Composite** — Putting fields directly in both implementations
   instead of using a shared `Composite` leads to drift and duplication.

5. **ID type mismatch** — JDBC entities use `Long`, Mongo entities use `String`.
   The interface must be parameterized with `<I extends Serializable>` to abstract
   over this difference.
