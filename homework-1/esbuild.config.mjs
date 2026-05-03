import esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

const sharedOptions = {
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
};

async function build() {
  const contexts = await Promise.all([
    esbuild.context({
      ...sharedOptions,
      entryPoints: ['public/js/dashboard.ts'],
      outfile: 'public/js/dashboard.bundle.js',
    }),
    esbuild.context({
      ...sharedOptions,
      entryPoints: ['public/js/docs.ts'],
      outfile: 'public/js/docs.bundle.js',
    }),
  ]);

  if (watch) {
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('[esbuild] watching...');
  } else {
    await Promise.all(
      contexts.map(ctx => ctx.rebuild().then(() => ctx.dispose())),
    );
    console.log('[esbuild] build complete');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
