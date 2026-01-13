import esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['src/client/browser.ts'],
  bundle: true,
  outfile: 'client/secure-messenger-client.js',
  format: 'iife',
  globalName: 'SecureMessenger',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  define: {
    'process.env.NODE_ENV': '"production"',
    'global': 'globalThis',
  },
  inject: ['./browser-shim.js'],
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

console.log('Browser bundle built successfully');
