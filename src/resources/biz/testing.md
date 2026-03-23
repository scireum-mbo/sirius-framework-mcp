# Testing

Tests in sirius-biz are written in Kotlin using JUnit 5 with the `SiriusExtension`.
This extension boots the full Sirius framework (DI, databases, config) before tests
run, giving you access to real services and database connections.

## Test Structure

- **Test files:** `src/test/kotlin/sirius/biz/**/*Test.kt` (Kotlin)
- **Test entities:** `src/test/java/sirius/biz/**/*.java` (Java, for test-only entities)
- **Test config:** `src/test/resources/test.conf`
- **Test suite:** `TestSuite.java` using `ScenarioSuite`

## SiriusExtension and DI

Every test class must use `@ExtendWith(SiriusExtension::class)`. This boots the
Sirius framework once per test run (shared across all test classes).

Use `@Part` in a `companion object` with `@JvmStatic` to inject services.
Always wait for database readiness in `@BeforeAll`:

```kotlin
@BeforeAll
@JvmStatic
fun setup() {
    oma.readyFuture.await(Duration.ofSeconds(60))
}
```

**Important:** `@Part` fields must be in the `companion object` (static), not on
the test instance. Sirius DI only injects static fields.

## Test Naming

Use Kotlin backtick syntax for descriptive test names. This produces readable test
output while being valid Kotlin method names.

## Complete Example

```kotlin
@ExtendWith(SiriusExtension::class)
class TenantsTest {

    companion object {
        @Part
        @JvmStatic
        private lateinit var oma: OMA

        @BeforeAll
        @JvmStatic
        fun setup() {
            oma.readyFuture.await(Duration.ofSeconds(60))
        }
    }

    @Test
    fun `installTestTenant works`() {
        TenantsHelper.installTestTenant()
        assertTrue {
            UserContext.get().getUser().hasPermission(UserInfo.PERMISSION_LOGGED_IN)
        }
    }
}
```

## Test Entities

Test-only entities live in `src/test/java/` (not `src/main/java/`). They are
written in Java (not Kotlin) because the Mixing ORM annotation processor requires
Java source files:

```java
// src/test/java/sirius/biz/mymodule/TestProduct.java
@Framework("test")
public class TestProduct extends BizEntity {
    @Autoloaded
    @Length(100)
    private String name;

    // getters and setters
}
```

Enable the test framework in `test.conf`:

```hocon
sirius.frameworks {
    test = true
}
```

## Test Configuration

`src/test/resources/test.conf` enables the frameworks needed for testing:

```hocon
sirius.frameworks {
    biz.tenants = true
    biz.tenants-jdbc = true
    biz.storage = true
    biz.storage-blob-jdbc = true
    biz.isenguard = true
    biz.processes = true
    biz.locks = true
}
```

Docker services (MariaDB, MongoDB, Elasticsearch, Redis) must be running for
integration tests. Use `docker-compose up -d` in the project root.

## Common Mistakes

1. **`@Part` on instance fields** — DI injection only works on static fields.
   Place `@Part` fields in the `companion object` with `@JvmStatic`.

2. **Missing `@BeforeAll` database wait** — Tests that run before the schema is
   ready will fail intermittently. Always await `oma.readyFuture`.

3. **Test entities in Kotlin** — The Mixing ORM requires Java source files for
   entity classes. Test entities must be `.java` files even though tests are Kotlin.

4. **Not cleaning up test data** — Tests share the same database. Create unique
   test data (e.g., with random suffixes) or clean up in `@AfterEach` to avoid
   interference between tests.

5. **Forgetting `@JvmStatic`** — Without `@JvmStatic` on companion object fields,
   Sirius DI cannot find and populate the fields.
