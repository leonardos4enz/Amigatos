'use strict';
const js = require('@eslint/js');
const globals = require('globals');

// Regla de 3: cuando un mismo comentario de review aparezca 3 veces, conviértelo
// en una regla aquí para que el build falle en vez de depender de la memoria del agente.
module.exports = [
  { ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    // Servidor, tests y configuración: CommonJS en Node.
    files: ['server/**/*.js', 'test/**/*.js', 'e2e/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: globals.node },
    rules: {
      // ignoreRestSiblings: `const { secret, ...rest } = state` es la forma de quitar campos.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // Frontend: scripts clásicos del navegador que comparten globales entre archivos
    // (por eso no-undef y no-unused-vars no aplican aquí: un archivo define, otro usa).
    files: ['public/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser, io: 'readonly' } },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },
];
