# Composites

A `Composite` is a reusable group of fields that can be embedded into any entity
or other composite. It lives in `sirius.db.mixing.Composite` and extends `Mixable`,
meaning it can itself be extended via mixins.

## How Composites Work

When a composite is declared as a field in an entity, all of the composite's fields
become properties of the entity. The field name of the composite is **prepended**
to each property name, separated by `_`:

```java
public class Customer extends SQLTenantAware {
    private final PersonData person = new PersonData();
    // Creates columns: person_title, person_firstname, person_lastname, etc.
}
```

This prefixing means the same composite class can appear multiple times in one entity
under different field names without column conflicts:

```java
public class Order extends SQLTenantAware {
    private final AddressData billingAddress = new AddressData();
    private final AddressData shippingAddress = new AddressData();
    // billingAddress_street, billingAddress_city, ...
    // shippingAddress_street, shippingAddress_city, ...
}
```

## Mapping Constants

Every composite field should declare a `Mapping` constant to enable type-safe
references in queries and templates:

```java
public class PersonData extends Composite {

    public static final Mapping FIRSTNAME = Mapping.named("firstname");
    @Length(150)
    @Trim
    @Autoloaded
    @NullAllowed
    @AutoImport
    private String firstname;

    public static final Mapping LASTNAME = Mapping.named("lastname");
    @Length(150)
    @Trim
    @Autoloaded
    @NullAllowed
    @AutoImport
    private String lastname;

    // getters/setters...
}
```

## Accessing Nested Fields with Mapping.inner()

When querying or referencing a composite field from the entity level, use
`Mapping.inner()` to build the prefixed path:

```java
// In a query on the Customer entity:
oma.select(Customer.class)
   .eq(Customer.PERSON.inner(PersonData.LASTNAME), "Smith")
   .queryList();
```

This resolves to the column `person_lastname` in the database.

## Standard Annotations

These annotations can be placed on fields in composites (and entities):

- `@Length(n)` — Maximum column/field length (required for strings).
- `@Trim` — Automatically trims whitespace on load/save.
- `@NullAllowed` — Permits null values. Without this, nulls cause validation errors.
- `@Unique` — Enforces uniqueness. Supports `within` parameter for scoped uniqueness.
- `@Transient` — Excludes the field from persistence entirely.
- `@Autoloaded` — Auto-populates the field from web request parameters.
- `@AutoImport` — Auto-populates the field during data import.

## Lifecycle Annotations

These method-level annotations on the containing entity (or composite) hook into
the persistence lifecycle:

- `@BeforeSave` — Called before the entity is written to the database. Use for
  computed fields, normalization, or throwing exceptions to abort the save.
- `@OnValidate` — Called during validation. The annotated method receives a
  `Consumer<String>` to collect warning messages without aborting.
- `@ValidatedBy(ValidatorClass.class)` — Delegates field validation to an external
  validator class.

```java
public class InvoiceData extends Composite {

    public static final Mapping INVOICE_NUMBER = Mapping.named("invoiceNumber");
    @Length(50)
    @NullAllowed
    private String invoiceNumber;

    @BeforeSave
    protected void generateInvoiceNumber() {
        if (Strings.isEmpty(invoiceNumber)) {
            invoiceNumber = sequences.generateId("invoices");
        }
    }

    @OnValidate
    protected void validate(Consumer<String> validationConsumer) {
        if (Strings.isEmpty(invoiceNumber)) {
            validationConsumer.accept("Invoice number is required.");
        }
    }
}
```

## PersonData — Standard Example

`PersonData` in `sirius.biz.model` is the canonical composite example. It stores
title, salutation, firstname, and lastname. It provides helper methods like
`getAddressableName()` and `getShortName()`, and validation helpers
(`verifySalutation()`, `validateSalutation()`) that the containing entity can
call from its own `@BeforeSave` or `@OnValidate` methods.

## Common Mistakes

1. **Forgetting the prefix in queries** — A field `firstname` inside a composite
   field `person` becomes `person_firstname` in the database. Always use
   `Mapping.inner()` to construct the correct path.

2. **Not declaring Mapping constants** — Without `Mapping.named()` constants,
   queries require raw strings, which are error-prone and not refactoring-safe.

3. **Mutable composite instances** — Composite fields should be declared `final`
   in the entity. The composite object is created once and its internal fields are
   mutated, but the composite reference itself should not change.

4. **Missing @NullAllowed** — String fields default to non-null. If a field
   legitimately can be empty, annotate it with `@NullAllowed` or provide a
   `@DefaultValue`.
