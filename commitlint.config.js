module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',     // New feature
      'fix',      // Bug fix
      'refactor', // Code change that neither fixes a bug nor adds a feature
      'style',    // Formatting changes
      'test',     // Adding tests
      'docs',     // Documentation
      'chore',    // Maintenance
      'build',    // Build system or external dependencies
      'ci',       // CI/CD changes
      'perf',     // Performance improvements
      'revert',   // Revert previous commit
    ]],
    'scope-enum': [1, 'always', [
      'game',     // Game logic (quiplash, pixel-showdown, etc.)
      'ws',       // WebSocket server/client
      'audio',    // Audio system (narrator, sound effects)
      'ui',       // UI components
      'db',       // Database/Prisma
      'api',      // API routes
      'ci',       // CI/CD pipelines
      'debug',    // Debug tools (panel, command menu)
      'hooks',    // Git hooks configuration
      'deps',     // Dependencies
      'config',   // Configuration files
    ]],
  },
};
