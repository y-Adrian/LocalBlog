import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dryRun = process.argv.includes("--dry-run")
let bytes = 0
let count = 0

async function sizeOf(target) {
  const stat = await fs.lstat(target)
  if (!stat.isDirectory() || stat.isSymbolicLink()) return stat.size
  const entries = await fs.readdir(target)
  const sizes = await Promise.all(entries.map((name) => sizeOf(path.join(target, name))))
  return sizes.reduce((sum, size) => sum + size, 0)
}

async function removeGenerated(relative) {
  const target = path.resolve(root, relative)
  const safe = path.relative(root, target)
  if (!safe || safe.startsWith("..") || path.isAbsolute(safe)) {
    throw new Error(`Refusing to remove outside the project: ${relative}`)
  }
  try {
    const size = await sizeOf(target)
    if (!dryRun) await fs.rm(target, { recursive: true, force: true })
    bytes += size
    count += 1
    console.log(`${dryRun ? "Would remove" : "Removed"} ${relative}`)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}

for (const target of ["public", "tsconfig.tsbuildinfo", "prof", "blog-activity.cache.json"]) {
  await removeGenerated(target)
}

// Preserve Quartz content backups; they are not compiler output.
for (const cache of ["quartz/.quartz-cache", ".quartz-cache"]) {
  try {
    if ((await fs.lstat(path.join(root, cache))).isSymbolicLink()) continue
    for (const entry of await fs.readdir(path.join(root, cache))) {
      if (entry !== "content-cache") await removeGenerated(path.join(cache, entry))
    }
    if (!dryRun && (await fs.readdir(path.join(root, cache))).length === 0) {
      await fs.rmdir(path.join(root, cache))
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}

const labBinaries = new Set(["app", "demo", "vtable_demo", "len_echo_client", "len_echo_server"])
async function walk(relative = "") {
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name)
    if (entry.name === ".git" || entry.name === "node_modules") continue
    if (entry.name === ".DS_Store") {
      await removeGenerated(name)
    } else if (
      name.startsWith(`labs${path.sep}`) &&
      ((entry.isDirectory() && entry.name.endsWith(".dSYM")) ||
        (entry.isFile() && (entry.name.endsWith(".o") || labBinaries.has(entry.name))))
    ) {
      await removeGenerated(name)
    } else if (entry.isDirectory() && entry.name !== "content-cache") {
      await walk(name)
    }
  }
}
await walk()
console.log(
  `${dryRun ? "Would clean" : "Cleaned"} ${count} generated paths (${(bytes / 1024 / 1024).toFixed(2)} MiB).`,
)
