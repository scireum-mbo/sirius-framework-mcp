# Dependency Injection

Sirius uses its own lightweight DI system built into sirius-kernel. All injection
happens at startup time — there is no runtime resolution or request-scoped injection.

## @Register — Publishing a Service

Every class that should participate in DI must be annotated with `@Register`:

```java
@Register(classes = {MyService.class, Startable.class})
public class MyServiceImpl implements MyService, Startable {
    // ...
}
```

**Critical rule:** The `classes` parameter must list **every interface and superclass**
the component should be discoverable as. If you implement `Startable` but omit it
from `classes`, the framework will never call `started()`.

Parameters:
- `classes` — Array of types this component registers as (required when implementing interfaces).
- `framework` — The framework flag that must be enabled for this component to load
  (e.g., `@Register(framework = "biz.tenants")`).
- `name` — Optional name for named lookups.

If a class has no interfaces and no special lifecycle, a bare `@Register` suffices.

## @Framework — For Entities

Entities (database-mapped classes) use `@Framework` instead of `@Register(framework = ...)`:

```java
@Framework("biz.tenants-jdbc")
public class SQLTenant extends SQLTenantAware<SQLTenant, SQLUserAccount>
        implements Tenant<Long> {
}
```

The distinction: `@Register(framework = ...)` controls service loading;
`@Framework` controls entity registration in the schema and ORM layer.

## @Part — Injecting a Singleton

`@Part` injects a single implementation of a type:

```java
@Part
private OMA oma;

@Part
private Tasks tasks;
```

The field is populated after the object is constructed, before `started()` is called.

If no implementation is registered, the field remains `null` — no error is thrown.
Guard against this in optional dependencies.

### configPath

For interfaces with multiple named implementations, use `configPath`:

```java
@Part(configPath = "storage.layer1.engine")
private ObjectStorageEngine engine;
```

This reads the implementation class name from the config file, allowing runtime
selection of the concrete implementation.

## @Parts — Injecting All Implementations

`@Parts` injects every registered implementation of a given interface as a
`PartCollection`:

```java
@Parts(SidebarProvider.class)
private PartCollection<SidebarProvider> providers;
```

`PartCollection` is iterable and provides `getAll()` returning a list. The
implementations are returned in no guaranteed order.

## @PriorityParts — Ordered Injection

Like `@Parts`, but returns implementations sorted by their `Priorized.getPriority()`
value (lower values first):

```java
@PriorityParts(LinkTarget.class)
private List<LinkTarget> targets;
```

Use this when execution order matters — e.g., filter chains, interceptors, or
fallback strategies.

## @ConfigValue — Injecting Configuration

`@ConfigValue` injects values from the Typesafe Config system:

```java
@ConfigValue("product.baseUrl")
private String baseUrl;

@ConfigValue("http.sessionTimeout")
private Duration sessionTimeout;

@ConfigValue("security.enabled")
private boolean securityEnabled;

@ConfigValue("cache.maxSize")
private int maxSize;

@ConfigValue("allowed.hosts")
private List<String> allowedHosts;
```

Supported types: `String`, `int`, `long`, `boolean`, `Duration`, `List<String>`.
The config path refers to a key in the HOCON configuration (see config resource).

## Common Mistakes

1. **Missing `classes` in @Register** — The most frequent DI bug. If your class
   implements `Startable` or `Initializable` and you write `@Register` without
   listing those interfaces in `classes`, the lifecycle methods will never be called.

2. **Circular dependencies** — Sirius does not support circular `@Part` injection.
   Use `Injector.context().findPart(...)` for lazy resolution when needed.

3. **Using DI in constructors** — `@Part` fields are not yet populated during
   construction. Use `Startable.started()` or `Initializable.initialize()` for
   init logic that depends on injected parts.

4. **Forgetting the framework flag** — If your service only makes sense when a
   specific framework is active, always set `@Register(framework = "...")`.
   Otherwise the class loads unconditionally and may fail if its dependencies
   are not present.
