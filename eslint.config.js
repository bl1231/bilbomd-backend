import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
// import jestPlugin from 'eslint-plugin-jest'

export default [
  { files: ['**/*.{ts}'] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ['dist/*', 'build/*', 'test/*'] },
  {
    plugins: {
      // jest: jestPlugin
    }
  }
]
