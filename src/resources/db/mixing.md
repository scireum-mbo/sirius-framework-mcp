# Mixing ORM

Mixing is the core ORM (Object-Relational/Document Mapping) layer in sirius-db.
It provides a unified abstraction over SQL, MongoDB, and Elasticsearch, handling
entity discovery, schema management, property mapping, and validation.

## Overview

The Mixing system consists of three main components:

1. **`Mixing`** — The central registry. Discovers all entity classes at startup,
   creates their descriptors, and provides lookup by class or name.
2. **`EntityDescriptor`** — Describes a single entity type: its properties,
   lifecycle handlers, relation name, and validation rules.
3. **`Property`** — Maps a single Java field to a database column/field. Handles
   type conversion, validation, and access.

## Mixing — The Registry

`Mixing` is a singleton (`@Register`) that initializes at startup by:

1. Scanning for all `BaseEntity` subclasses (via `EntityLoadAction`)
2. Creating an `EntityDescriptor` for each
3. Linking cross-references between descriptors
4. Optionally executing schema updates

Inject it with `@Part`:

```java
@Part
private Mixing mixing;
```

Key methods:
- `mixing.getDescriptor(Class)` — returns the descriptor for an entity class
- `mixing.getDescriptor(String)` — returns the descriptor by type name
  (upper-cased simple class name, e.g., `"PRODUCT"`)
- `mixing.findDescriptor(Class)` — returns Optional (no exception if missing)
- `mixing.getDescriptors()` — returns all known descriptors

## EntityDescriptor

Each entity class has exactly one `EntityDescriptor`. It holds:

- **Properties** — the list of `Property` objects for each mapped field
- **Relation name** — the table/collection/index name in the database
- **Realm** — which database instance to use (via `@Realm` annotation)
- **Lifecycle handlers** — methods annotated with `@BeforeSave`, `@AfterSave`,
  `@BeforeDelete`, `@AfterDelete`, `@OnValidate`
- **Version flag** — whether optimistic locking is enabled (`@Versioned`)

```java
EntityDescriptor descriptor = mixing.getDescriptor(Product.class);
descriptor.getRelationName();    // e.g., "product"
descriptor.getRealm();           // e.g., "mixing" (default)
descriptor.getProperties();      // all Property objects
descriptor.isVersioned();        // true if @Versioned
```

Change detection is built into the descriptor:

```java
descriptor.isChanged(entity, property);  // checks if a field was modified
entity.isChanged(Product.NAME);          // convenience on the entity itself
entity.isAnyMappingChanged();            // any field changed at all
```

## Property Abstraction

A `Property` bridges a Java field and its database representation:

- `getName()` — the effective property name (prefixed for composites/mixins)
- `getPropertyName()` — the column/field name in the database
- `getValue(entity)` — reads the current value from the entity
- `setValue(entity, value)` — writes a value to the entity
- `getValueForDatasource(mapperClass, entity)` — converts the value for storage
- `parseValue(entity, Value)` — converts a raw value back into the Java type

Properties are created by `PropertyFactory` implementations. Each Java type
(String, int, LocalDateTime, EntityRef, Composite, etc.) has a corresponding
property factory that knows how to map it.

## Entity Discovery and @Framework

Entities are discovered by scanning for all concrete subclasses of `BaseEntity`.
To conditionally include an entity, use `@Framework`:

```java
@Framework("myapp.products")
public class Product extends SQLTenantAware { ... }
```

If the framework flag `myapp.products` is not enabled in `sirius.frameworks`,
the entity class is not loaded, its table is not created, and its descriptor
does not exist in the `Mixing` registry.

## Mapper Hierarchy

Each database backend has its own mapper that extends `BaseMapper`:

| Mapper | Entity Base | Query Type | ID Type |
|--------|-------------|------------|---------|
| `OMA` | `SQLEntity` | `SmartQuery` | `Long` |
| `Mango` | `MongoEntity` | `MongoQuery` | `String` |
| `Elastic` | `ElasticEntity` | `ElasticQuery` | `String` |

All mappers provide the same core operations: `find()`, `select()`, `update()`,
`delete()`, `tryUpdate()`, `tryDelete()`.

## Descriptor-Based Validation

Validation runs automatically before save via the descriptor. Sources of
validation rules include:

- **@Length** — property length check
- **@NullAllowed** — null check (fields are non-null by default)
- **@Unique** — uniqueness check via database query
- **@OnValidate** — custom validation methods on the entity or composite
- **@ValidatedBy** — external validator class
- **@BeforeSave** — pre-save hooks that can throw to abort

```java
@OnValidate
protected void validate(Consumer<String> validationConsumer) {
    if (Strings.isEmpty(getName())) {
        validationConsumer.accept("Name is required.");
    }
}
```

Validation messages collected by `@OnValidate` are warnings. To hard-fail,
throw an exception in a `@BeforeSave` handler instead.

## Schema Synchronization

Mixing can automatically update database schemas at startup. The behavior is
controlled by `mixing.autoUpdateSchema` in the config:

- `"safe"` — executes non-destructive changes (add columns, create tables)
- `"all"` — executes all changes including potentially destructive ones
- `"off"` — no automatic schema changes

## Mixins

Mixins add fields to existing entities without modifying them. A mixin targets
a specific entity type via `@Mixin`:

```java
@Mixin(Product.class)
public class ProductExtension extends Mixable {
    public static final Mapping EXTERNAL_ID = Mapping.named("externalId");
    @Length(100) @NullAllowed
    private String externalId;
}
```

This adds an `externalId` column to the `Product` table. Useful for extending
framework-provided entities from application code.

## Common Mistakes

1. **Querying before Mixing is ready** — At startup, `Mixing.initialize()` must
   complete before any database operations. In tests, await `oma.readyFuture`
   or `mango.readyFuture`.

2. **Using getDescriptor() for unregistered classes** — If the entity's framework
   flag is disabled, `getDescriptor()` throws. Use `findDescriptor()` when the
   entity may not exist.

3. **Confusing property name and field name** — A composite field `person` with
   a sub-field `firstname` produces property name `person_firstname`. The Java
   field name is just `firstname`.

4. **Ignoring the realm** — Entities default to the `"mixing"` realm. If your
   application uses multiple databases, annotate entities with `@Realm("other")`
   to direct them to the correct database.
