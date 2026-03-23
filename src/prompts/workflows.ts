/**
 * MCP prompt definitions for common Sirius development workflows.
 *
 * Each prompt generates an initial conversation that guides an AI assistant
 * through a specific Sirius framework task.
 */

export interface McpPrompt {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
  generateMessages: (args: Record<string, string>) => Array<{
    role: "user" | "assistant";
    content: { type: "text"; text: string };
  }>;
}

function userMessage(text: string) {
  return { role: "user" as const, content: { type: "text" as const, text } };
}

function assistantMessage(text: string) {
  return {
    role: "assistant" as const,
    content: { type: "text" as const, text },
  };
}

// ---------------------------------------------------------------------------
// 1. add-entity
// ---------------------------------------------------------------------------

export const addEntityPrompt: McpPrompt = {
  name: "add-entity",
  description: "I want to add a new Sirius entity",
  arguments: [
    {
      name: "name",
      description:
        "The entity name (e.g. 'Product'). Used as the base for interface, SQL, and Mongo class names.",
      required: true,
    },
    {
      name: "package",
      description:
        "The target Java package (e.g. 'sirius.biz.products'). If omitted, a sensible default under sirius.biz will be suggested.",
      required: false,
    },
  ],
  generateMessages(args) {
    const name = args.name;
    const pkg = args.package ?? `sirius.biz.${name.toLowerCase()}s`;

    return [
      userMessage(
        `I want to add a new Sirius entity called "${name}" in the package "${pkg}". ` +
          `Please guide me through the full entity-triple pattern.`,
      ),
      assistantMessage(
        `Great -- adding a new entity in Sirius follows the **entity-triple** pattern ` +
          `(see resource \`sirius://biz/entity-triple\`). Here is the step-by-step plan:\n` +
          `\n` +
          `## 1. Database-independent interface\n` +
          `Create \`${pkg}.${name}\` as an interface that extends \`Entity\` (and typically \`Traced\`, \`Journaled\`).\n` +
          `Define a \`${name}Data\` composite if the entity carries reusable field groups.\n` +
          `Use \`Mapping.named()\` constants for every persistent field.\n` +
          `\n` +
          `## 2. JDBC implementation\n` +
          `Create \`${pkg}.jdbc.SQL${name}\` extending \`SQLTenantAware\` and implementing \`${name}\`.\n` +
          `Add appropriate \`@Index\` annotations for unique constraints and lookup fields.\n` +
          `Add \`@Framework("${pkg.replace(/^sirius\.biz\./, "biz.")}-jdbc")\` so the entity is only loaded when the flag is enabled.\n` +
          `\n` +
          `## 3. MongoDB implementation\n` +
          `Create \`${pkg}.mongo.Mongo${name}\` extending \`MongoTenantAware\` and implementing \`${name}\`.\n` +
          `Add \`@Framework("${pkg.replace(/^sirius\.biz\./, "biz.")}-mongo")\`.\n` +
          `\n` +
          `## 4. Framework flags\n` +
          `Register framework flags in your \`.conf\` file:\n` +
          `\`\`\`hocon\n` +
          `sirius.frameworks {\n` +
          `    "${pkg.replace(/^sirius\.biz\./, "biz.")}" = true\n` +
          `    "${pkg.replace(/^sirius\.biz\./, "biz.")}-jdbc" = true\n` +
          `    "${pkg.replace(/^sirius\.biz\./, "biz.")}-mongo" = false\n` +
          `}\n` +
          `\`\`\`\n` +
          `\n` +
          `## 5. Translation source\n` +
          `Add \`@TranslationSource\` to provide i18n keys for the entity and its fields.\n` +
          `Create corresponding \`.properties\` files under \`resources/\`.\n` +
          `\n` +
          `Shall I generate the skeleton code for each of these files?`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// 2. add-job
// ---------------------------------------------------------------------------

export const addJobPrompt: McpPrompt = {
  name: "add-job",
  description: "I want to add a new background job",
  arguments: [
    {
      name: "name",
      description:
        "The job name (e.g. 'ProductImportJob'). Used as the class name for the JobFactory implementation.",
      required: true,
    },
    {
      name: "type",
      description:
        "The kind of job: 'batch' (long-running data processing), 'report' (generates output), or 'interactive' (user-triggered, short-lived). Determines the base class.",
      required: false,
    },
  ],
  generateMessages(args) {
    const name = args.name;
    const type = args.type ?? "batch";

    const baseClassMap: Record<string, string> = {
      batch: "BatchProcessJobFactory",
      report: "ReportJobFactory",
      interactive: "InteractiveJobFactory",
    };
    const baseClass = baseClassMap[type] ?? baseClassMap.batch;

    return [
      userMessage(
        `I want to add a new ${type} background job called "${name}". ` +
          `Please guide me through the Sirius jobs framework.`,
      ),
      assistantMessage(
        `The Sirius jobs framework (see resource \`sirius://biz/jobs\`) uses a ` +
          `\`JobFactory\` hierarchy to define background jobs. For a **${type}** job, ` +
          `the right base class is \`${baseClass}\`.\n` +
          `\n` +
          `## Step-by-step plan\n` +
          `\n` +
          `### 1. Choose and extend the base class\n` +
          `Create \`${name}\` extending \`${baseClass}\`.\n` +
          `Register it with \`@Register\` so the DI framework picks it up.\n` +
          `\n` +
          `### 2. Define parameters\n` +
          `Override the \`collectParameters()\` method to declare job parameters.\n` +
          `Use parameter types like \`StringParameter\`, \`BooleanParameter\`, \`EntityParameter\`, etc.\n` +
          `Parameters appear in the job's UI form automatically.\n` +
          `\n` +
          `### 3. Implement execution logic\n` +
          (type === "batch"
            ? `Override \`execute(ProcessContext process)\` to implement the batch processing logic.\n` +
              `Use \`process.log()\` for progress reporting and \`process.addTiming()\` for performance tracking.\n` +
              `Handle cancellation via \`process.isActive()\`.\n`
            : type === "report"
              ? `Override \`execute(ProcessContext process)\` and use the report output helpers.\n` +
                `The report framework handles file generation and storage automatically.\n`
              : `Override \`execute(ProcessContext process)\` for the interactive job logic.\n` +
                `Interactive jobs are typically short-lived and may provide immediate feedback.\n`) +
          `\n` +
          `### 4. Permissions and labels\n` +
          `Override \`getRequiredPermission()\` to restrict who can run the job.\n` +
          `Provide a label and description via NLS keys.\n` +
          `\n` +
          `### 5. Optional: scheduling\n` +
          `If the job should run on a schedule, implement the \`ScheduledJobFactory\` interface ` +
          `or configure it via the admin UI.\n` +
          `\n` +
          `Shall I generate the skeleton code for \`${name}\`?`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// 3. add-feature
// ---------------------------------------------------------------------------

export const addFeaturePrompt: McpPrompt = {
  name: "add-feature",
  description: "I want to add a complete feature module",
  arguments: [
    {
      name: "name",
      description:
        "The feature name (e.g. 'products'). This determines the package, entity names, controller, and templates.",
      required: true,
    },
  ],
  generateMessages(args) {
    const name = args.name;
    const singular =
      name.endsWith("s") && name.length > 1 ? name.slice(0, -1) : name;
    const entityName = singular.charAt(0).toUpperCase() + singular.slice(1);
    const pkg = `sirius.biz.${name.toLowerCase()}`;

    return [
      userMessage(
        `I want to add a complete feature module called "${name}" to a Sirius application. ` +
          `This should be a full vertical slice: entity, controller, template, and test.`,
      ),
      assistantMessage(
        `A full feature module in Sirius is a vertical slice that touches multiple layers. ` +
          `Here is the plan for the "${name}" feature. Relevant resources:\n` +
          `- \`sirius://biz/entity-triple\` (entity pattern)\n` +
          `- \`sirius://biz/jobs\` (if the feature needs background processing)\n` +
          `- \`sirius://biz/importer\` (if the feature needs data import)\n` +
          `- \`sirius://kernel/di\` (dependency injection and registration)\n` +
          `\n` +
          `## 1. Entity layer\n` +
          `Follow the entity-triple pattern to create:\n` +
          `- \`${pkg}.${entityName}\` -- database-independent interface\n` +
          `- \`${pkg}.jdbc.SQL${entityName}\` -- JDBC implementation (extends \`SQLTenantAware\`)\n` +
          `- \`${pkg}.mongo.Mongo${entityName}\` -- MongoDB implementation (extends \`MongoTenantAware\`)\n` +
          `- \`${pkg}.${entityName}Data\` -- composite for reusable field groups (if needed)\n` +
          `\n` +
          `## 2. Controller layer\n` +
          `Create \`${pkg}.${entityName}Controller\` extending \`BizController\`:\n` +
          `- Use \`@Routed\` annotations for URL mappings (e.g. \`/${name}\`, \`/${singular}/{id}\`)\n` +
          `- Add \`@LoginRequired\` and \`@Permission\` for access control\n` +
          `- Implement list, detail/edit, and delete endpoints\n` +
          `- Make the controller generic over the entity interface so it works with both SQL and Mongo\n` +
          `\n` +
          `## 3. Template layer\n` +
          `Create Pasta/Tagliatelle templates under \`resources/default/templates/biz/${name}/\`:\n` +
          `- \`${singular}.html.pasta\` -- detail/edit view\n` +
          `- \`${name}.html.pasta\` -- list view\n` +
          `Use the Tycho UI component library (\`<t:...>\` tags) for consistent look-and-feel.\n` +
          `\n` +
          `## 4. Framework flags\n` +
          `Register in your \`.conf\`:\n` +
          `\`\`\`hocon\n` +
          `sirius.frameworks {\n` +
          `    "biz.${name}" = true\n` +
          `    "biz.${name}-jdbc" = true\n` +
          `    "biz.${name}-mongo" = false\n` +
          `}\n` +
          `\`\`\`\n` +
          `\n` +
          `## 5. Test\n` +
          `Create \`${entityName}Test.kt\` in \`src/test/kotlin/${pkg.replace(/\./g, "/")}/\`:\n` +
          `- Use \`@ExtendWith(SiriusExtension::class)\`\n` +
          `- Wait for database readiness in \`@BeforeAll\`\n` +
          `- Test CRUD operations and any business logic\n` +
          `\n` +
          `## 6. i18n\n` +
          `Add \`@TranslationSource\` to the entity and create \`.properties\` files ` +
          `for labels and validation messages.\n` +
          `\n` +
          `Shall I start generating the code for each layer?`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// 4. add-import-handler
// ---------------------------------------------------------------------------

export const addImportHandlerPrompt: McpPrompt = {
  name: "add-import-handler",
  description: "I want to add a data import handler",
  arguments: [
    {
      name: "entity",
      description:
        "The entity name this import handler targets (e.g. 'Product'). Must correspond to an existing Sirius entity.",
      required: true,
    },
  ],
  generateMessages(args) {
    const entity = args.entity;

    return [
      userMessage(
        `I want to add a data import handler for the "${entity}" entity. ` +
          `Please guide me through the Sirius importer framework.`,
      ),
      assistantMessage(
        `The Sirius importer framework (see resource \`sirius://biz/importer\`) provides ` +
          `\`EntityImportHandler\` classes that define how external data maps to entities. ` +
          `Here is the plan:\n` +
          `\n` +
          `## 1. Choose the base class\n` +
          `- For JDBC entities: extend \`SQLEntityImportHandler<SQL${entity}>\`\n` +
          `- For MongoDB entities: extend \`MongoEntityImportHandler<Mongo${entity}>\`\n` +
          `Register with \`@Register\` and annotate with the appropriate \`@Framework\`.\n` +
          `\n` +
          `## 2. Define find queries\n` +
          `Override \`determineFindQuery()\` to specify how existing records are located ` +
          `during import (usually by a unique business key like an external ID or code).\n` +
          `This is critical for upsert behavior -- without it, imports always create new records.\n` +
          `\n` +
          `## 3. Map fields\n` +
          `Override \`collectFieldMappings()\` or use the auto-mapping from \`@AutoImport\` annotations.\n` +
          `Fields annotated with \`@AutoImport\` on the entity are automatically mapped.\n` +
          `For custom/computed fields, add explicit mappings in the handler.\n` +
          `\n` +
          `## 4. Handle events\n` +
          `Override lifecycle callbacks to add custom logic:\n` +
          `- \`beforeImport()\` -- validate or transform data before persisting\n` +
          `- \`afterImport()\` -- trigger side effects after a record is imported\n` +
          `- \`collectDefaultExportableMappings()\` -- define which fields appear in exports\n` +
          `\n` +
          `## 5. Register and test\n` +
          `The handler is automatically discovered by the import framework via DI.\n` +
          `Test by creating a small CSV or XML import and running it through the import UI or jobs.\n` +
          `\n` +
          `Shall I generate the handler skeleton for \`${entity}\`?`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// 5. debug-framework-flags
// ---------------------------------------------------------------------------

export const debugFrameworkFlagsPrompt: McpPrompt = {
  name: "debug-framework-flags",
  description: "My entity/service isn't being picked up",
  arguments: [],
  generateMessages() {
    return [
      userMessage(
        `My entity or service is not being picked up by the Sirius framework. ` +
          `I have the class annotated with @Register but it does not seem to be active. ` +
          `Help me debug this.`,
      ),
      assistantMessage(
        `This is a common issue and almost always comes down to **framework flags**. ` +
          `Let me walk you through the diagnostic steps (see resource \`sirius://kernel/di\`).\n` +
          `\n` +
          `## Step 1: Check the framework flag on your class\n` +
          `Look at the \`@Register\` annotation on your class. If it specifies a \`framework\` attribute:\n` +
          `\`\`\`java\n` +
          `@Register(framework = "biz.myfeature")\n` +
          `\`\`\`\n` +
          `...then the flag \`biz.myfeature\` must be **enabled** in the config.\n` +
          `\n` +
          `Also check for a \`@Framework\` annotation on the class, which serves the same purpose.\n` +
          `\n` +
          `## Step 2: Verify the flag is enabled in config\n` +
          `Check your \`develop.conf\` (or \`instance.conf\`) and the component config files:\n` +
          `\`\`\`hocon\n` +
          `sirius.frameworks {\n` +
          `    "biz.myfeature" = true      # Must be true!\n` +
          `    "biz.myfeature-jdbc" = true  # If using JDBC entities\n` +
          `}\n` +
          `\`\`\`\n` +
          `A missing or \`false\` flag means the class is **completely invisible** to the DI system.\n` +
          `\n` +
          `## Step 3: Check for typos in framework names\n` +
          `The framework name in \`@Register(framework = "...")\` must **exactly match** ` +
          `the key in \`sirius.frameworks\`. A typo in either place silently disables the class.\n` +
          `\n` +
          `## Step 4: Check the class hierarchy\n` +
          `- Entities must extend the correct base class (\`SQLTenantAware\`, \`MongoTenantAware\`, etc.)\n` +
          `- Services must implement an interface or extend a known base class\n` +
          `- The class must be in a package that is scanned (under the configured base packages)\n` +
          `\n` +
          `## Step 5: Use the system console\n` +
          `In dev mode, go to \`/system/console\` and use the \`frameworks\` command to see ` +
          `which flags are active. You can also check \`/system/cluster\` for registered components.\n` +
          `\n` +
          `What is the exact class and its annotations? I can help pinpoint the issue.`,
      ),
    ];
  },
};
