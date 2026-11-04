#!/usr/bin/env bash
# Build Box2D with emscripten and link the box2d3-wasm embind glue into ES modules (browser and Node). Both flavours are
# single-threaded: Box2D's source, its glue and box2cpp are used as pinned, unchanged (scripts/versions.json).
#
#   standard  wasm SIMD (dist/box2d.mjs)
#   scalar    no SIMD, Box2D's scalar math (dist/box2d.scalar.mjs)
#
# Usage:
#   scripts/build.sh
#   FLAVOURS=standard scripts/build.sh
#   OPT=-O3 OUT=/some/folder scripts/build.sh   a trial build that leaves dist/ alone
set -euo pipefail

# pwd -W gives a Windows path under Git Bash (MSYS), which the Windows emsdk tools need; elsewhere it fails and pwd runs.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && { pwd -W 2>/dev/null || pwd; })"
ROOT="$(dirname "$DIR")"

FLAVOURS="${FLAVOURS:-standard scalar}"
OPT="${OPT:--Os}"
OUT="${OUT:-$ROOT/dist}"
BOX2D="$ROOT/deps/box2d"
GLUE="$ROOT/deps/box2d3-wasm/box2d3-wasm"

[ -f "$BOX2D/CMakeLists.txt" ] && [ -f "$GLUE/csrc/glue.cpp" ] || { echo "deps missing. Run: npm run fetch-deps" >&2; exit 1; }
command -v emcc >/dev/null || { echo "emcc not found. Activate emsdk first." >&2; exit 1; }

mkdir -p "$OUT" "$ROOT/build"

for FLAVOUR in $FLAVOURS; do
  case "$FLAVOUR" in
    standard) BASENAME=box2d; DISABLE_SIMD=OFF; SIMD_FLAGS=(-msimd128 -msse2) ;;
    scalar) BASENAME=box2d.scalar; DISABLE_SIMD=ON; SIMD_FLAGS=() ;;
    *) echo "Unknown flavour: $FLAVOUR (expected standard or scalar)" >&2; exit 1 ;;
  esac
  CMAKE_BUILD_DIR="$ROOT/build/cmake-$FLAVOUR$OPT"

  echo "==> cmake ($FLAVOUR, $OPT)"
  # The wrapper project builds Box2D as a subproject: as the top level it would force pthreads on.
  emcmake cmake \
    -S "$GLUE/cmake" \
    -B "$CMAKE_BUILD_DIR" \
    -DBOX2D_DIR="$BOX2D" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-flto" \
    -DCMAKE_C_FLAGS_RELEASE="$OPT -DNDEBUG" \
    -DBOX2D_DISABLE_SIMD="$DISABLE_SIMD" \
    -DBOX2D_VALIDATE=OFF \
    > "$CMAKE_BUILD_DIR.cmake.log" 2>&1 || { cat "$CMAKE_BUILD_DIR.cmake.log" >&2; exit 1; }

  echo "==> build libbox2d.a ($FLAVOUR)"
  cmake --build "$CMAKE_BUILD_DIR" --target box2d -j"$(nproc)" > "$CMAKE_BUILD_DIR.build.log" 2>&1 \
    || { tail -50 "$CMAKE_BUILD_DIR.build.log" >&2; exit 1; }
  LIB="$CMAKE_BUILD_DIR/box2d/src/libbox2d.a"
  [ -f "$LIB" ] || { echo "missing $LIB" >&2; exit 1; }

  echo "==> emcc link ($FLAVOUR) -> $OUT/$BASENAME.mjs"
  # No threading.cpp and no enkiTS: this build has no threads. The upstream's STACK_OVERFLOW_CHECK=2 and --minify 0 are
  # left out as well.
  em++ -lembind "$GLUE/csrc/glue.cpp" "$GLUE/csrc/debugDraw.cpp" "$ROOT/csrc/clock.cpp" "$LIB" \
    -I "$BOX2D/include" \
    -I "$ROOT/deps/box2cpp/include" \
    -std=c++20 \
    -DNDEBUG \
    "$OPT" -flto \
    ${SIMD_FLAGS[@]+"${SIMD_FLAGS[@]}"} \
    -Wl,--wrap=clock_gettime \
    -sMODULARIZE=1 \
    -sEXPORT_ES6=1 \
    -sEXPORT_NAME=Box2D \
    -sENVIRONMENT=web,worker,node \
    -sALLOW_MEMORY_GROWTH=1 \
    -sALLOW_TABLE_GROWTH=1 \
    -sFILESYSTEM=0 \
    -sEXPORTED_FUNCTIONS=_malloc,_free \
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU16,HEAPU32,HEAPF32,stackSave,stackRestore,stackAlloc \
    -o "$OUT/$BASENAME.mjs"
done

cp "$ROOT/src/entry.mjs" "$OUT/entry.mjs"

echo "==> done"
for f in "$OUT"/box2d*.wasm "$OUT"/box2d*.mjs; do echo "$(basename "$f") $(wc -c < "$f") bytes, gzip $(gzip -9 -c "$f" | wc -c)"; done
