/**
 * Ensures `onnxruntime-node` (package + linux/x64 native binding) exists
 * WITHOUT relying on its postinstall script.
 *
 * Background: the package downloads nothing for CPU at install time — the
 * linux binary is already bundled in the npm tarball — but some hosts gate
 * dependency install scripts and omit the package entirely. transformers.js
 * requires it unconditionally in Node, so a missing package breaks embeddings
 * at runtime with "Cannot find module 'onnxruntime-node'".
 *
 * This runs as part of `npm run build` (before Next traces files, so the
 * binding is present when tracing runs). It skips instantly when the binding
 * is already there (local dev, where postinstall ran normally).
 *
 * `ORT_FETCH_DEST` overrides the destination (used to test the fetch path
 * without touching real node_modules).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// Must match @huggingface/transformers' pinned expectation AND package.json.
const PKG = 'onnxruntime-node'
const VERSION = '1.30.0'

/** Binding path for THIS host (Vercel builds and runs linux/x64). */
function bindingRel() {
  return path.join(
    'bin',
    'napi-v6',
    os.platform(),
    os.arch(),
    'onnxruntime_binding.node',
  )
}

function destDir() {
  if (process.env.ORT_FETCH_DEST) {
    return path.resolve(process.env.ORT_FETCH_DEST)
  }
  return path.join(process.cwd(), 'node_modules', PKG)
}

function present(dir) {
  return fs.existsSync(path.join(dir, bindingRel()))
}

/**
 * Locates npm's own CLI so `pack` runs without a shell and without relying
 * on `npm` / `npm.cmd` resolving (Windows `.cmd` shims break naive spawns).
 */
function npmCli() {
  const candidates = [
    path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    ),
    path.join(
      path.dirname(process.execPath),
      '..',
      'lib',
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    ),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error('could not locate the npm CLI next to node')
}

function main() {
  const dest = destDir()

  if (present(dest)) {
    console.log(`[ort-fetch] native binding present at ${dest}, skipping.`)
    return
  }

  console.log(
    `[ort-fetch] binding missing, fetching ${PKG}@${VERSION} tarball...`,
  )

  // `npm pack` downloads without running any install scripts.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ort-fetch-'))

  try {
    execFileSync(process.execPath, [npmCli(), 'pack', `${PKG}@${VERSION}`], {
      cwd: tmp,
      stdio: 'inherit',
    })

    const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'))
    if (!tgz) throw new Error('npm pack produced no tarball')

    execFileSync('tar', ['-xzf', path.join(tmp, tgz), '-C', tmp], {
      stdio: 'inherit',
    })

    const pkgDir = path.join(tmp, 'package')
    fs.cpSync(pkgDir, dest, { recursive: true })

    // Slim to this host's platform. The tarball ships every OS/arch and a
    // serverless function only ever needs its own — the rest is dead weight
    // against the deploy size cap. (Local dev skips this whole path because
    // its binding is already present.)
    const napiDir = path.join(dest, 'bin', 'napi-v6')
    for (const platform of fs.readdirSync(napiDir, { withFileTypes: true })) {
      if (!platform.isDirectory()) continue
      const platformDir = path.join(napiDir, platform.name)
      if (platform.name !== os.platform()) {
        fs.rmSync(platformDir, { recursive: true, force: true })
        continue
      }
      for (const arch of fs.readdirSync(platformDir, {
        withFileTypes: true,
      })) {
        if (arch.isDirectory() && arch.name !== os.arch()) {
          fs.rmSync(path.join(platformDir, arch.name), {
            recursive: true,
            force: true,
          })
        }
      }
    }

    if (!present(dest)) {
      throw new Error('binding still missing after extract — aborting build')
    }
    console.log(
      `[ort-fetch] installed ${PKG}@${VERSION} with linux/x64 binding.`,
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

try {
  main()
} catch (err) {
  console.error('[ort-fetch] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
}
