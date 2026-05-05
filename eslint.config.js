const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    files: ['assets/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
