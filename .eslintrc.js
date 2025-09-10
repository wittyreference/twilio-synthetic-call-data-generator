// ABOUTME: ESLint configuration for Node.js and Twilio Functions
// ABOUTME: Enforces code quality standards with Prettier integration

module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: [
    'prettier'
  ],
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'off', // Allow console.log in serverless functions
    'no-unused-vars': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  overrides: [
    {
      files: ['functions/**/*.js'],
      env: {
        node: true
      },
      globals: {
        Twilio: 'readonly',
        Runtime: 'readonly'
      },
      rules: {
        'no-undef': 'off' // Twilio runtime provides globals
      }
    },
    {
      files: ['tests/**/*.js', '**/*.test.js'],
      env: {
        jest: true
      }
    }
  ]
};