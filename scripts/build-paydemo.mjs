import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const variant = process.env.PAYDEMO_VARIANT ?? 'fixed-v2';
const allowedVariants = new Set(['buggy-v1', 'fixed-v2']);

if (!allowedVariants.has(variant)) {
  throw new Error(`Unsupported PAYDEMO_VARIANT: ${variant}`);
}

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolutePath);
    return [absolutePath];
  }));
  return files.flat();
};

execFileSync(process.execPath, ['--check', 'apps/paydemo/server.mjs'], { stdio: 'inherit' });

const sourceFiles = (await listFiles(join(root, 'apps/paydemo')))
  .map((file) => relative(root, file))
  .sort();
const hash = createHash('sha256');
for (const sourceFile of sourceFiles) {
  hash.update(sourceFile);
  hash.update('\0');
  hash.update(await readFile(join(root, sourceFile)));
  hash.update('\0');
}

const manifest = {
  app: 'PayDemo',
  variant,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  contentHash: `sha256:${hash.digest('hex')}`,
  sourceFiles,
};

const outputDirectory = join(root, 'dist/paydemo');
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(join(root, 'apps/paydemo/public'), join(outputDirectory, 'public'), { recursive: true });
await writeFile(join(outputDirectory, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built PayDemo ${manifest.variant} ${manifest.contentHash}`);
