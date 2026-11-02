import {themeInitScript} from '@luca-style/react';

export default {
  plugins: [{
    name: 'luca-theme-init',
    transformIndexHtml: () => [{tag: 'script', children: themeInitScript({suite: 'professional'}), injectTo: 'head-prepend'}],
  }],
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && /"use client"/.test(warning.message)) return;
        warn(warning);
      },
    },
  },
};
