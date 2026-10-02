# Four-layer solver

`engine.js` is derived from **@cubesmith/scrambler 0.14.1**, licensed under MIT; the complete upstream license is preserved in `LICENSE`.

Source: https://www.npmjs.com/package/@cubesmith/scrambler/v/0.14.1

Changes: remove the public scramble-registration entry point, export the internal 4×4 solver and test helpers, and tree-shake unused code with esbuild. The solving algorithms are unchanged. `topology.json` converts the upstream piece indices to this application's row-major URFDLB facelets. The upstream uses a different face order, UDFBLR.

Reproduce from the project root:

```sh
npm pack @cubesmith/scrambler@0.14.1
node scripts/vendor-four-solver.mjs cubesmith-scrambler-0.14.1.tgz
```

The generated file records the upstream source SHA-256. No upstream package or network service is needed at runtime. Initialization and solving run only in a Web Worker. This is a state solver: the input is decoded from all 96 facelets, with no scramble history required.
