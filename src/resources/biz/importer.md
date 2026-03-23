# Importer Framework

The import framework provides a structured way to import data into entities from
external sources (CSV, Excel, XML, JSON). It handles field mapping, entity lookup,
create-or-update logic, batch operations, and extensibility through events.

## Import Handler Hierarchy

Every entity type that can be imported needs an `ImportHandler`. The hierarchy:

- `BaseImportHandler<E>` — abstract base with convenience methods
  - `SQLEntityImportHandler<E>` — for JDBC/SQL entities, uses batch queries
  - `MongoEntityImportHandler<E>` — for MongoDB entities

Create a handler by extending the appropriate base class:

```java
@Register(classes = ImportHandler.class, framework = "biz.tenants-jdbc")
public class SQLTenantImportHandler extends SQLEntityImportHandler<SQLTenant> {

    @Override
    protected Class<SQLTenant> getType() {
        return SQLTenant.class;
    }

    @Override
    protected void collectFindQueries(
            Consumer<Tuple<Predicate<SQLTenant>, Supplier<FindQuery<SQLTenant>>>> queryConsumer) {
        queryConsumer.accept(Tuple.create(
                tenant -> Strings.isFilled(tenant.getTenantData().getAccountNumber()),
                () -> insertQuery.newFindQuery()
                        .where(SQLTenant.TENANT_DATA.inner(TenantData.ACCOUNT_NUMBER))
        ));
    }
}
```

## @AutoImport Annotation

Mark entity fields with `@AutoImport` to include them in automatic import mapping.
When `BaseImportHandler.getAutoImportMappings()` is called, all `@AutoImport` fields
are collected and can be mapped from import columns:

```java
@AutoImport
@Length(150)
@Trim
private String name;

@AutoImport
@NullAllowed
private String accountNumber;
```

This works together with the `ImportDictionary` which maps column headers to entity
properties.

## Event System

The importer fires events at each stage of the import lifecycle. Register handlers
to customize behavior:

| Event                       | When Fired                                    |
|-----------------------------|-----------------------------------------------|
| `BeforeLoadEvent`           | Before populating entity fields from input    |
| `AfterLoadEvent`            | After populating fields, before find/match    |
| `BeforeFindEvent`           | Before attempting to find an existing entity  |
| `BeforeCreateOrUpdateEvent` | Before persisting (create or update)          |
| `AfterCreateOrUpdateEvent`  | After entity is persisted                     |
| `BeforeDeleteEvent`         | Before deleting an entity                     |

Events are dispatched to `EntityImportHandlerExtender` implementations, which are
collected via `@Parts(EntityImportHandlerExtender.class)` and can hook into any
stage of the import lifecycle.

## Find Queries — Matching Existing Records

`collectFindQueries()` defines how the importer matches incoming data to existing
entities. Each query is a pair of (predicate, query supplier):

```java
@Override
protected void collectFindQueries(
        Consumer<Tuple<Predicate<SQLProduct>, Supplier<FindQuery<SQLProduct>>>> queryConsumer) {
    // Match by SKU if present
    queryConsumer.accept(Tuple.create(
            product -> Strings.isFilled(product.getSku()),
            () -> insertQuery.newFindQuery().where(SQLProduct.SKU)
    ));
    // Fallback: match by name + tenant
    queryConsumer.accept(Tuple.create(
            product -> Strings.isFilled(product.getName()),
            () -> insertQuery.newFindQuery()
                    .where(SQLProduct.NAME)
                    .where(SQLProduct.TENANT)
    ));
}
```

The predicate determines if the query applies (e.g., only if SKU is filled).
Queries are tried in order; the first match wins.

## JDBC Batch Operations

`SQLEntityImportHandler` uses JDBC batch queries for performance:

- **`InsertQuery<E>`** — batched INSERT statements
- **`UpdateQuery<E>`** — batched UPDATE statements
- **`DeleteQuery<E>`** — batched DELETE statements
- **`FindQuery<E>`** — SELECT for matching existing records

These are created lazily and reused across the import run. The batch context
flushes automatically at configurable intervals.

```java
protected UpdateQuery<E> updateQuery;
protected InsertQuery<E> insertQuery;
protected DeleteQuery<E> deleteQuery;
```

## Importer — The Entry Point

The `Importer` class orchestrates the full import:

```java
Importer importer = new Importer("product-import");
try {
    SQLTenantImportHandler handler = importer.findHandler(SQLProduct.class);
    for (Context row : rows) {
        handler.tryCreateOrUpdate(row);
    }
} finally {
    importer.close();  // flushes batches, fires completion events
}
```

## Common Mistakes

1. **Forgetting `collectFindQueries()`** — Without find queries, the importer
   always creates new entities instead of updating existing ones.

2. **Not closing the Importer** — Always close in a `finally` block or
   try-with-resources. Unclosed importers leave batch queries unflushed.

3. **Modifying entity state in the wrong event** — Use `BeforeCreateOrUpdateEvent`
   for validation/enrichment. Using `AfterLoadEvent` may be too early since the
   entity has not been matched to an existing record yet.

4. **Missing `@AutoImport` on fields** — Fields without `@AutoImport` are invisible
   to the automatic import mapping and must be handled manually.

5. **Not handling `MissingEntityMode`** — Decide what to do when a referenced entity
   (e.g., a foreign key) is not found: skip, create, or fail.
