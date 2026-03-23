# Controllers

Controllers in sirius-web handle HTTP requests by mapping URI patterns to methods.
They live in `sirius.web.controller` (base framework) and `sirius.biz.web` (business layer).

## BasicController — The Base Class

All controllers extend `BasicController`, which provides:

- `getUser()` — returns the current `UserInfo`
- `hasPermission(String)` — checks if the current user holds a permission
- `assertPermission(String)` — throws if the permission is missing
- `assertNotNull(Object)` — throws a 404-style error if the object is null
- `showSavedMessage()` — flashes a "Changes have been saved" message
- `showDeletedMessage()` — flashes a "Object was deleted" message
- `fail(WebContext, HandledException)` — renders an error template

In sirius-biz, controllers typically extend `BizController` which adds tenant-aware
helpers like `findForTenant()` and `assertTenant()`.

## @Routed — Mapping URIs to Methods

`@Routed` attaches a URI pattern to a controller method:

```java
@Routed("/products/:1/edit")
public void editProduct(WebContext webContext, String productId) {
    // :1 binds the path segment to the first String parameter after WebContext
}
```

**Pattern elements:**
- String literal (`/products`) — must match exactly
- `:1`, `:2`, ... — captures the path segment into the n-th method parameter (after WebContext)
- `*` — matches any single path segment (value is discarded)
- `**` — variadic, must be last; matched segments go into a `List<String>` parameter
- `#{name}` — captures the segment into a request attribute
- `${i18n.key}` — matches the NLS-translated value of the key

**Priority:** When routes conflict (e.g., `/foo/:1` vs `/foo/special`), set
`priority` on the more specific route to a value below `PriorityCollector.DEFAULT_PRIORITY`:

```java
@Routed(value = "/foo/special", priority = 90)
```

**HTTP methods:** By default all methods are accepted. Restrict with:

```java
@Routed(value = "/api/items", methods = HttpMethod.POST)
```

## @LoginRequired and @Permission

Place these on routed methods to enforce access control:

```java
@Routed("/admin/users")
@LoginRequired
@Permission("permission-manage-users")
public void users(WebContext webContext) { ... }
```

`@LoginRequired` requires any authenticated user. `@Permission("name")` requires
the named permission. Both can be combined; the login check runs first.

## @DefaultRoute — Fallback on Error

Mark one routed method per controller with `@DefaultRoute`. If any other route in
the same controller throws an error, the framework re-dispatches to the default
route and displays the error message there, rather than showing a generic error page:

```java
@Routed("/products")
@DefaultRoute
public void products(WebContext webContext) {
    // This serves as the fallback — e.g., list view
}
```

## WebContext — The Request Object

Every routed method receives a `WebContext` as its first parameter. Key methods:

- `webContext.get("paramName")` — returns a `Value` for a query/form parameter
- `webContext.isSafePOST()` — true if POST with a valid CSRF token
- `webContext.ensureSafePOST()` — like `isSafePOST()` but throws on invalid token
- `webContext.respondWith().template("/templates/path.html.pasta", args...)` — render a Pasta template
- `webContext.respondWith().redirectToGet(url)` — HTTP redirect after POST

## Concrete Example

```java
@Register
public class ProductController extends BizController {

    @Routed("/products")
    @DefaultRoute
    @LoginRequired
    @Permission("permission-manage-products")
    public void products(WebContext webContext) {
        SQLQuery<Product> query = oma.select(Product.class)
                                     .orderAsc(Product.NAME);
        webContext.respondWith()
                  .template("/templates/products/list.html.pasta", query);
    }

    @Routed("/product/:1/edit")
    @LoginRequired
    @Permission("permission-manage-products")
    public void editProduct(WebContext webContext, String productId) {
        Product product = findForTenant(Product.class, productId);

        if (webContext.ensureSafePOST()) {
            load(webContext, product);
            oma.update(product);
            showSavedMessage();
            webContext.respondWith().redirectToGet("/products");
            return;
        }

        webContext.respondWith()
                  .template("/templates/products/edit.html.pasta", product);
    }

    @Routed("/product/:1/delete")
    @LoginRequired
    @Permission("permission-manage-products")
    public void deleteProduct(WebContext webContext, String productId) {
        Product product = findForTenant(Product.class, productId);
        oma.delete(product);
        showDeletedMessage();
        webContext.respondWith().redirectToGet("/products");
    }
}
```

## Common Mistakes

1. **Forgetting `@Register`** — Controllers must be annotated with `@Register`
   or they will not be discovered by the framework.

2. **Missing CSRF check on mutations** — Always use `ensureSafePOST()` or
   `isSafePOST()` before modifying data. Skipping this opens CSRF vulnerabilities.

3. **Route priority conflicts** — If `/items/:1` and `/items/new` both exist,
   the generic route may match first. Set a lower `priority` value on `/items/new`.

4. **Returning after redirect** — After calling `redirectToGet()`, always `return`
   from the method. Otherwise the code continues and may try to render a template,
   causing a "response already committed" error.
