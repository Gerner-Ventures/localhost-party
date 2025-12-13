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
    ]],
  },
};
