import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const sourceContracts = [
  {
    file: "vite.config.ts",
    required: [/base:\s*["']\.\//],
    forbidden: []
  },
  {
    file: "src/animation/scene-config.ts",
    required: [/\.\/assets\/generated\//],
    forbidden: [/["']\/assets\/generated\//]
  },
  {
    file: "src/animation/flat-assets.ts",
    required: [/FLAT_ASSET_ROOT\s*=\s*["']\.\/assets\/generated\/flat["']/],
    forbidden: [/["']\/assets\/generated\/flat["']/]
  },
  {
    file: "src/styles.css",
    required: [/url\(["']?\.\.\/assets\/generated\//],
    forbidden: [/url\(["']?\/assets\/generated\//]
  },
  {
    file: "src/components/MonitorShell.tsx",
    required: [/src=["']\.\/app-icon\.svg["']/],
    forbidden: [/src=["']\/app-icon\.svg["']/]
  }
];

function readRelative(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function assertSourceContracts() {
  const failures = [];

  for (const contract of sourceContracts) {
    const contents = readRelative(contract.file);

    for (const pattern of contract.required) {
      if (!pattern.test(contents)) {
        failures.push(`${contract.file} missing required pattern ${pattern}`);
      }
    }

    for (const pattern of contract.forbidden) {
      if (pattern.test(contents)) {
        failures.push(`${contract.file} contains forbidden packaged-unsafe pattern ${pattern}`);
      }
    }
  }

  return failures;
}

function assertBuiltIndexContract() {
  const indexPath = path.join(repoRoot, "dist", "index.html");
  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const failures = [];

  if (!/src=["']\.\/assets\/[^"']+\.js["']/.test(indexHtml)) {
    failures.push("dist/index.html script entry is not relative ./assets/*.js");
  }

  if (!/href=["']\.\/assets\/[^"']+\.css["']/.test(indexHtml)) {
    failures.push("dist/index.html stylesheet entry is not relative ./assets/*.css");
  }

  if (/src=["']\/assets\//.test(indexHtml) || /href=["']\/assets\//.test(indexHtml)) {
    failures.push("dist/index.html still contains absolute /assets entry URLs");
  }

  return failures;
}

function assertBuiltBundleContracts() {
  const assetsDir = path.join(repoRoot, "dist", "assets");
  if (!fs.existsSync(assetsDir)) {
    return [];
  }

  const failures = [];
  const builtFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith(".css") || file.endsWith(".js"));

  for (const builtFile of builtFiles) {
    const builtPath = path.join(assetsDir, builtFile);
    const contents = fs.readFileSync(builtPath, "utf8");

    if (/["']\/assets\/generated\//.test(contents)) {
      failures.push(`${path.relative(repoRoot, builtPath)} contains absolute /assets/generated runtime URL`);
    }

    if (/["']\/app-icon\.svg["']/.test(contents)) {
      failures.push(`${path.relative(repoRoot, builtPath)} contains absolute /app-icon.svg runtime URL`);
    }

    if (builtFile.endsWith(".css")) {
      if (/url\(["']?\/assets\//.test(contents)) {
        failures.push(`${path.relative(repoRoot, builtPath)} contains absolute url(/assets/...)`);
      }

      const urlMatches = contents.matchAll(/url\((["']?)([^"')]+)\1\)/g);
      for (const match of urlMatches) {
        const url = match[2];
        if (
          url.startsWith("data:") ||
          url.startsWith("http:") ||
          url.startsWith("https:") ||
          url.startsWith("#")
        ) {
          continue;
        }

        const targetPath = path.resolve(path.dirname(builtPath), url);
        if (!fs.existsSync(targetPath)) {
          failures.push(`${path.relative(repoRoot, builtPath)} references missing CSS asset ${url}`);
        }
      }
    }
  }

  return failures;
}

const failures = [...assertSourceContracts(), ...assertBuiltIndexContract(), ...assertBuiltBundleContracts()];

if (failures.length > 0) {
  console.error("Packaged asset path contract failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Packaged asset path contract passed.");
