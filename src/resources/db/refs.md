# Entity References

Entity references model relationships between entities in sirius-db. Instead of
storing a raw foreign key, references are wrapped in typed ref objects that provide
lazy loading, delete behavior, and type safety.

## BaseEntityRef<I, E> — Common Interface

All reference types extend `BaseEntityRef<I, E>` (in `sirius.db.mixing.types`),
where `I` is the ID type and `E` is the entity type. It stores the referenced
entity's ID and lazily loads the full entity on demand.

Key methods on any ref:
- `getId()` — returns the stored ID (without loading the entity)
- `getValue()` — loads and returns the referenced entity (cached after first load)
- `getValueIfPresent()` — returns the entity only if already loaded
- `setId(I)` — sets the reference by ID
- `setValue(E)` — sets the reference by entity instance
- `isEmpty()` / `isFilled()` — checks whether the reference is set
- `is(E)` — checks if the ref points to the given entity
- `hasWriteOnceSemantics()` — whether the ref is immutable after first save

## OnDelete Behaviors

The `OnDelete` enum defines what happens when the referenced entity is deleted:

- `CASCADE` — the entity holding the reference is also deleted
- `SET_NULL` — the reference field is set to null
- `REJECT` — the delete is rejected (throws an exception)
- `IGNORE` — no action is taken; the reference may become dangling

## SQLEntityRef<E>

For SQL entities, use `SQLEntityRef<E>`. The ID type is `Long`.

```java
public class OrderItem extends SQLTenantAware {

    public static final Mapping ORDER = Mapping.named("order");
    private final SQLEntityRef<Order> order =
            SQLEntityRef.on(Order.class, BaseEntityRef.OnDelete.CASCADE);

    public static final Mapping PRODUCT = Mapping.named("product");
    private final SQLEntityRef<Product> product =
            SQLEntityRef.on(Product.class, BaseEntityRef.OnDelete.REJECT);

    // getters...
    public SQLEntityRef<Order> getOrder() { return order; }
    public SQLEntityRef<Product> getProduct() { return product; }
}
```

### on() vs writeOnceOn()

- `SQLEntityRef.on(Class, OnDelete)` — creates a **mutable** reference. The value
  can be changed at any time.
- `SQLEntityRef.writeOnceOn(Class, OnDelete)` — creates an **immutable** reference.
  The value can only be set when the entity is new. Any attempt to change it after
  the first save throws an exception.

Use `writeOnceOn` for structural relationships that must never change, like
"which tenant owns this record":

```java
private final SQLEntityRef<SQLTenant> tenant =
        SQLEntityRef.writeOnceOn(SQLTenant.class, BaseEntityRef.OnDelete.CASCADE);
```

### Weak References

SQL refs can be made "weak" to skip foreign key constraint creation in the database.
This improves write performance but means the database will not enforce referential
integrity:

```java
private final SQLEntityRef<AuditLog> lastAudit =
        SQLEntityRef.on(AuditLog.class, BaseEntityRef.OnDelete.IGNORE).weak();
```

## MongoRef<E>

For MongoDB entities, use `MongoRef<E>`. The ID type is `String`.

```java
public class MongoOrderItem extends MongoTenantAware {

    public static final Mapping ORDER = Mapping.named("order");
    private final MongoRef<MongoOrder> order =
            MongoRef.on(MongoOrder.class, BaseEntityRef.OnDelete.CASCADE);

    public static final Mapping PRODUCT = Mapping.named("product");
    private final MongoRef<MongoProduct> product =
            MongoRef.on(MongoProduct.class, BaseEntityRef.OnDelete.REJECT);

    // getters...
}
```

`MongoRef` also supports `writeOnceOn()` with the same semantics as `SQLEntityRef`.

## Querying by Reference

To filter by a reference field, pass the referenced entity or its ID:

```java
// By entity
oma.select(OrderItem.class)
   .eq(OrderItem.ORDER, order)
   .queryList();

// By ID
oma.select(OrderItem.class)
   .eq(OrderItem.ORDER, orderId)
   .queryList();
```

## Common Mistakes

1. **Using the wrong ref type** — `SQLEntityRef` is for `SQLEntity` subclasses;
   `MongoRef` is for `MongoEntity` subclasses. Mixing them causes startup errors.

2. **Forgetting OnDelete** — Always choose an explicit `OnDelete` behavior.
   `IGNORE` is rarely correct; it leaves dangling references. Prefer `CASCADE`
   for owned children and `REJECT` for required dependencies.

3. **Mutating a writeOnce ref** — Attempting to change a `writeOnceOn` reference
   after the entity has been persisted throws an exception. This is intentional;
   restructure your logic if you need to change the relationship.

4. **Not declaring refs as final** — Reference fields should be `final`. The
   framework mutates the ref's internal state (ID, cached value) but the ref
   object itself must not be replaced.

5. **Calling getValue() in loops** — Each `getValue()` call may trigger a database
   query. In loops, use batch loading or pre-fetch the related entities.
