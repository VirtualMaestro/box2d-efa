# box2d-efa

[Box2D v3](https://github.com/erincatto/box2d) compiled to WebAssembly for the EFA project, with SIMD and without, no
threads. **It is built for EFA's needs:** it is public, but it does not promise general use, a stable API or support, and
it changes when EFA needs it to.

Nothing is forked. `scripts/versions.json` pins the sources, which are used unchanged:

| Source | What | Pin |
|---|---|---|
| [Birch-san/box2d3-wasm](https://github.com/Birch-san/box2d3-wasm) | the embind glue, as in its `v6.0.0` | `59223b1` |
| [Birch-san/box2d](https://github.com/Birch-san/box2d) | Box2D, with that binding's wasm fixes on top of upstream | `acb3554` |
| [Birch-san/box2cpp](https://github.com/Birch-san/box2cpp) | the C++ wrapper the glue uses | `82139be` |

The API is the one of the npm package `box2d3-wasm`, without `TaskSystem` and `b2CreateThreadedWorld`.

## What differs from `box2d3-wasm` 6.0.0

`box2d3-wasm` has `compat` (no SIMD) and `deluxe` (SIMD only with threads, which needs its worker file and cross-origin
isolation). This repository builds:

| Flavour | File | SIMD | wasm, gzip -9 | mjs, gzip -9 | Together, against `compat` |
|---|---|---|---|---|---|
| `standard` | `box2d.mjs`, `box2d.wasm` | yes | 484 915, 174 120 | 55 287, 14 168 | 188 288, -49.6 KB |
| `scalar` | `box2d.scalar.mjs`, `box2d.scalar.wasm` | no | 499 085, 182 558 | 55 301, 14 181 | 196 739, -41.2 KB |
| npm `compat` | | no | 611 964, 210 890 | 101 985, 27 046 | 237 936 |

- `-Os` with LTO instead of `-O3` with LTO; no `STACK_OVERFLOW_CHECK=2`; the JS is minified; no threads and no enkiTS.
- **No clock inside a step.** Box2D reads the clock around each stage, and in WebAssembly each read crosses into JS.
  `csrc/clock.cpp` and `--wrap=clock_gettime` make it read zero, so `b2World_GetProfile` is all zeros until
  `enableStepTimers(true)` is called. Results do not depend on it (`test/build.test.mjs`).
- `b2WorldDef.workerCount` must stay at its default: this build cannot start threads.

## Which build a host gets

`import Box2D from 'box2d-efa'` (`src/entry.mjs`) takes `standard` where `WebAssembly.validate` accepts SIMD, otherwise
`scalar`. `box2d-efa/standard` and `box2d-efa/scalar` skip the check.

## Results

The same per-tick hashes as Node, seven scenes (cars, pyramid, ragdolls, queries, terrain, platformer, pile):

- Both builds, and npm's `compat`, on Node, Bun, Chromium, Firefox, WebKit, an iPad (Safari 26), an iPhone 8 (iOS 16.7), and
  Firefox and Chrome on the phones below, except:
- **`standard` on Chrome 101, 32-bit ARM (Galaxy S7): two scenes differ** in both runs, the queries from tick 0 and the
  platformer from tick 2. The same build gives 7 of 7 on Chrome 138, 32-bit ARM (Galaxy J5). `scalar` is equal everywhere,
  so a game that needs the same results on every host uses `scalar`.
- Firefox on the J5 has no SIMD and cannot load `standard`.

On Node, `standard`, `scalar` and npm's `compat` give the same hashes as each other, tick by tick. The timing and the
files of these results are in the EFA repository, `research/probes/2026-11-physics-engines/open/box2d-build/`.

## Build

Git Bash, with emsdk 6.0.13; on Windows, cmake and ninja on the `PATH`:

```sh
source ~/emsdk/emsdk_env.sh
npm run fetch-deps
npm run build
npm test
```

`OPT=-O3 OUT=<folder> bash scripts/build.sh` makes a trial build and leaves `dist/` alone. CI builds and tests each push,
and a `v*` tag makes a [GitHub release](https://github.com/VirtualMaestro/box2d-efa/releases) with the files and their
`SHA256SUMS.txt`. Not on npm.

## License

MIT (`LICENSE`). Box2D is MIT, copyright Erin Catto (`LICENSE.box2d.txt`).
