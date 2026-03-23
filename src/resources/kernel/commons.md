# Commons Utilities

Sirius-kernel provides a set of utility classes in `sirius.kernel.commons` for
everyday programming tasks: internationalization, string handling, type-safe
value wrapping, and decimal arithmetic.

## NLS — Internationalization

`NLS` (Native Language Support) is the central class for i18n. Translations
are stored in `.properties` files and accessed via keys.

### Simple Lookup

```java
// Looks up key "MyEntity.name" in the current language
String label = NLS.get("MyEntity.name");
```

### Formatted Messages

`NLS.fmtr()` provides named-parameter formatting:

```java
// Given property: "welcome = Welcome, {{name}}! You have {{count}} items."
String msg = NLS.fmtr("welcome")
    .set("name", userName)
    .set("count", itemCount)
    .format();
```

The `{{param}}` syntax is Sirius-specific — it uses named parameters rather
than positional ones, making translations much easier to maintain.

### Smart Formatting

`NLS.toUserString(Object)` converts any value to a locale-appropriate string:
- Numbers are formatted with locale-specific grouping and decimals.
- Dates/times use the locale's standard format.
- `Amount` values respect precision and locale.

### Property Files

Translation files follow the pattern `basename_lang.properties`:
- `biz_en.properties` — English
- `biz_de.properties` — German

They are loaded from the classpath under `resources/`.

## Strings

`Strings` provides null-safe string operations:

```java
// Null-safe emptiness checks
Strings.isEmpty(null);     // true
Strings.isEmpty("");       // true
Strings.isEmpty("  ");    // true (trims first)
Strings.isFilled(value);  // opposite of isEmpty

// Null-safe equality
Strings.areEqual(a, b);           // null == null is true
Strings.equalIgnoreCase(a, b);

// Join with separator, skipping empty values
Strings.join(", ", firstName, lastName);  // Skips nulls/empty

// Apply a string operation only if filled
Strings.apply("%s (%s)", name, code);  // Returns "" if name is empty
```

### Strings.join

A commonly used pattern for building display strings:

```java
// Produces "John, Doe" — skips empty parts
String fullName = Strings.join(" ", title, firstName, lastName);
```

## Value

`Value` is a type-safe wrapper around an arbitrary object, providing fluent
conversion and null-safe access:

```java
Value val = Value.of(someObject);

// Type conversions with defaults
String s   = val.asString();           // "" if null
int n      = val.asInt(0);             // 0 if not convertible
boolean b  = val.asBoolean();          // false if null
LocalDate d = val.asLocalDate(fallback);

// Check state
val.isNull();
val.isFilled();
val.isEmpty();

// Conditional execution
val.ifFilled(v -> process(v));
```

`Value` is used extensively in the web layer for request parameters and in the
import framework for cell values.

## Amount

`Amount` provides precise decimal arithmetic, replacing `BigDecimal` with a
more ergonomic API. It is the standard type for monetary values and quantities.

```java
Amount price = Amount.of(19.99);
Amount quantity = Amount.of(3);

// Arithmetic
Amount total = price.times(quantity);       // 59.97
Amount discounted = total.subtract(Amount.of(5));

// Rounding
Amount rounded = total.round(RoundingMode.HALF_UP, 2);

// Comparison
total.isGreaterThan(Amount.of(50));  // true
total.isZeroOrNull();                // false

// Safe null handling — Amount.NOTHING represents "no value"
Amount.NOTHING.add(Amount.of(10));   // Amount.of(10)
```

### Amount vs BigDecimal

`Amount` wraps `BigDecimal` but adds:
- Null safety via `Amount.NOTHING` (acts as identity in arithmetic).
- Fluent API: `a.add(b).times(c)` reads naturally.
- Built-in formatting: `amount.toSmartRoundedString()`.

## Formatter (Strings.apply)

`Strings.apply()` provides printf-like formatting but with Sirius conventions:

```java
Strings.apply("User %s logged in from %s", username, ip);
```

For more complex cases, use `NLS.fmtr()` with named parameters.

## @Explain Annotation

`@Explain` is a documentation annotation used to justify code decisions that
might otherwise trigger review comments or static analysis warnings:

```java
@Explain("We use a constant here because the interface pattern is intentional")
public interface Permissions {
    String PERMISSION_MANAGE_USERS = "permission-manage-users";
}
```

It has no runtime effect — it serves purely as inline documentation for
reviewers and maintainers. Common uses:
- Constants in interfaces (a Sirius convention).
- Intentional fallthrough in switch statements.
- Suppressed warnings that need justification.

## Tuple and MultiLanguageString

### Tuple

A simple pair container:

```java
Tuple<String, Integer> pair = Tuple.create("key", 42);
pair.getFirst();   // "key"
pair.getSecond();  // 42
```

### MultiLanguageString

Stores text in multiple languages:

```java
MultiLanguageString mls = new MultiLanguageString();
mls.addText("en", "Hello");
mls.addText("de", "Hallo");

// Gets text for current language, falls back to default
String text = mls.getText();
```

Used in entities that need multi-language content (product names, descriptions).

## Best Practices

1. **Use `Strings.isFilled()`** instead of `str != null && !str.isEmpty()`.

2. **Use `Amount`** for all monetary and quantity values — never `double`.

3. **Use `NLS.fmtr()`** with named parameters for user-facing messages. Positional
   parameters break when translations reorder words.

4. **Use `Value`** when dealing with loosely typed data (web params, imports).

5. **Use `@Explain`** to document non-obvious code choices proactively.
