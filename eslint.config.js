import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['**/dist/**','**/dist-subpath/**','**/dist-pages/**','node_modules/**','palette-selector/**','test-results/**','.claude/**']}, ...tseslint.configs.recommended);
