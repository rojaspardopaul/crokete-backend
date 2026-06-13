import { defineConfig } from "vitest/config";

// Only the new TypeScript reference modules under src/ are tested.
// The legacy JS app (controller/, models/, lib/) is untouched and excluded.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: true,
  },
});
