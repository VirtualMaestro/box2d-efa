// Picks the build a host can run: wasm SIMD where it validates, otherwise the scalar build. Both give the same results
// where they were compared (README). Import box2d-efa/standard or box2d-efa/scalar to skip the check.
const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

export const hasSimd = () => WebAssembly.validate(SIMD);

export default async (options) => {
  const flavour = hasSimd() ? await import('./box2d.mjs') : await import('./box2d.scalar.mjs');
  return flavour.default(options);
};
