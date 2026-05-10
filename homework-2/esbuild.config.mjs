import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const sharedOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  minify: !isWatch,
  // Prevent backend imports from sneaking into frontend bundles
  external: [],
};

const ctx = await esbuild.context({
  ...sharedOptions,
  entryPoints: {
    index: 'public/js/index.ts',
    dashboard: 'public/js/dashboard.ts',
  },
  outdir: 'public/js/dist',
});

if (isWatch) {
  await ctx.watch();
  console.log('[esbuild] Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('[esbuild] Build complete');
}
