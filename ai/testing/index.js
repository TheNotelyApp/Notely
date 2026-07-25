/**
 * Testing Module Facade
 * Single entry point for prompt linting, safety invariant validation, and regression test harness.
 */

const PromptTester = require('./PromptTester');

module.exports = {
  PromptTester,

  createPromptTester: (loader) => new PromptTester(loader),
  runFullAudit: (loader) => {
    const tester = new PromptTester(loader);
    return tester.runFullAudit();
  }
};
