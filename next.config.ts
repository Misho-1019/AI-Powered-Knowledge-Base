import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * transformers.js loads a native ONNX runtime. Bundling it breaks the
   * serverless build, so both packages are left external and required at
   * runtime instead.
   */
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
  /**
   * The native binding + shared library are loaded dynamically (dlopen), so
   * file tracing cannot see them. Force-include just the linux/x64 pair, and
   * only on the three routes that embed — a broad glob here correlates with
   * Vercel emitting extra functions, so keep this narrow and exact.
   * (`*` matches the literal `[id]` segment, avoiding bracket-escaping.)
   */
  outputFileTracingIncludes: {
    "/api/ask": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*",
    ],
    "/api/documents": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*",
    ],
    "/api/documents/*": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*",
    ],
  },
};

export default nextConfig;
