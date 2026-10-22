import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['**/dist/**','node_modules/**','palette-selector/**','test-results/**','.claude/**']}, ...tseslint.configs.recommended);
