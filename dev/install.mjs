import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function detectViteProject(root) {
  const packageJsonPath = join(root, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (!dependencies.vite) return null;

  const configPath = [
    "vite.config.ts", "vite.config.js", "vite.config.mts",
    "vite.config.mjs", "vite.config.cts", "vite.config.cjs",
  ].map((file) => join(root, file)).find(existsSync);

  return configPath ? { root, packageJsonPath, configPath } : null;
}

export function addSelectorPlugin(source, configName) {
  const commonJs = [".cjs", ".cts"].includes(extname(configName).toLowerCase());
  let output = source;

  if (!/from\s+["']selector\/dev["']|require\(["']selector\/dev["']\)/.test(output)) {
    const statement = commonJs
      ? "const selectorDev = require('selector/dev')"
      : "import selectorDev from 'selector/dev'";
    output = addImport(output, statement);
  }

  if (/\bselectorDev\s*\(/.test(output)) return output;

  const plugins = /plugins\s*:\s*\[/.exec(output);
  if (plugins) {
    const insertionPoint = plugins.index + plugins[0].length;
    return `${output.slice(0, insertionPoint)}selectorDev(), ${output.slice(insertionPoint)}`;
  }

  const configObject = /defineConfig\s*\(\s*\{/.exec(output);
  if (!configObject) {
    throw new Error("Could not find a plugins array or defineConfig object in the Vite config.");
  }

  const insertionPoint = configObject.index + configObject[0].length;
  return `${output.slice(0, insertionPoint)}\n  plugins: [selectorDev()],${output.slice(insertionPoint)}`;
}

export function installVite(project) {
  ensureBuild();
  installLocalPackage(project.root);

  const source = readFileSync(project.configPath, "utf8");
  const updated = addSelectorPlugin(source, basename(project.configPath));
  if (updated === source) {
    console.log("Selector is already configured.");
    return;
  }

  const backupPath = `${project.configPath}.selector.backup`;
  if (!existsSync(backupPath)) copyFileSync(project.configPath, backupPath);
  writeFileSync(project.configPath, updated, "utf8");
  console.log(`Updated ${relative(project.root, project.configPath)}`);
  console.log(`Backup: ${backupPath}`);
}

export function run(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log([
      "Usage: selector [project-directory]",
      "",
      "Adds the optional Selector shortcut to a Vite development server.",
      "The current directory is used when no project directory is provided.",
    ].join("\n"));
    return;
  }

  const requestedDirectory = argv.find((argument) => !argument.startsWith("-"));
  const projectDirectory = resolve(requestedDirectory || process.cwd());
  const project = detectViteProject(projectDirectory);

  console.log(`Checking ${projectDirectory}`);
  if (!project) {
    throw new Error("No Vite project with a vite.config file was found in this directory.");
  }

  installVite(project);
  console.log("\nDone. Start the development server and press Alt + Shift + S.\n");
}

function addImport(source, statement) {
  const imports = [...source.matchAll(/^import\s[^\n]+$/gm)];
  if (imports.length) {
    const last = imports.at(-1);
    const insertionPoint = last.index + last[0].length;
    return `${source.slice(0, insertionPoint)}\n${statement}${source.slice(insertionPoint)}`;
  }

  const directives = source.match(/^(?:["'][^"']+["'];?\s*)+/);
  const insertionPoint = directives ? directives[0].length : 0;
  return `${source.slice(0, insertionPoint)}${statement}\n${source.slice(insertionPoint)}`;
}

function ensureBuild() {
  if (existsSync(join(packageDirectory, "dist", "assets", "editor.js"))) return;
  const result = runNpm(["run", "build"], packageDirectory);
  if (result.status !== 0) throw new Error("Selector assets could not be built.");
}

function installLocalPackage(root) {
  const result = runNpm(["install", "--save-dev", packageDirectory], root);
  if (result.status !== 0) throw new Error("npm could not install the local Selector package.");
}

function runNpm(args, cwd) {
  if (process.platform === "win32") {
    return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm", ...args], {
      cwd,
      stdio: "inherit",
    });
  }
  return spawnSync("npm", args, { cwd, stdio: "inherit" });
}
