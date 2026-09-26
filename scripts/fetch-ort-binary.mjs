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

const BINDING_REL = path.join(
  'bin',
  'napi-v6',
  'linux',
  'x64',
  'onnxruntime_binding.node',
)
const NATIVE_LIB_REL = path.join(
  'bin',
  'napi-v6',
  'linux',
  'x64',
  'libonnxruntime.so.1',
)

function destDir() {
  if (process.env.ORT_FETCH_DEST) {
    return path.resolve(process.env.ORT_FETCH_DEST)
  }
  return path.join(process.cwd(), 'node_modules', PKG)
}

function present(dir) {
  return (
    fs.existsSync(path.join(dir, BINDING_REL)) &&
    fs.existsSync(path.join(dir, NATIVE_LIB_REL))
  )
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
