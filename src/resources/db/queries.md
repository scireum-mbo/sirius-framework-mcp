# Queries

Sirius-db provides a consistent query builder pattern across all three database
backends. Each mapper has its own `select()` method that returns a typed query
object, but the API surface is deliberately similar.

## OMA — JDBC Queries (SmartQuery)

`OMA` is the mapper for `SQLEntity`. Inject it with `@Part`:

```java
@Part
private OMA oma;
```

**Select (query builder):**
```java
SmartQuery<Product> query = oma.select(Product.class)
                               .eq(Product.CATEGORY, "electronics")
                               .orderAsc(Product.NAME)
                               .limit(50);

List<Product> products = query.queryList();
```

**Find by ID:**
```java
Optional<Product> product = oma.find(Product.class, productId);
```

**Count:**
```java
long count = oma.select(Product.class)
                .eq(Product.ACTIVE, true)
                .count();
```

**Exists check:**
```java
boolean exists = oma.select(Product.class)
                    .eq(Product.SKU, sku)
                    .exists();
```

**Iteration (streaming):**
```java
oma.select(Product.class)
   .eq(Product.ACTIVE, true)
   .iterateAll(product -> {
       // process each product
   });
```

**Update and delete:**
```java
oma.update(product);
oma.delete(product);
oma.forceDelete(product);  // bypasses REJECT constraints
```

## Mango — MongoDB Queries (MongoQuery)

`Mango` is the mapper for `MongoEntity`:

```java
@Part
private Mango mango;
```

**Select:**
```java
MongoQuery<MongoProduct> query = mango.select(MongoProduct.class)
                                      .eq(MongoProduct.CATEGORY, "electronics")
                                      .orderAsc(MongoProduct.NAME)
                                      .limit(50);

List<MongoProduct> products = query.queryList();
```

**Find by ID:**
```java
Optional<MongoProduct> product = mango.find(MongoProduct.class, productId);
```

The query API mirrors OMA: `count()`, `exists()`, `iterateAll()`, `queryList()`,
`queryFirst()`, `delete()`, and `update()` all work the same way.

## Elastic — Elasticsearch Queries (ElasticQuery)

`Elastic` is the mapper for `ElasticEntity`:

```java
@Part
private Elastic elastic;
```

**Select:**
```java
ElasticQuery<EventLog> query = elastic.select(EventLog.class)
                                      .eq(EventLog.EVENT_TYPE, "login")
                                      .orderDesc(EventLog.TIMESTAMP)
                                      .limit(100);

List<EventLog> events = query.queryList();
```

**Find by ID:**
```java
Optional<EventLog> event = elastic.find(EventLog.class, eventId);
```

Elastic queries also support full-text search and aggregations, but the basic
filter/sort/limit API is the same as OMA and Mango.

## Common Query Methods

All three query types share these methods from the `Query` base class:

| Method | Description |
|--------|-------------|
| `eq(Mapping, value)` | Equals filter |
| `ne(Mapping, value)` | Not-equals filter |
| `gt(Mapping, value)` | Greater than |
| `gte(Mapping, value)` | Greater than or equal |
| `lt(Mapping, value)` | Less than |
| `lte(Mapping, value)` | Less than or equal |
| `orderAsc(Mapping)` | Sort ascending |
| `orderDesc(Mapping)` | Sort descending |
| `limit(int)` | Maximum results |
| `skip(int)` | Skip n results |
| `queryList()` | Return all matching as list |
| `queryFirst()` | Return first match as Optional |
| `count()` | Return count of matches |
| `exists()` | Return true if any match exists |
| `iterateAll(Consumer)` | Stream all matches through a consumer |
| `delete()` | Delete all matching entities |

## Filter Factories

Each mapper provides a `FILTERS` factory for complex constraints:

```java
oma.select(Product.class)
   .where(OMA.FILTERS.or(
       OMA.FILTERS.eq(Product.CATEGORY, "electronics"),
       OMA.FILTERS.eq(Product.CATEGORY, "appliances")
   ))
   .queryList();
```

Mango and Elastic have equivalent `FILTERS` factories with the same API.

## Querying Composite Fields

Use `Mapping.inner()` to query fields inside composites:

```java
oma.select(Customer.class)
   .eq(Customer.PERSON.inner(PersonData.LASTNAME), "Smith")
   .queryList();
```

## Common Mistakes

1. **Calling queryList() on unbounded queries** — Always set a `limit()` or use
   `iterateAll()` for large result sets. An unbounded `queryList()` loads
   everything into memory.

2. **Using raw strings instead of Mapping constants** — Always use `Mapping.named()`
   constants. Raw strings bypass compile-time safety and break on refactoring.

3. **Mixing mapper types** — Use `oma` for `SQLEntity`, `mango` for `MongoEntity`,
   and `elastic` for `ElasticEntity`. Each entity class is bound to exactly one
   mapper.

4. **Ignoring iterateAll cancellation** — `iterateAll()` respects `TaskContext`
   cancellation. Long-running iterations should check `TaskContext.get().isActive()`
   or will be automatically stopped when the task is cancelled.
