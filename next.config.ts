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
};

export default nextConfig;
