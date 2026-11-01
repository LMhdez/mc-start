import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./cloudflare/wrangler.test.toml" }
    })
  ],
  test: {
    include: ["tests/cloudflare/**/*.test.js"],
    testTimeout: 30000
  }
});
