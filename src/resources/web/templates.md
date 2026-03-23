# Templates (Pasta / Tagliatelle)

Sirius uses the Pasta/Tagliatelle template engine for server-side HTML rendering.
Template files use the `.html.pasta` extension and live under
`src/main/resources/default/templates/`.

## File Structure

```
src/main/resources/default/
    templates/biz/           # Page templates
    taglib/                  # Custom tag definitions (w:, t:, k:)
    extensions/              # Extension point templates
    mail/                    # Email templates
```

Templates are invoked from controllers via:

```java
webContext.respondWith().template("/templates/products/list.html.pasta", query);
```

## Typed Arguments — `<i:arg>`

Every template declares its parameters at the top with `<i:arg>`:

```html
<i:arg type="sirius.db.jdbc.SmartQuery" name="query"/>
<i:arg type="String" name="title"/>
```

The types must be fully qualified Java class names. The arguments are passed
positionally from the controller's `template()` call.

## Control Flow

**Conditionals:**
```html
<i:if test="product.isNew()">
    <h1>Create Product</h1>
</i:if>
<i:else>
    <h1>Edit @product.getName()</h1>
</i:else>
```

**Loops:**
```html
<i:for type="sirius.biz.model.Product" var="product" items="query.queryList()">
    <tr>
        <td>@product.getName()</td>
        <td>@product.getPrice()</td>
    </tr>
</i:for>
```

**Local variables:**
```html
<i:local name="count" value="query.count()"/>
<p>Total: @count</p>
```

**Inline expressions:**
Use `@` to output Java expressions directly: `@product.getName()`. For more
complex expressions, use `@(expression)`.

## Taglib Prefixes

Custom tags are organized by prefix:

- **`w:`** — Web widgets from sirius-web (e.g., `<w:page>`, `<w:table>`)
- **`t:`** — Tycho UI components from sirius-biz (e.g., `<t:page>`, `<t:sidebar>`,
  `<t:searchHeader>`, `<t:datacards>`)
- **`e:`** — Extension points that can be filled by other modules

Tycho (`t:`) is the standard modern UI framework for sirius-biz applications.
Most pages use `<t:page>` as their root element.

## Internationalization — `@i18n`

Use `@i18n("key")` to output a translated string from the NLS system:

```html
<h1>@i18n("Product.plural")</h1>
<button>@i18n("NLS.save")</button>
```

The key is resolved via `NLS.get()` using the current request's language.

## Pragmas

Pragmas provide metadata about the template. They are declared at the top:

```html
<i:pragma name="title" value="Products"/>
<i:pragma name="description" value="Lists all products"/>
```

Pragmas can be read by parent templates or the framework to set page titles,
breadcrumbs, or other metadata.

## Concrete Template Example

```html
<i:arg type="sirius.biz.model.Product" name="product"/>

<i:pragma name="title" value="@apply('Edit: %s', product.getName())"/>

<t:page>
    <i:block name="breadcrumbs">
        <li><a href="/products">@i18n("Product.plural")</a></li>
        <li>@product.getName()</li>
    </i:block>

    <i:block name="page-header">
        <t:pageHeader title="@product.getName()"/>
    </i:block>

    <t:editForm url="@apply('/product/%s/edit', product.getIdAsString())">
        <div class="row">
            <t:textfield name="name" value="@product.getName()"
                         label="@i18n('Product.name')"
                         class="col-md-6"/>
            <t:textfield name="price" value="@toUserString(product.getPrice())"
                         label="@i18n('Product.price')"
                         class="col-md-6"/>
        </div>
    </t:editForm>
</t:page>
```

## Extension Points

Extensions allow modules to inject content into templates without modifying them:

```html
<!-- In the base template -->
<e:extensions target="product-details" product="@product"/>

<!-- In an extension template under extensions/product-details/ -->
<i:arg type="sirius.biz.model.Product" name="product"/>
<t:textfield name="sku" value="@product.getSku()" label="SKU"/>
```

All templates found under `extensions/<target-name>/` are rendered at the
extension point, in alphabetical filename order.

## Common Mistakes

1. **Non-qualified type in `<i:arg>`** — Always use the fully qualified class name.
   Writing `SmartQuery` instead of `sirius.db.jdbc.SmartQuery` causes a compile error.

2. **Forgetting to pass all arguments** — The `template()` call must pass arguments
   in the same order as the `<i:arg>` declarations. Missing arguments cause
   runtime errors.

3. **Using `@` in HTML attributes without quotes** — Expressions in attributes
   must be quoted: `href="@url"`, not `href=@url`.

4. **Modifying taglib templates directly** — Tags under `taglib/` are framework-
   provided. Override behavior through extensions or by creating custom tags rather
   than editing built-in ones.
