/**
 * Scaffold tools for generating Sirius framework Java/Kotlin boilerplate code.
 *
 * These tools generate code as strings (NOT file writes). The AI assistant will write the files.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldDefinition {
  name: string;
  type: string;
  length?: number;
  annotations?: string[];
}

export interface ScaffoldFile {
  fileName: string;
  path: string;
  content: string;
}

export interface ScaffoldResult {
  files: ScaffoldFile[];
}

export interface ScaffoldEntityOptions {
  name: string;
  package: string;
  targets?: string[];
  tenantAware?: boolean;
  fields?: FieldDefinition[];
  mixins?: string[];
}

export interface ScaffoldJobOptions {
  name: string;
  package: string;
  type?: string;
  framework?: string;
  parameters?: string[];
}

export interface ScaffoldTestOptions {
  name: string;
  package: string;
  setupParts?: string[];
}

export interface ScaffoldCompositeOptions {
  name: string;
  package: string;
  fields?: FieldDefinition[];
}

export interface ScaffoldControllerOptions {
  name: string;
  package: string;
  entity?: string;
  permissions?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a camelCase field name to UPPER_SNAKE_CASE.
 *
 * Examples:
 *   "invoiceNumber" -> "INVOICE_NUMBER"
 *   "name"          -> "NAME"
 *   "firstName"     -> "FIRST_NAME"
 */
export function toUpperSnake(camelCase: string): string {
  return camelCase
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
}

/**
 * Converts a PascalCase name to kebab-case.
 *
 * Examples:
 *   "ProductImport" -> "product-import"
 *   "SampleJob"     -> "sample-job"
 */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Extracts the last segment of a dot-separated package name.
 *
 * Example: "sirius.biz.products" -> "products"
 */
function lastPackageSegment(pkg: string): string {
  const parts = pkg.split(".");
  return parts[parts.length - 1];
}

/**
 * Converts a package name to a file path.
 *
 * Example: "sirius.biz.products" -> "sirius/biz/products"
 */
function packageToPath(pkg: string): string {
  return pkg.replace(/\./g, "/");
}

/**
 * Pluralizes a name using simple English rules.
 * Used for route generation in controllers.
 */
function pluralize(name: string): string {
  if (name.endsWith("y") && !/[aeiou]y$/i.test(name)) {
    return name.slice(0, -1) + "ies";
  }
  if (
    name.endsWith("s") ||
    name.endsWith("x") ||
    name.endsWith("z") ||
    name.endsWith("ch") ||
    name.endsWith("sh")
  ) {
    return name + "es";
  }
  return name + "s";
}

/**
 * Lowercases the first character of a string.
 * If the entire string is uppercase (e.g., "OMA"), lowercases it all.
 * If it starts with consecutive uppercase letters followed by lowercase (e.g., "HTMLParser"),
 * lowercases all but the last uppercase letter.
 */
function lcFirst(s: string): string {
  if (s.length === 0) return s;
  // If the whole string is uppercase, lowercase everything
  if (s === s.toUpperCase()) {
    return s.toLowerCase();
  }
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// scaffoldEntity
// ---------------------------------------------------------------------------

export function scaffoldEntity(options: ScaffoldEntityOptions): ScaffoldResult {
  const {
    name,
    package: pkg,
    targets = ["jdbc", "mongo"],
    tenantAware = true,
    fields = [],
    mixins = [],
  } = options;

  const files: ScaffoldFile[] = [];

  // 1. Generate the interface file
  files.push(generateEntityInterface(name, pkg, fields, mixins));

  // 2. Generate implementation files for each target
  for (const target of targets) {
    switch (target) {
      case "jdbc":
        files.push(generateJdbcEntity(name, pkg, tenantAware, fields));
        break;
      case "mongo":
        files.push(generateMongoEntity(name, pkg, tenantAware, fields));
        break;
      case "elastic":
        files.push(generateElasticEntity(name, pkg, fields));
        break;
    }
  }

  return { files };
}

function generateEntityInterface(
  name: string,
  pkg: string,
  fields: FieldDefinition[],
  mixins: string[],
): ScaffoldFile {
  const extendsClause = ["Entity", ...mixins].join(", ");

  const fieldDeclarations = fields
    .map((f) => {
      const upperSnake = toUpperSnake(f.name);
      const mappingLine = `    Mapping ${upperSnake} = Mapping.named("${f.name}");`;
      const getterName = `get${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`;
      const getterLine = `    ${f.type} ${getterName}();`;
      return `\n${mappingLine}\n\n${getterLine}`;
    })
    .join("\n");

  const content = `package ${pkg};

import sirius.db.mixing.Entity;
import sirius.db.mixing.Mapping;

import java.io.Serializable;

public interface ${name}<I extends Serializable> extends ${extendsClause} {
${fieldDeclarations}
}
`;

  return {
    fileName: `${name}.java`,
    path: `src/main/java/${packageToPath(pkg)}/${name}.java`,
    content,
  };
}

function generateJdbcEntity(
  name: string,
  pkg: string,
  tenantAware: boolean,
  fields: FieldDefinition[],
): ScaffoldFile {
  const jdbcPkg = `${pkg}.jdbc`;
  const framework = lastPackageSegment(pkg);
  const superClass = tenantAware ? "SQLTenantAware" : "BizEntity";
  const superImport = tenantAware
    ? "import sirius.biz.tenants.jdbc.SQLTenantAware;"
    : "import sirius.biz.jdbc.BizEntity;";

  const fieldDeclarations = generateFieldDeclarations(fields);

  const content = `package ${jdbcPkg};

${superImport}
import sirius.db.mixing.Mapping;
import sirius.db.mixing.annotations.Length;
import sirius.db.mixing.annotations.TranslationSource;
import sirius.biz.web.Autoloaded;
import sirius.kernel.di.std.Framework;
import ${pkg}.${name};

@Framework("${framework}")
@TranslationSource(${name}.class)
public class SQL${name} extends ${superClass} implements ${name}<Long> {
${fieldDeclarations}
}
`;

  return {
    fileName: `SQL${name}.java`,
    path: `src/main/java/${packageToPath(jdbcPkg)}/SQL${name}.java`,
    content,
  };
}

function generateMongoEntity(
  name: string,
  pkg: string,
  tenantAware: boolean,
  fields: FieldDefinition[],
): ScaffoldFile {
  const mongoPkg = `${pkg}.mongo`;
  const framework = lastPackageSegment(pkg);
  const superClass = tenantAware ? "MongoTenantAware" : "MongoBizEntity";
  const superImport = tenantAware
    ? "import sirius.biz.tenants.mongo.MongoTenantAware;"
    : "import sirius.biz.mongo.MongoBizEntity;";

  const fieldDeclarations = generateFieldDeclarations(fields);

  const content = `package ${mongoPkg};

${superImport}
import sirius.db.mixing.Mapping;
import sirius.db.mixing.annotations.Length;
import sirius.db.mixing.annotations.TranslationSource;
import sirius.biz.web.Autoloaded;
import sirius.kernel.di.std.Framework;
import ${pkg}.${name};

@Framework("${framework}")
@TranslationSource(${name}.class)
public class Mongo${name} extends ${superClass} implements ${name}<String> {
${fieldDeclarations}
}
`;

  return {
    fileName: `Mongo${name}.java`,
    path: `src/main/java/${packageToPath(mongoPkg)}/Mongo${name}.java`,
    content,
  };
}

function generateElasticEntity(
  name: string,
  pkg: string,
  fields: FieldDefinition[],
): ScaffoldFile {
  const elasticPkg = `${pkg}.elastic`;
  const framework = lastPackageSegment(pkg);

  const fieldDeclarations = generateFieldDeclarations(fields);

  const content = `package ${elasticPkg};

import sirius.biz.elastic.SearchableEntity;
import sirius.db.mixing.Mapping;
import sirius.db.mixing.annotations.Length;
import sirius.db.mixing.annotations.TranslationSource;
import sirius.biz.web.Autoloaded;
import sirius.kernel.di.std.Framework;
import ${pkg}.${name};

@Framework("${framework}")
@TranslationSource(${name}.class)
public class Elastic${name} extends SearchableEntity implements ${name}<String> {
${fieldDeclarations}
}
`;

  return {
    fileName: `Elastic${name}.java`,
    path: `src/main/java/${packageToPath(elasticPkg)}/Elastic${name}.java`,
    content,
  };
}

function generateFieldDeclarations(fields: FieldDefinition[]): string {
  if (fields.length === 0) return "";

  return fields
    .map((f) => {
      const upperSnake = toUpperSnake(f.name);
      const lines: string[] = [];

      lines.push(
        `    public static final Mapping ${upperSnake} = Mapping.named("${f.name}");`,
      );

      // Annotations
      const annotations = f.annotations ?? [];
      if (f.length) {
        lines.push(`    @Length(${f.length})`);
      }
      for (const ann of annotations) {
        if (ann.startsWith("@")) {
          lines.push(`    ${ann}`);
        } else {
          lines.push(`    @${ann}`);
        }
      }

      lines.push(`    private ${f.type} ${f.name};`);

      // Getter
      const getterName = `get${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`;
      lines.push("");
      lines.push(`    public ${f.type} ${getterName}() {`);
      lines.push(`        return ${f.name};`);
      lines.push(`    }`);

      return "\n" + lines.join("\n");
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// scaffoldJob
// ---------------------------------------------------------------------------

export function scaffoldJob(options: ScaffoldJobOptions): ScaffoldResult {
  const {
    name,
    package: pkg,
    type = "SimpleBatchProcessJobFactory",
    framework,
    parameters = [],
  } = options;

  const kebabName = toKebabCase(name);
  const registerAnnotation = framework
    ? `@Register(framework = "${framework}")`
    : "@Register";

  const isReport = type === "ReportJobFactory";

  const parameterImports = parameters.length > 0
    ? "\nimport sirius.biz.jobs.params.Parameter;\nimport java.util.Map;\nimport java.util.function.BiConsumer;\nimport java.util.function.Consumer;"
    : "";

  const collectParametersMethod =
    parameters.length > 0
      ? `
    @Override
    protected void collectParameters(Consumer<Parameter<?, ?>> parameterCollector) {
        // TODO: Add parameters
${parameters.map((p) => `        // parameterCollector.accept(${p});`).join("\n")}
    }
`
      : `
    @Override
    protected void collectParameters(Consumer<Parameter<?, ?>> parameterCollector) {
        // TODO: Add parameters
    }
`;

  const executeMethod = isReport
    ? `
    @Override
    protected void computeReport(Map<String, String> context,
                                 Report report,
                                 BiConsumer<String, Cell> additionalMetricConsumer) throws Exception {
        // TODO: Implement report computation
    }
`
    : `
    @Override
    protected void execute(ProcessContext process) throws Exception {
        // TODO: Implement job execution
    }
`;

  const typeImport = isReport
    ? "import sirius.biz.jobs.interactive.ReportJobFactory;\nimport sirius.biz.analytics.reports.Cell;\nimport sirius.biz.analytics.reports.Report;"
    : "import sirius.biz.jobs.batch.SimpleBatchProcessJobFactory;\nimport sirius.biz.process.ProcessContext;";

  const content = `package ${pkg};

${typeImport}
import sirius.biz.jobs.StandardCategories;
import sirius.kernel.di.std.Register;${parameterImports}

${registerAnnotation}
public class ${name} extends ${type} {

    @Override
    public String getName() {
        return "${kebabName}";
    }

    @Override
    public String getCategory() {
        return StandardCategories.MISC;
    }
${collectParametersMethod}${executeMethod}
}
`;

  return {
    files: [
      {
        fileName: `${name}.java`,
        path: `src/main/java/${packageToPath(pkg)}/${name}.java`,
        content,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// scaffoldTest
// ---------------------------------------------------------------------------

export function scaffoldTest(options: ScaffoldTestOptions): ScaffoldResult {
  const { name, package: pkg, setupParts = [] } = options;

  const partDeclarations = setupParts
    .map((part) => {
      const varName = lcFirst(part);
      return `        @Part\n        private lateinit var ${varName}: ${part}`;
    })
    .join("\n\n");

  const setupBody =
    setupParts.length > 0
      ? `            ${lcFirst(setupParts[0])}.readyFuture.await(Duration.ofSeconds(60))`
      : "            // Wait for system readiness";

  const content = `package ${pkg}

import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import sirius.kernel.SiriusExtension
import sirius.kernel.di.std.Part
import java.time.Duration

@ExtendWith(SiriusExtension::class)
class ${name} {

    companion object {
${partDeclarations}

        @BeforeAll
        @JvmStatic
        fun setup() {
${setupBody}
        }
    }

    @Test
    fun \`sample test\`() {
        // TODO: Implement test
    }
}
`;

  return {
    files: [
      {
        fileName: `${name}.kt`,
        path: `src/test/kotlin/${packageToPath(pkg)}/${name}.kt`,
        content,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// scaffoldComposite
// ---------------------------------------------------------------------------

export function scaffoldComposite(
  options: ScaffoldCompositeOptions,
): ScaffoldResult {
  const { name, package: pkg, fields = [] } = options;

  const fieldDeclarations = generateCompositeFieldDeclarations(fields);

  const content = `package ${pkg};

import sirius.db.mixing.Composite;
import sirius.db.mixing.Mapping;
import sirius.db.mixing.annotations.Length;
import sirius.db.mixing.annotations.Trim;
import sirius.db.mixing.annotations.NullAllowed;
import sirius.biz.web.Autoloaded;

public class ${name} extends Composite {
${fieldDeclarations}
}
`;

  return {
    files: [
      {
        fileName: `${name}.java`,
        path: `src/main/java/${packageToPath(pkg)}/${name}.java`,
        content,
      },
    ],
  };
}

function generateCompositeFieldDeclarations(
  fields: FieldDefinition[],
): string {
  if (fields.length === 0) return "";

  return fields
    .map((f) => {
      const upperSnake = toUpperSnake(f.name);
      const lines: string[] = [];

      lines.push(
        `    public static final Mapping ${upperSnake} = Mapping.named("${f.name}");`,
      );

      // Annotations
      const annotations = f.annotations ?? [];
      if (f.length) {
        lines.push(`    @Length(${f.length})`);
      }
      for (const ann of annotations) {
        if (ann.startsWith("@")) {
          lines.push(`    ${ann}`);
        } else {
          lines.push(`    @${ann}`);
        }
      }

      lines.push(`    private ${f.type} ${f.name};`);

      // Getter
      const getterName = `get${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`;
      lines.push("");
      lines.push(`    public ${f.type} ${getterName}() {`);
      lines.push(`        return ${f.name};`);
      lines.push(`    }`);

      // Setter
      const setterName = `set${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`;
      lines.push("");
      lines.push(`    public void ${setterName}(${f.type} ${f.name}) {`);
      lines.push(`        this.${f.name} = ${f.name};`);
      lines.push(`    }`);

      return "\n" + lines.join("\n");
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// scaffoldController
// ---------------------------------------------------------------------------

export function scaffoldController(
  options: ScaffoldControllerOptions,
): ScaffoldResult {
  const { name, package: pkg, entity, permissions = [] } = options;

  const permissionConstants = permissions
    .map((p) => {
      const constName = p.toUpperCase().replace(/-/g, "_");
      return `    public static final String ${constName} = "${p}";`;
    })
    .join("\n");

  let routeMethods = "";

  if (entity) {
    const entityLower = lcFirst(entity);
    const entityPlural = pluralize(entityLower);

    const listPermAnnotation =
      permissions.length > 0
        ? `\n    @Permission(${permissions[0].toUpperCase().replace(/-/g, "_")})`
        : "";

    routeMethods = `
    @Routed("/${entityPlural}")
    @LoginRequired${listPermAnnotation}
    public void ${entityPlural}(WebContext webContext) {
        // TODO: Implement list view
    }

    @Routed("/${entityLower}/:1")
    @LoginRequired${listPermAnnotation}
    public void ${entityLower}(WebContext webContext, String id) {
        // TODO: Implement edit view
    }
`;
  }

  const content = `package ${pkg};

import sirius.biz.web.BizController;
import sirius.kernel.di.std.Register;
import sirius.web.controller.Routed;
import sirius.web.http.WebContext;
import sirius.web.security.LoginRequired;
import sirius.web.security.Permission;

@Register
public class ${name} extends BizController {

${permissionConstants ? permissionConstants + "\n" : ""}${routeMethods}
}
`;

  return {
    files: [
      {
        fileName: `${name}.java`,
        path: `src/main/java/${packageToPath(pkg)}/${name}.java`,
        content,
      },
    ],
  };
}
