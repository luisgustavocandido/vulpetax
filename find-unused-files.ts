/**
 * Script para identificar arquivos não utilizados no projeto Next.js
 * 
 * Uso:
 *   npx tsx find-unused-files.ts
 *   DRY_RUN=false npx tsx find-unused-files.ts  # Para realmente remover (CUIDADO!)
 * 
 * Modo seguro: DRY_RUN=true (padrão) - apenas lista arquivos, não remove
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative, resolve, dirname, extname } from "path";

const DRY_RUN = process.env.DRY_RUN !== "false";
const PROJECT_ROOT = resolve(__dirname);
const SRC_DIR = join(PROJECT_ROOT, "src");

// Extensões de arquivos TypeScript/JavaScript
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// Diretórios a ignorar
const IGNORE_DIRS = [
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  ".vercel",
];

// Padrões de arquivos a ignorar
const IGNORE_PATTERNS = [
  /\.d\.ts$/,           // Arquivos de declaração de tipos
  /next-env\.d\.ts$/,   // Arquivo gerado pelo Next.js
  /\.config\.(ts|js)$/, // Arquivos de configuração
];

interface FileInfo {
  path: string;
  relativePath: string;
  isEntrypoint: boolean;
  entrypointReason?: string;
  imports: Set<string>;
  importedBy: Set<string>;
}

class DependencyGraph {
  private files = new Map<string, FileInfo>();
  private pathAliases = new Map<string, string>();

  constructor() {
    this.loadPathAliases();
    this.scanFiles();
    this.buildDependencyGraph();
  }

  private loadPathAliases() {
    try {
      const tsconfigPath = join(PROJECT_ROOT, "tsconfig.json");
      if (existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
        const paths = tsconfig.compilerOptions?.paths || {};
        
        for (const [alias, pathArray] of Object.entries(paths)) {
          if (Array.isArray(pathArray) && pathArray.length > 0) {
            const resolved = resolve(PROJECT_ROOT, pathArray[0].replace("/*", ""));
            this.pathAliases.set(alias.replace("/*", ""), resolved);
          }
        }
      }
    } catch (error) {
      console.warn("⚠️  Não foi possível carregar tsconfig.json:", error);
    }
  }

  private scanFiles() {
    this.scanDirectory(SRC_DIR);
  }

  private scanDirectory(dir: string) {
    if (IGNORE_DIRS.some(ignore => dir.includes(ignore))) {
      return;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(SRC_DIR, fullPath);

      if (entry.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (SOURCE_EXTENSIONS.includes(ext)) {
          if (!IGNORE_PATTERNS.some(pattern => pattern.test(entry.name))) {
            const info: FileInfo = {
              path: fullPath,
              relativePath,
              isEntrypoint: this.isEntrypoint(fullPath, relativePath),
              imports: new Set(),
              importedBy: new Set(),
            };

            if (info.isEntrypoint) {
              info.entrypointReason = this.getEntrypointReason(fullPath, relativePath);
            }

            this.files.set(relativePath, info);
          }
        }
      }
    }
  }

  private isEntrypoint(filePath: string, relativePath: string): boolean {
    // Next.js App Router entrypoints - TODOS os arquivos em app/ são entrypoints potenciais
    if (relativePath.startsWith("app/")) {
      const parts = relativePath.split("/");
      const fileName = parts[parts.length - 1];
      
      // Arquivos especiais do Next.js App Router
      if (fileName === "page.tsx" || fileName === "page.ts") return true;
      if (fileName === "layout.tsx" || fileName === "layout.ts") return true;
      if (fileName === "route.ts" || fileName === "route.tsx") return true;
      if (fileName === "loading.tsx" || fileName === "loading.ts") return true;
      if (fileName === "not-found.tsx" || fileName === "not-found.ts") return true;
      if (fileName === "error.tsx" || fileName === "error.ts") return true;
      if (fileName === "template.tsx" || fileName === "template.ts") return true;
      if (fileName === "default.tsx" || fileName === "default.ts") return true;
      
      // Arquivos em app/api/*/route.ts são rotas API
      if (relativePath.includes("/api/") && fileName === "route.ts") return true;
    }

    // middleware.ts na raiz de src/
    if (relativePath === "middleware.ts") return true;

    // Arquivos referenciados em package.json scripts
    if (this.isReferencedInPackageJson(relativePath)) return true;

    return false;
  }

  private getEntrypointReason(filePath: string, relativePath: string): string {
    if (relativePath.includes("/app/")) {
      const fileName = relativePath.split("/").pop() || "";
      if (fileName === "page.tsx" || fileName === "page.ts") {
        return "Next.js page (App Router)";
      }
      if (fileName === "layout.tsx" || fileName === "layout.ts") {
        return "Next.js layout (App Router)";
      }
      if (fileName === "route.ts" || fileName === "route.tsx") {
        return "Next.js API route";
      }
      if (fileName === "loading.tsx" || fileName === "loading.ts") {
        return "Next.js loading component";
      }
      if (fileName === "not-found.tsx" || fileName === "not-found.ts") {
        return "Next.js not-found component";
      }
    }
    if (relativePath === "middleware.ts") {
      return "Next.js middleware";
    }
    if (this.isReferencedInPackageJson(relativePath)) {
      return "Referenciado em package.json scripts";
    }
    return "Entrypoint";
  }

  private isReferencedInPackageJson(relativePath: string): boolean {
    try {
      const packageJsonPath = join(PROJECT_ROOT, "package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      const scripts = packageJson.scripts || {};
      
      for (const script of Object.values(scripts)) {
        if (typeof script === "string" && script.includes(relativePath)) {
          return true;
        }
      }
    } catch {
      // Ignorar erros
    }
    return false;
  }

  private buildDependencyGraph() {
    for (const [relativePath, info] of this.files.entries()) {
      const imports = this.extractImports(info.path);
      for (const imp of imports) {
        const resolved = this.resolveImport(imp, info.path);
        if (resolved) {
          info.imports.add(resolved);
          const targetInfo = this.files.get(resolved);
          if (targetInfo) {
            targetInfo.importedBy.add(relativePath);
          }
        }
      }
    }
  }

  private extractImports(filePath: string): string[] {
    const imports: string[] = [];
    
    try {
      const content = readFileSync(filePath, "utf-8");
      
      // Static imports: import ... from "..."
      const staticImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?["']([^"']+)["']/g;
      let match;
      while ((match = staticImportRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // require(...)
      const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // Dynamic imports: import("...")
      const dynamicImportRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // Next.js dynamic imports: next/dynamic
      // Estes são tratados como usados se o componente existe
      const nextDynamicRegex = /next\/dynamic.*?["']([^"']+)["']/g;
      while ((match = nextDynamicRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    } catch (error) {
      console.warn(`⚠️  Erro ao ler ${filePath}:`, error);
    }

    return imports;
  }

  private resolveImport(importPath: string, fromFile: string): string | null {
    // Remover query strings e fragmentos
    importPath = importPath.split("?")[0].split("#")[0];

    // Ignorar imports de node_modules e pacotes externos
    if (!importPath.startsWith(".") && !importPath.startsWith("/") && !importPath.startsWith("@/")) {
      return null;
    }

    // Resolver alias @/
    if (importPath.startsWith("@/")) {
      const aliasPath = importPath.replace("@/", "");
      const resolved = resolve(SRC_DIR, aliasPath);
      return this.getRelativePath(resolved);
    }

    // Resolver imports relativos
    if (importPath.startsWith(".")) {
      const fromDir = dirname(fromFile);
      const resolved = resolve(fromDir, importPath);
      return this.getRelativePath(resolved);
    }

    return null;
  }

  private getRelativePath(absolutePath: string): string | null {
    // Tentar com diferentes extensões
    for (const ext of ["", ...SOURCE_EXTENSIONS]) {
      const pathWithExt = absolutePath + ext;
      if (existsSync(pathWithExt)) {
        return relative(SRC_DIR, pathWithExt);
      }
    }

    // Tentar como diretório com index
    for (const ext of SOURCE_EXTENSIONS) {
      const indexPath = join(absolutePath, `index${ext}`);
      if (existsSync(indexPath)) {
        return relative(SRC_DIR, indexPath);
      }
    }

    return null;
  }

  public findUnusedFiles(): FileInfo[] {
    const used = new Set<string>();
    const queue: string[] = [];

    // Adicionar todos os entrypoints à fila
    for (const [relativePath, info] of this.files.entries()) {
      if (info.isEntrypoint) {
        queue.push(relativePath);
        used.add(relativePath);
      }
    }

    // BFS a partir dos entrypoints
    while (queue.length > 0) {
      const current = queue.shift()!;
      const info = this.files.get(current);
      
      if (info) {
        for (const imported of info.imports) {
          if (!used.has(imported)) {
            used.add(imported);
            queue.push(imported);
          }
        }
      }
    }

    // Retornar arquivos não usados
    const unused: FileInfo[] = [];
    for (const [relativePath, info] of this.files.entries()) {
      if (!used.has(relativePath) && !info.isEntrypoint) {
        unused.push(info);
      }
    }

    return unused.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  public getStats() {
    const total = this.files.size;
    const entrypoints = Array.from(this.files.values()).filter(f => f.isEntrypoint).length;
    const used = new Set<string>();
    
    const queue: string[] = [];
    for (const [relativePath, info] of this.files.entries()) {
      if (info.isEntrypoint) {
        queue.push(relativePath);
        used.add(relativePath);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const info = this.files.get(current);
      if (info) {
        for (const imported of info.imports) {
          if (!used.has(imported)) {
            used.add(imported);
            queue.push(imported);
          }
        }
      }
    }

    return {
      total,
      entrypoints,
      used: used.size,
      unused: total - used.size,
    };
  }
}


// Execução principal
function main() {
  console.log("🔍 Analisando dependências do projeto...\n");

  const graph = new DependencyGraph();
  const unused = graph.findUnusedFiles();
  const stats = graph.getStats();

  console.log("📊 Estatísticas:");
  console.log(`   Total de arquivos: ${stats.total}`);
  console.log(`   Entrypoints: ${stats.entrypoints}`);
  console.log(`   Arquivos usados: ${stats.used}`);
  console.log(`   Arquivos não usados: ${stats.unused}\n`);

  if (unused.length === 0) {
    console.log("✅ Nenhum arquivo não utilizado encontrado!\n");
    return;
  }

  console.log(`⚠️  Encontrados ${unused.length} arquivo(s) possivelmente não utilizado(s):\n`);

  // Agrupar por diretório
  const byDir = new Map<string, FileInfo[]>();
  for (const file of unused) {
    const dir = dirname(file.relativePath);
    if (!byDir.has(dir)) {
      byDir.set(dir, []);
    }
    byDir.get(dir)!.push(file);
  }

  for (const [dir, files] of Array.from(byDir.entries()).sort()) {
    console.log(`📁 ${dir}/`);
    for (const file of files) {
      console.log(`   ❌ ${file.relativePath}`);
      console.log(`      Motivo: Não referenciado por nenhum arquivo`);
      if (file.importedBy.size > 0) {
        console.log(`      Importado por: ${Array.from(file.importedBy).join(", ")}`);
      }
    }
    console.log();
  }

  console.log("📝 Arquivos Entrypoints (NÃO podem ser removidos):");
  const allFiles = Array.from(graph["files"].values());
  const entrypoints = allFiles
    .filter(f => f.isEntrypoint)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  
  for (const file of entrypoints) {
    console.log(`   ✅ ${file.relativePath} (${file.entrypointReason})`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  ATENÇÃO:");
  console.log("   - Revise manualmente cada arquivo antes de remover");
  console.log("   - Alguns arquivos podem ser usados dinamicamente");
  console.log("   - Arquivos de tipos (.d.ts) são ignorados");
  console.log("   - Scripts em package.json são preservados");
  console.log("=".repeat(60) + "\n");

  if (DRY_RUN) {
    console.log("🔒 Modo DRY_RUN ativo - nenhum arquivo será removido");
    console.log("   Para remover arquivos, execute: DRY_RUN=false npx tsx find-unused-files.ts\n");
  } else {
    console.log("⚠️  DRY_RUN=false - arquivos serão removidos!");
    console.log("   Isso é PERMANENTE. Certifique-se de ter backup.\n");
    
    // Aqui poderia adicionar lógica de remoção, mas por segurança não vamos fazer isso automaticamente
    console.log("   Por segurança, a remoção automática está desabilitada.");
    console.log("   Remova manualmente os arquivos listados acima.\n");
  }
}

main();
