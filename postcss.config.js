import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomMedia from 'postcss-custom-media';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const breakpoints = resolve(root, 'src/styles/design-system/breakpoints.css');

/** Resolve @custom-media in per-component CSS imports (Header.tsx, etc.). */
export default {
  plugins: [
    postcssGlobalData({ files: [breakpoints] }),
    postcssCustomMedia(),
  ],
};
