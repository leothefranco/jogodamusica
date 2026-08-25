import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const specialFiles = [
  ["src/app/manifest.webmanifest/route.ts", ["GET"]],
  ["src/app/admin/manifest.webmanifest/route.ts", ["GET"]],
  ["src/app/api/admin/youtube/search/route.ts", ["GET"]],
  ["src/app/api/admin/youtube/resolve/route.ts", ["POST"]],
  ["src/app/api/admin/youtube/playlists/preview/route.ts", ["POST"]],
  ["src/app/api/admin/youtube/playlists/import/route.ts", ["POST"]],
] as const;

function hasExportModifier(node: ts.Node) {
  return ts.canHaveModifiers(node)
    ? (ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
        false)
    : false;
}

function exportedNames(source: ts.SourceFile) {
  return source.statements.flatMap((statement) => {
    if (!hasExportModifier(statement)) {
      return [];
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      return [statement.name.text];
    }

    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.flatMap((declaration) =>
        ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
      );
    }

    return [];
  });
}

describe("contrato dos arquivos especiais do Next.js", () => {
  it.each(specialFiles)("%s exporta somente %j", async (file, expected) => {
    const absolutePath = path.join(process.cwd(), file);
    const contents = await readFile(absolutePath, "utf8");
    const source = ts.createSourceFile(
      absolutePath,
      contents,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    expect(exportedNames(source)).toEqual(expected);
  });
});
