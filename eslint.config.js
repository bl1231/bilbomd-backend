import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import jestPlugin from 'eslint-plugin-jest'
import importPlugin from 'eslint-plugin-import'

export default [
  { files: ['**/*.{ts}'] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ['dist/*', 'build/*', 'test/*'] },
  {
    plugins: {
      jest: jestPlugin,
      import: importPlugin
    }
  },
  {
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'always',
          jsx: 'always',
          ts: 'always',
          tsx: 'always',
          mjs: 'always'
        }
      ]
    }
  }
]
