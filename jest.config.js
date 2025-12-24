module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/app.js", // exclude main app file if needed
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"], // if needed for setup
  testTimeout: 30000, // 30 seconds timeout for all tests
};
