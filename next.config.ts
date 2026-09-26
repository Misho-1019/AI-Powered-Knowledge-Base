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
   * file tracing cannot see them. Force-include the linux/x64 pair for the
   * API routes that embed, or serverless instances would miss them at runtime.
   */
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*"],
  },
};

export default nextConfig;
