import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import ts from "typescript";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");

function tryResolveFile(candidateBase) {
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.mjs`,
    path.join(candidateBase, "index.ts"),
    path.join(candidateBase, "index.tsx"),
    path.join(candidateBase, "index.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export {};",
        shortCircuit: true,
      };
    }

    if (specifier.startsWith("@/")) {
      const target = path.join(srcRoot, specifier.slice(2));
      const resolved = tryResolveFile(target);
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      context.parentURL.startsWith("file://")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const target = path.resolve(parentDir, specifier);
      const resolved = tryResolveFile(target);
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (url.startsWith("file://") && (url.endsWith(".ts") || url.endsWith(".tsx"))) {
      const filePath = fileURLToPath(url);
      if (!filePath.includes(`${path.sep}node_modules${path.sep}`)) {
        const source = fs.readFileSync(filePath, "utf8");
        const transpiled = ts.transpileModule(source, {
          fileName: filePath,
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            jsx: ts.JsxEmit.ReactJSX,
            esModuleInterop: true,
            inlineSourceMap: true,
          },
        });
        return {
          format: "module",
          source: transpiled.outputText,
          shortCircuit: true,
        };
      }
    }
    return nextLoad(url, context);
  },
});
