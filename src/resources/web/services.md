# Web Services (API Endpoints)

Sirius-web provides annotations to mark controller methods as structured API
endpoints that automatically handle envelope wrapping and error formatting.
These live in `sirius.web.services`.

## @PublicService — External API

`@PublicService` marks a routed method as part of the public API. These services
are listed in the built-in API explorer (`/system/api`):

```java
@Routed("/api/v1/products")
@PublicService(apiName = "products", format = Format.JSON)
@LoginRequired
public void listProducts(WebContext webContext, JSONStructuredOutput out) {
    out.beginArray("products");
    oma.select(Product.class).iterateAll(product -> {
        out.beginObject("product");
        out.property("id", product.getIdAsString());
        out.property("name", product.getName());
        out.endObject();
    });
    out.endArray();
}
```

**Parameters:**
- `apiName` — Groups the service in the API explorer. Each API name needs a
  matching config block under `http.api`.
- `format` — One of `Format.JSON`, `Format.XML`, or `Format.RAW`.
- `priority` — Sort order in the API explorer (default: 100).
- `path` — Custom documentation path, useful when the `@Routed` pattern contains
  parameter placeholders (e.g., turning `/ps/:1/api` into `/ps/{process}/api`).
- `documentationUri` — Optional link to external documentation.
- `enforceMaintenanceMode` — If `true`, blocks calls when the scope is locked.

When `format` is `JSON`, the method must accept `JSONStructuredOutput` as its
second parameter. When `XML`, it must accept `XMLStructuredOutput`.

## @InternalService — Internal API

`@InternalService` works identically to `@PublicService` but is not listed in the
public API explorer. Use it for endpoints consumed only by internal systems:

```java
@Routed("/api/internal/sync")
@InternalService(format = Format.JSON)
public void sync(WebContext webContext, JSONStructuredOutput out) {
    out.property("status", "ok");
}
```

The only parameter is `format` (defaults to `Format.JSON`).

## Automatic Envelope Wrapping

For both annotations, the framework automatically:

1. Calls `beginResult()` before your method
2. Calls `endResult()` after your method
3. Sets `success: true` on normal completion

**Successful JSON response:**
```json
{
    "success": true,
    "error": false,
    "products": [ ... ]
}
```

**Error JSON response (on exception):**
```json
{
    "success": false,
    "error": true,
    "message": "The product was not found.",
    "code": "PRODUCT_NOT_FOUND"
}
```

The error code and HTTP status can be set via exception hints:

```java
throw Exceptions.createHandled()
                .withDirectMessage("The product was not found.")
                .hint(Controller.ERROR_CODE, "PRODUCT_NOT_FOUND")
                .hint(Controller.HTTP_STATUS, 404)
                .handle();
```

For `Format.RAW`, error responses simply return the appropriate HTTP status code
without a structured body.

## Format.RAW

Use `Format.RAW` when the method produces a non-structured response (e.g., a file
download or plain text). The method does not receive a structured output parameter
and handles the response directly via `WebContext`:

```java
@Routed("/api/v1/export")
@PublicService(apiName = "export", format = Format.RAW)
public void export(WebContext webContext) {
    webContext.respondWith().direct(HttpResponseStatus.OK, "text/csv", csvData);
}
```

## Swagger / OpenAPI Parameter Documentation

Service parameters should be documented with `@io.swagger.v3.oas.annotations.Parameter`
on each accepted query or form parameter. The API explorer picks these up:

```java
@Routed("/api/v1/products")
@PublicService(apiName = "products", format = Format.JSON)
@io.swagger.v3.oas.annotations.Parameter(name = "query", description = "Search filter")
@io.swagger.v3.oas.annotations.Parameter(name = "limit", description = "Max results")
public void listProducts(WebContext webContext, JSONStructuredOutput out) { ... }
```

## Common Mistakes

1. **Wrong second parameter type** — `Format.JSON` requires `JSONStructuredOutput`;
   `Format.XML` requires `XMLStructuredOutput`. Mismatching causes a startup error.

2. **Calling beginResult/endResult manually** — The framework handles this
   automatically. Calling it again produces malformed output.

3. **Forgetting the apiName config** — Every `apiName` used in `@PublicService`
   needs a corresponding `http.api.<apiName>` block in the config, or the API
   explorer will not display the service correctly.

4. **Using @Routed(jsonCall = true)** — This is deprecated since 2021. Use
   `@InternalService(format = Format.JSON)` instead.
