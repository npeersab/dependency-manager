import nextPlugin from "eslint-config-next";

/** @type {import("eslint").Config[]} */
const config = [
  ...nextPlugin,
  // Generated Prisma client is gitignored and regenerated; don't lint it.
  { ignores: ["src/generated/**"] },
];

export default config;
