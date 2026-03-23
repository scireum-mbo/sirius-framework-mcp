import { Parser, Language } from "web-tree-sitter";
import type { SyntaxNode } from "web-tree-sitter";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AnnotationInfo {
  name: string;
  args: Record<string, string>;
}

export interface RouteInfo {
  path: string;
  permissions: string[];
  loginRequired: boolean;
  methodName: string;
}

export interface JavaClassInfo {
  packageName: string;
  className: string;
  superClass: string | null;
  interfaces: string[];
  annotations: AnnotationInfo[];
  mappings: string[];
  routes: RouteInfo[];
  fields: Array<{ name: string; type: string; annotations: string[] }>;
}

let parser: Parser | null = null;

async function getParser(): Promise<Parser> {
  if (parser) return parser;
  await Parser.init();
  parser = new Parser();
  const wasmPath = join(__dirname, "grammars", "tree-sitter-java.wasm");
  const Java = await Language.load(wasmPath);
  parser.setLanguage(Java);
  return parser;
}

/**
 * Extract the text content of a string_literal node, stripping surrounding quotes.
 */
function extractStringLiteral(node: SyntaxNode): string {
  const fragment = node.children.find((c) => c.type === "string_fragment");
  if (fragment) return fragment.text;
  // Fallback: strip quotes from the raw text
  const text = node.text;
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

/**
 * Parse an annotation node and return an AnnotationInfo.
 * Handles both `annotation` (with args) and `marker_annotation` (no args).
 */
function parseAnnotation(node: SyntaxNode): AnnotationInfo {
  const args: Record<string, string> = {};

  if (node.type === "marker_annotation") {
    const nameNode = node.children.find((c) => c.type === "identifier");
    return { name: nameNode?.text ?? "", args };
  }

  // annotation type
  const nameNode = node.children.find((c) => c.type === "identifier");
  const name = nameNode?.text ?? "";

  const argList = node.children.find(
    (c) => c.type === "annotation_argument_list",
  );
  if (argList) {
    for (const child of argList.children) {
      if (child.type === "element_value_pair") {
        const key = child.children.find((c) => c.type === "identifier");
        const value = child.children.find(
          (c) => c.type === "string_literal",
        );
        if (key && value) {
          args[key.text] = extractStringLiteral(value);
        }
      } else if (child.type === "string_literal") {
        // Single unnamed string argument, store as "value"
        args["value"] = extractStringLiteral(child);
      }
    }
  }

  return { name, args };
}

/**
 * Extract the base type name from a type node, stripping generic type arguments.
 * e.g., `SQLTenantAware<X, Y>` -> `SQLTenantAware`
 */
function extractBaseTypeName(node: SyntaxNode): string {
  if (node.type === "generic_type") {
    const typeId = node.children.find((c) => c.type === "type_identifier");
    return typeId?.text ?? node.text;
  }
  if (node.type === "type_identifier") {
    return node.text;
  }
  return node.text;
}

/**
 * Extract annotations from a modifiers node.
 */
function extractAnnotations(modifiersNode: SyntaxNode): AnnotationInfo[] {
  const annotations: AnnotationInfo[] = [];
  for (const child of modifiersNode.children) {
    if (child.type === "annotation" || child.type === "marker_annotation") {
      annotations.push(parseAnnotation(child));
    }
  }
  return annotations;
}

/**
 * Extract just the annotation names from a modifiers node.
 */
function extractAnnotationNames(modifiersNode: SyntaxNode): string[] {
  const names: string[] = [];
  for (const child of modifiersNode.children) {
    if (child.type === "annotation") {
      const nameNode = child.children.find((c) => c.type === "identifier");
      if (nameNode) names.push(nameNode.text);
    } else if (child.type === "marker_annotation") {
      const nameNode = child.children.find((c) => c.type === "identifier");
      if (nameNode) names.push(nameNode.text);
    }
  }
  return names;
}

/**
 * Check if a field declaration is a Mapping.named() constant.
 * Returns the constant name if it is, null otherwise.
 */
function extractMappingConstant(fieldNode: SyntaxNode): string | null {
  const declarator = fieldNode.children.find(
    (c) => c.type === "variable_declarator",
  );
  if (!declarator) return null;

  const initializer = declarator.children.find(
    (c) => c.type === "method_invocation",
  );
  if (!initializer) return null;

  // Check if the method invocation is Mapping.named(...)
  if (initializer.text.startsWith("Mapping.named(")) {
    const nameNode = declarator.children.find(
      (c) => c.type === "identifier",
    );
    return nameNode?.text ?? null;
  }

  return null;
}

/**
 * Extract route info from a method declaration node.
 */
function extractRouteInfo(methodNode: SyntaxNode): RouteInfo | null {
  const modifiers = methodNode.children.find(
    (c) => c.type === "modifiers",
  );
  if (!modifiers) return null;

  const annotations = extractAnnotations(modifiers);

  const routedAnnotation = annotations.find((a) => a.name === "Routed");
  if (!routedAnnotation) return null;

  const path = routedAnnotation.args["value"] ?? "";
  const loginRequired = annotations.some((a) => a.name === "LoginRequired");
  const permissions = annotations
    .filter((a) => a.name === "Permission")
    .map((a) => a.args["value"] ?? "")
    .filter((p) => p !== "");

  const methodNameNode = methodNode.children.find(
    (c) => c.type === "identifier",
  );
  const methodName = methodNameNode?.text ?? "";

  return { path, permissions, loginRequired, methodName };
}

/**
 * Extract field info from a field_declaration node.
 * Skips Mapping constants (those are extracted separately).
 */
function extractFieldInfo(
  fieldNode: SyntaxNode,
): { name: string; type: string; annotations: string[] } | null {
  // Skip Mapping constants
  if (extractMappingConstant(fieldNode) !== null) return null;

  const modifiers = fieldNode.children.find(
    (c) => c.type === "modifiers",
  );
  const annotationNames = modifiers ? extractAnnotationNames(modifiers) : [];

  // Get field type
  const typeNode = fieldNode.children.find(
    (c) =>
      c.type === "type_identifier" ||
      c.type === "generic_type" ||
      c.type === "integral_type" ||
      c.type === "floating_point_type" ||
      c.type === "boolean_type" ||
      c.type === "void_type" ||
      c.type === "array_type",
  );
  const type = typeNode?.text ?? "unknown";

  // Get field name
  const declarator = fieldNode.children.find(
    (c) => c.type === "variable_declarator",
  );
  const nameNode = declarator?.children.find(
    (c) => c.type === "identifier",
  );
  const name = nameNode?.text ?? "";

  if (!name) return null;

  return { name, type, annotations: annotationNames };
}

export async function parseJavaFile(source: string): Promise<JavaClassInfo> {
  const p = await getParser();
  const tree = p.parse(source);
  const root = tree.rootNode;

  // Extract package name
  let packageName = "";
  const pkgDecl = root.children.find(
    (c) => c.type === "package_declaration",
  );
  if (pkgDecl) {
    const scopedId = pkgDecl.children.find(
      (c) => c.type === "scoped_identifier" || c.type === "identifier",
    );
    if (scopedId) packageName = scopedId.text;
  }

  // Find the first class declaration
  const classDecl = root.children.find(
    (c) => c.type === "class_declaration",
  );

  if (!classDecl) {
    return {
      packageName,
      className: "",
      superClass: null,
      interfaces: [],
      annotations: [],
      mappings: [],
      routes: [],
      fields: [],
    };
  }

  // Extract class name
  const classNameNode = classDecl.children.find(
    (c) => c.type === "identifier",
  );
  const className = classNameNode?.text ?? "";

  // Extract superclass
  let superClass: string | null = null;
  const superclassNode = classDecl.childForFieldName("superclass");
  if (superclassNode) {
    // The superclass node contains "extends TypeName"
    // Find the type inside it
    const typeNode = superclassNode.children.find(
      (c) =>
        c.type === "type_identifier" ||
        c.type === "generic_type",
    );
    if (typeNode) {
      superClass = extractBaseTypeName(typeNode);
    }
  }

  // Extract interfaces
  const interfaces: string[] = [];
  const interfacesNode = classDecl.childForFieldName("interfaces");
  if (interfacesNode) {
    for (const child of interfacesNode.children) {
      if (
        child.type === "type_identifier" ||
        child.type === "generic_type"
      ) {
        interfaces.push(extractBaseTypeName(child));
      } else if (child.type === "type_list") {
        for (const typeChild of child.children) {
          if (
            typeChild.type === "type_identifier" ||
            typeChild.type === "generic_type"
          ) {
            interfaces.push(extractBaseTypeName(typeChild));
          }
        }
      }
    }
  }

  // Extract class-level annotations
  const modifiersNode = classDecl.children.find(
    (c) => c.type === "modifiers",
  );
  const annotations = modifiersNode
    ? extractAnnotations(modifiersNode)
    : [];

  // Extract class body contents
  const classBody = classDecl.children.find(
    (c) => c.type === "class_body",
  );
  const mappings: string[] = [];
  const routes: RouteInfo[] = [];
  const fields: Array<{ name: string; type: string; annotations: string[] }> =
    [];

  if (classBody) {
    for (const member of classBody.children) {
      if (member.type === "field_declaration") {
        // Check for Mapping constant
        const mappingName = extractMappingConstant(member);
        if (mappingName) {
          mappings.push(mappingName);
        } else {
          // Regular field
          const fieldInfo = extractFieldInfo(member);
          if (fieldInfo) {
            fields.push(fieldInfo);
          }
        }
      } else if (member.type === "method_declaration") {
        // Check for route
        const routeInfo = extractRouteInfo(member);
        if (routeInfo) {
          routes.push(routeInfo);
        }
      }
    }
  }

  return {
    packageName,
    className,
    superClass,
    interfaces,
    annotations,
    mappings,
    routes,
    fields,
  };
}
