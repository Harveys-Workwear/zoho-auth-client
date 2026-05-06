/** @type {import('jest').Config} */
module.exports = {
  rootDir: "./tests",
  testEnvironment: "node",
  clearMocks: true,
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  moduleFileExtensions: ["ts", "js"],
  testMatch: ["**/*.test.ts"],
};