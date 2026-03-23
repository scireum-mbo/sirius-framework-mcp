import { describe, it, expect } from "vitest";
import {
  scaffoldEntity,
  scaffoldJob,
  scaffoldTest,
  scaffoldComposite,
  scaffoldController,
  toUpperSnake,
} from "../tools/scaffold.js";

describe("toUpperSnake", () => {
  it("should convert camelCase to UPPER_SNAKE_CASE", () => {
    expect(toUpperSnake("invoiceNumber")).toBe("INVOICE_NUMBER");
    expect(toUpperSnake("name")).toBe("NAME");
    expect(toUpperSnake("firstName")).toBe("FIRST_NAME");
    expect(toUpperSnake("htmlParser")).toBe("HTML_PARSER");
  });
});

describe("scaffoldEntity", () => {
  it("should generate interface + JDBC + Mongo files with tenantAware=true", () => {
    const result = scaffoldEntity({
      name: "Product",
      package: "sirius.biz.products",
      targets: ["jdbc", "mongo"],
      tenantAware: true,
      fields: [
        { name: "name", type: "String", length: 255, annotations: ["Trim", "Autoloaded"] },
        { name: "invoiceNumber", type: "String", length: 100 },
      ],
      mixins: ["Traced"],
    });

    // Should generate 3 files: interface + JDBC + Mongo
    expect(result.files).toHaveLength(3);

    // --- Interface file ---
    const iface = result.files.find((f) => f.fileName === "Product.java");
    expect(iface).toBeDefined();
    expect(iface!.path).toBe(
      "src/main/java/sirius/biz/products/Product.java",
    );
    expect(iface!.content).toContain("public interface Product<I extends Serializable>");
    expect(iface!.content).toContain("extends Entity, Traced");
    // Should have Mapping constants
    expect(iface!.content).toContain('Mapping NAME = Mapping.named("name")');
    expect(iface!.content).toContain(
      'Mapping INVOICE_NUMBER = Mapping.named("invoiceNumber")',
    );
    // Should have getter declarations
    expect(iface!.content).toContain("String getName()");
    expect(iface!.content).toContain("String getInvoiceNumber()");

    // --- JDBC file ---
    const jdbc = result.files.find((f) => f.fileName === "SQLProduct.java");
    expect(jdbc).toBeDefined();
    expect(jdbc!.path).toBe(
      "src/main/java/sirius/biz/products/jdbc/SQLProduct.java",
    );
    expect(jdbc!.content).toContain("extends SQLTenantAware");
    expect(jdbc!.content).toContain("implements Product<Long>");
    expect(jdbc!.content).toContain('@Framework("products")');
    expect(jdbc!.content).toContain("@TranslationSource(Product.class)");
    expect(jdbc!.content).toContain("@Length(255)");
    expect(jdbc!.content).toContain("@Trim");
    expect(jdbc!.content).toContain("@Autoloaded");
    expect(jdbc!.content).toContain("private String name;");
    expect(jdbc!.content).toContain(
      'public static final Mapping INVOICE_NUMBER = Mapping.named("invoiceNumber")',
    );

    // --- Mongo file ---
    const mongo = result.files.find(
      (f) => f.fileName === "MongoProduct.java",
    );
    expect(mongo).toBeDefined();
    expect(mongo!.path).toBe(
      "src/main/java/sirius/biz/products/mongo/MongoProduct.java",
    );
    expect(mongo!.content).toContain("extends MongoTenantAware");
    expect(mongo!.content).toContain("implements Product<String>");
    expect(mongo!.content).toContain('@Framework("products")');
    expect(mongo!.content).toContain("@TranslationSource(Product.class)");
  });

  it("should generate interface + JDBC with tenantAware=false (extends BizEntity)", () => {
    const result = scaffoldEntity({
      name: "AuditLog",
      package: "sirius.biz.audit",
      targets: ["jdbc"],
      tenantAware: false,
      fields: [
        { name: "message", type: "String", length: 512 },
      ],
    });

    // Should generate 2 files: interface + JDBC
    expect(result.files).toHaveLength(2);

    const jdbc = result.files.find((f) => f.fileName === "SQLAuditLog.java");
    expect(jdbc).toBeDefined();
    expect(jdbc!.content).toContain("extends BizEntity");
    expect(jdbc!.content).not.toContain("SQLTenantAware");
    expect(jdbc!.content).toContain("implements AuditLog<Long>");
  });
});

describe("scaffoldJob", () => {
  it("should generate SimpleBatchProcessJobFactory with collectParameters and execute", () => {
    const result = scaffoldJob({
      name: "ProductImportJob",
      package: "sirius.biz.products.jobs",
      type: "SimpleBatchProcessJobFactory",
      framework: "products",
      parameters: ["fileParameter", "tenantParameter"],
    });

    expect(result.files).toHaveLength(1);

    const file = result.files[0];
    expect(file.fileName).toBe("ProductImportJob.java");
    expect(file.content).toContain(
      "extends SimpleBatchProcessJobFactory",
    );
    expect(file.content).toContain(
      '@Register(framework = "products")',
    );
    expect(file.content).toContain("collectParameters");
    expect(file.content).toContain("execute(ProcessContext process)");
    expect(file.content).toContain(
      'return "product-import-job"',
    );
    expect(file.content).toContain("StandardCategories.MISC");
  });

  it("should generate ReportJobFactory with computeReport", () => {
    const result = scaffoldJob({
      name: "SalesReport",
      package: "sirius.biz.reports",
      type: "ReportJobFactory",
    });

    expect(result.files).toHaveLength(1);
    const file = result.files[0];
    expect(file.content).toContain("extends ReportJobFactory");
    expect(file.content).toContain("computeReport");
    expect(file.content).not.toContain("execute(ProcessContext");
  });
});

describe("scaffoldTest", () => {
  it("should generate Kotlin test with @ExtendWith, companion object, @Part", () => {
    const result = scaffoldTest({
      name: "ProductTest",
      package: "sirius.biz.products",
      setupParts: ["OMA"],
    });

    expect(result.files).toHaveLength(1);

    const file = result.files[0];
    expect(file.fileName).toBe("ProductTest.kt");
    expect(file.path).toBe(
      "src/test/kotlin/sirius/biz/products/ProductTest.kt",
    );
    expect(file.content).toContain("@ExtendWith(SiriusExtension::class)");
    expect(file.content).toContain("companion object");
    expect(file.content).toContain("@Part");
    expect(file.content).toContain("lateinit var oma: OMA");
    expect(file.content).toContain("@BeforeAll");
    expect(file.content).toContain("@JvmStatic");
    expect(file.content).toContain("oma.readyFuture.await");
    expect(file.content).toContain("fun `sample test`()");
  });
});

describe("scaffoldComposite", () => {
  it("should generate Composite class with UPPER_SNAKE Mapping constants", () => {
    const result = scaffoldComposite({
      name: "AddressData",
      package: "sirius.biz.model",
      fields: [
        { name: "street", type: "String", length: 255, annotations: ["Trim", "Autoloaded"] },
        { name: "zipCode", type: "String", length: 10 },
        { name: "city", type: "String", length: 100 },
      ],
    });

    expect(result.files).toHaveLength(1);

    const file = result.files[0];
    expect(file.fileName).toBe("AddressData.java");
    expect(file.content).toContain("extends Composite");
    expect(file.content).toContain(
      'public static final Mapping STREET = Mapping.named("street")',
    );
    expect(file.content).toContain(
      'public static final Mapping ZIP_CODE = Mapping.named("zipCode")',
    );
    expect(file.content).toContain(
      'public static final Mapping CITY = Mapping.named("city")',
    );
    // Should have getters and setters
    expect(file.content).toContain("public String getStreet()");
    expect(file.content).toContain("public void setStreet(String street)");
    expect(file.content).toContain("@Length(255)");
    expect(file.content).toContain("@Trim");
    expect(file.content).toContain("@Autoloaded");
  });
});

describe("scaffoldController", () => {
  it("should generate BizController with @Routed and @Permission", () => {
    const result = scaffoldController({
      name: "ProductController",
      package: "sirius.biz.products",
      entity: "Product",
      permissions: ["permission-manage-products"],
    });

    expect(result.files).toHaveLength(1);

    const file = result.files[0];
    expect(file.fileName).toBe("ProductController.java");
    expect(file.content).toContain("extends BizController");
    expect(file.content).toContain("@Register");
    expect(file.content).toContain('@Routed("/products")');
    expect(file.content).toContain('@Routed("/product/:1")');
    expect(file.content).toContain("@LoginRequired");
    expect(file.content).toContain("@Permission(PERMISSION_MANAGE_PRODUCTS)");
    expect(file.content).toContain(
      'public static final String PERMISSION_MANAGE_PRODUCTS = "permission-manage-products"',
    );
  });

  it("should generate controller without entity routes when no entity provided", () => {
    const result = scaffoldController({
      name: "DashboardController",
      package: "sirius.biz.dashboard",
    });

    expect(result.files).toHaveLength(1);

    const file = result.files[0];
    expect(file.content).toContain("extends BizController");
    expect(file.content).not.toContain("@Routed");
  });
});
