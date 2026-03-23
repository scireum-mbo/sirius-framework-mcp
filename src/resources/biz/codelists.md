# Code Lists and Lookup Tables

Code lists and lookup tables provide managed enumerations for master data. They map
codes to human-readable names and additional metadata, with support for
internationalization and multiple data sources.

## CodeList — The Classic Approach

`CodeList` is the original database-backed enumeration. It follows the entity triple
pattern with `CodeListData` as the shared composite:

```java
public interface CodeList extends TenantAware, Traced {
    Mapping CODE_LIST_DATA = Mapping.named("codeListData");
    CodeListData getCodeListData();
}
```

Implementations: `SQLCodeList` (JDBC) and `MongoCodeList` (MongoDB). Each code list
belongs to a tenant and contains `CodeListEntry` items (code + value + description).

### CodeLists Service

```java
@Part
private CodeLists codeLists;

// Look up a value
String countryName = codeLists.getValue("countries", "DE").orElse("Unknown");

// Check if a code exists
boolean valid = codeLists.hasValue("countries", "DE");
```

## LookupTable — The Modern Approach

`LookupTable` is an abstraction layer over multiple data sources. A lookup table can
be backed by:

- **CodeList** — tenant-specific data from the database (`CodeListLookupTable`)
- **Jupiter IDB tables** — high-performance Redis-like key-value store (`IDBLookupTable`)
- **Config files** — static data from HOCON configuration (`ConfigLookupTable`)
- **Custom implementations** — via `CustomLookupTable`

The data source is selected via configuration:

```hocon
lookup-tables {
    countries {
        type = "code-list"    # or "idb", "config", "custom"
        codeList = "countries"
    }
    currencies {
        type = "idb"
        table = "currencies"
    }
}
```

### Key Operations

```java
@Part
private LookupTables lookupTables;

LookupTable table = lookupTables.fetchTable("countries");

// Normalize a code (resolve aliases)
Optional<String> code = table.normalize("DEU");  // -> "DE"

// Resolve a display name
Optional<String> name = table.resolveName("DE");  // -> "Germany"

// Fetch additional fields
Optional<String> iso3 = table.fetchField("DE", "iso3");

// Search/suggest
List<LookupTableEntry> matches = table.suggest("Germ", new Limit(0, 10));
```

## LookupValue — Entity Field Type

`LookupValue` is a field type for embedding a lookup table reference directly in
an entity. It replaces raw string fields with a typed, validated reference:

```java
private final LookupValue salutation = new LookupValue(
        "salutations",                        // lookup table name
        LookupValue.Display.NAME,             // show name in UI
        LookupValue.Display.CODE_AND_NAME,    // extended display
        LookupValue.Export.CODE,              // export the code
        LookupValue.CustomValues.REJECT       // reject unknown values
);
```

### Display and Export Modes

**Display** controls what users see in the UI:
- `Display.CODE` — show the raw code (e.g., "DE")
- `Display.NAME` — show the resolved name (e.g., "Germany")
- `Display.CODE_AND_NAME` — show both (e.g., "Germany (DE)")

**Export** controls what appears in CSV/Excel exports:
- `Export.CODE` — export the raw code
- `Export.NAME` — export the resolved name

**CustomValues** controls validation:
- `CustomValues.ACCEPT` — allow values not in the lookup table
- `CustomValues.REJECT` — reject unknown values with a validation error

The framework uses `LookupValue` internally, e.g., `PersonData.salutation` is a
`LookupValue` backed by the `"salutations"` table.

## LookupValues — Multi-Value Field

`LookupValues` stores multiple codes from the same lookup table as a list:

```java
private final LookupValues tags = new LookupValues("product-tags");
```

## CustomLookupTable

For data sources that do not fit the built-in types, implement `CustomLookupTable`:

```java
@Register
public class MyCustomTable extends CustomLookupTable {
    @Override
    public String getName() { return "my-table"; }

    @Override
    public Optional<String> normalize(String code) { ... }

    @Override
    public Optional<String> resolveName(String code, String language) { ... }
}
```

## Common Mistakes

1. **Using raw strings instead of `LookupValue`** — Storing a code as a plain
   `String` field loses validation, display formatting, and autocomplete support.

2. **Wrong `CustomValues` mode** — Using `REJECT` on a table where users need to
   enter free-form values causes validation failures. Use `ACCEPT` when the table
   is advisory rather than authoritative.

3. **Confusing CodeList and LookupTable** — `CodeList` is the raw database entity.
   `LookupTable` is the abstraction layer. Always program against `LookupTable`
   unless you need direct CRUD on the code list entries.

4. **Missing lookup table configuration** — A `LookupValue` referencing a table
   name that has no configuration in `lookup-tables { }` will fail at runtime.
