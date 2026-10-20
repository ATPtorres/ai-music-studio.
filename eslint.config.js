import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import refresh from 'eslint-plugin-react-refresh'
export default tseslint.config({ ignores: ['dist', 'node_modules'] }, js.configs.recommended, ...tseslint.configs.recommended, { files: ['scripts/**/*.cjs'], languageOptions: { globals: globals.node }, rules: { '@typescript-eslint/no-require-imports': 'off' } }, { files: ['**/*.{ts,tsx}'], languageOptions: { globals: globals.browser }, plugins: { 'react-hooks': hooks, 'react-refresh': refresh }, rules: { ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } })
