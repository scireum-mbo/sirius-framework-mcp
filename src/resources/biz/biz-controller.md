# BizController

`BizController` extends `BasicController` from sirius-web and serves as the base
class for all controllers that operate on entities in the biz layer. It provides
tenant-aware helpers, entity loading from web requests, and pre-injected database
access parts.

## Injected Parts

`BizController` comes with these fields already injected:

```java
@Part protected Mixing mixing;       // Schema/descriptor access
@Part protected OMA oma;             // JDBC entity operations
@Part protected Mango mango;         // MongoDB entity operations
@Part protected Elastic elastic;     // Elasticsearch operations
@Part @Nullable protected Tenants<?, ?, ?> tenants;  // Tenant management
```

You can use `oma`, `mango`, and `elastic` directly in subclasses without declaring
your own `@Part` fields.

## Loading Entities from Requests — load()

The `load()` method reads HTTP parameters into an entity, populating all fields
marked with `@Autoloaded`:

```java
@Routed(value = "/product/:1/save", methods = HttpMethod.POST)
@LoginRequired
public void saveProduct(WebContext webContext, String productId) {
    Product product = find(Product.class, productId);

    load(webContext, product);  // fills all @Autoloaded fields from the request
    oma.update(product);
    showSavedMessage();
    webContext.respondWith().redirectToGet("/products");
}
```

Overloads:
- `load(webContext, entity)` — loads all `@Autoloaded` properties.
- `load(webContext, entity, Mapping... properties)` — loads only the listed properties.
- `load(webContext, entity, List<Mapping> properties)` — same, with a list.

## Resolving Entities — find()

The `find()` method resolves an entity by its ID string. It also handles the special
value `"new"`, which creates a fresh instance instead of querying the database:

```java
Product product = find(Product.class, productId);
// If productId is "new", returns a new Product()
// Otherwise, looks up the entity — throws 404 if not found
```

For tenant-scoped entities, use `findForTenant()` which additionally verifies that
the entity belongs to the current user's tenant.

## CRUD Flow Pattern

The standard pattern for list/edit/delete:

```java
@Register
public class ProductController extends BizController {

    @Routed("/products")
    @DefaultRoute
    @LoginRequired
    @Permission("permission-manage-products")
    public void products(WebContext webContext) {
        SQLPageHelper<Product> pageHelper =
                SQLPageHelper.withQuery(tenants.forCurrentTenant(oma.select(Product.class)));
        pageHelper.withBasePath("/products");
        pageHelper.withSearchFields(QueryField.contains(Product.NAME));
        webContext.respondWith()
                  .template("/templates/products/list.html.pasta", pageHelper.asPage());
    }

    @Routed("/product/:1")
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

## Page Helpers

For list views with pagination, search, and filtering:

- **`SQLPageHelper`** — wraps a `SmartQuery<SQLEntity>` for JDBC entities.
- **`MongoPageHelper`** — wraps a `MongoQuery<MongoEntity>` for MongoDB entities.
- **`ElasticPageHelper`** — wraps an `ElasticQuery<ElasticEntity>` for Elasticsearch.

```java
SQLPageHelper<Product> pageHelper =
        SQLPageHelper.withQuery(oma.select(Product.class).orderAsc(Product.NAME));
pageHelper.withBasePath("/products");
pageHelper.withSearchFields(QueryField.contains(Product.NAME));
pageHelper.addBooleanFacet(Product.ACTIVE, NLS.get("Product.active"));
```

## @Autoloaded

Mark entity properties with `@Autoloaded` to have `load()` pick them up automatically
from HTTP request parameters. The parameter name matches the property name:

```java
@Autoloaded
@Length(150)
@Trim
private String name;  // loaded from request param "name"
```

## Common Mistakes

1. **Forgetting `ensureSafePOST()`** — Always check for safe POST before mutating
   data. Without this, you are vulnerable to CSRF attacks.

2. **Not returning after redirect** — After `redirectToGet()`, always `return`.
   Otherwise the method continues and may try to render a template too.

3. **Using `find()` for tenant-scoped entities** — Use `findForTenant()` instead.
   Plain `find()` does not verify the tenant, which allows cross-tenant data access.

4. **Forgetting `@DefaultRoute`** — Without a default route, exceptions in other
   routes render a generic error page instead of staying in context.
