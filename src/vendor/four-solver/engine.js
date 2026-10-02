// Derived from @cubesmith/scrambler 0.14.1 (MIT). See LICENSE and README.md.
// Upstream dist/index.js SHA-256: 5dbe483b45de0d5cd58908aece8b1f4fb8f85a3b816f8f1d6f4cd58bb5b7606b

// <stdin>
function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function vecNegate(a) {
  return [-a[0], -a[1], -a[2]];
}
function vecHalve(a) {
  return [a[0] / 2, a[1] / 2, a[2] / 2];
}
function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function vecEquals(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function vecLess(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}
function vecKey(a) {
  return a.join(",");
}
function rotateQuarter(face, [x, y, z]) {
  switch (face) {
    case "U":
      return [-z, y, x];
    case "D":
      return [z, y, -x];
    case "F":
      return [y, -x, z];
    case "B":
      return [-y, x, z];
    case "R":
      return [x, z, -y];
    case "L":
      return [x, -z, y];
  }
}
var FACE_AXIS = {
  U: { index: 1, sign: 1 },
  D: { index: 1, sign: -1 },
  F: { index: 2, sign: 1 },
  B: { index: 2, sign: -1 },
  R: { index: 0, sign: 1 },
  L: { index: 0, sign: -1 }
};
function rotate120(axis, v, sign) {
  const d = vecDot(axis, v);
  const c = vecCross(axis, v);
  const out = [
    (-v[0] + axis[0] * d + sign * c[0]) / 2,
    (-v[1] + axis[1] * d + sign * c[1]) / 2,
    (-v[2] + axis[2] * d + sign * c[2]) / 2
  ];
  if (!out.every(Number.isInteger)) {
    throw new Error(
      `vec3: rotating [${v.join(",")}] about [${axis.join(",")}] left the integer lattice`
    );
  }
  return out;
}
var CORNER_POSITIONS = [
  [1, 1, 1],
  // 0 URF
  [-1, 1, 1],
  // 1 UFL
  [-1, 1, -1],
  // 2 ULB
  [1, 1, -1],
  // 3 UBR
  [1, -1, 1],
  // 4 DFR
  [-1, -1, 1],
  // 5 DLF
  [-1, -1, -1],
  // 6 DBL
  [1, -1, -1]
  // 7 DRB
];
var EDGE_POSITIONS = [
  [1, 1, 0],
  // 0 UR
  [0, 1, 1],
  // 1 UF
  [-1, 1, 0],
  // 2 UL
  [0, 1, -1],
  // 3 UB
  [1, -1, 0],
  // 4 DR
  [0, -1, 1],
  // 5 DF
  [-1, -1, 0],
  // 6 DL
  [0, -1, -1],
  // 7 DB
  [1, 0, 1],
  // 8 FR
  [-1, 0, 1],
  // 9 FL
  [-1, 0, -1],
  // 10 BL
  [1, 0, -1]
  // 11 BR
];
var ROTATIONS = {
  U: (v) => rotateQuarter("U", v),
  D: (v) => rotateQuarter("D", v),
  F: (v) => rotateQuarter("F", v),
  B: (v) => rotateQuarter("B", v),
  R: (v) => rotateQuarter("R", v),
  L: (v) => rotateQuarter("L", v)
};
var LAYER_COORDINATE = {
  U: { axisIndex: 1, requiredValue: 1 },
  D: { axisIndex: 1, requiredValue: -1 },
  F: { axisIndex: 2, requiredValue: 1 },
  B: { axisIndex: 2, requiredValue: -1 },
  R: { axisIndex: 0, requiredValue: 1 },
  L: { axisIndex: 0, requiredValue: -1 }
};
function isOnLayer(face, position) {
  const { axisIndex, requiredValue } = LAYER_COORDINATE[face];
  return position[axisIndex] === requiredValue;
}
function findIndex(positions, target) {
  const index = positions.findIndex((p) => vecEquals(p, target));
  if (index === -1) {
    throw new Error(`geometry: no cube position matches vector [${target.join(",")}]`);
  }
  return index;
}
function cornerCyclicAxes(position) {
  const chirality = position[0] * position[1] * position[2];
  return chirality === 1 ? ["Y", "X", "Z"] : ["Y", "Z", "X"];
}
function axisVector(position, axis) {
  if (axis === "X") return [position[0], 0, 0];
  if (axis === "Y") return [0, position[1], 0];
  return [0, 0, position[2]];
}
function deriveCornerTable(face) {
  const rotate = ROTATIONS[face];
  const destination = [];
  const twist = [];
  for (let i = 0; i < CORNER_POSITIONS.length; i += 1) {
    const from = CORNER_POSITIONS[i];
    if (!isOnLayer(face, from)) {
      destination[i] = i;
      twist[i] = 0;
      continue;
    }
    const to = rotate(from);
    const j = findIndex(CORNER_POSITIONS, to);
    destination[i] = j;
    const fromAxes = cornerCyclicAxes(from);
    const toAxes = cornerCyclicAxes(to);
    const referenceO0 = axisVector(from, fromAxes[0]);
    const transformed = rotate(referenceO0);
    let matched = null;
    for (let o = 0; o < 3; o += 1) {
      const expected = axisVector(to, toAxes[o]);
      if (vecEquals(transformed, expected)) {
        matched = o;
        break;
      }
    }
    if (matched === null) {
      throw new Error(
        `geometry: ${face} produced an inconsistent corner orientation for position ${i}`
      );
    }
    twist[i] = matched;
  }
  return { destination, twist };
}
function deriveEdgeTable(face) {
  const rotate = ROTATIONS[face];
  const destination = [];
  const flip = [];
  const flips = face === "F" || face === "B";
  for (let i = 0; i < EDGE_POSITIONS.length; i += 1) {
    const from = EDGE_POSITIONS[i];
    if (!isOnLayer(face, from)) {
      destination[i] = i;
      flip[i] = 0;
      continue;
    }
    const to = rotate(from);
    destination[i] = findIndex(EDGE_POSITIONS, to);
    flip[i] = flips ? 1 : 0;
  }
  return { destination, flip };
}
function deriveBaseMoveTable(face) {
  const corners2 = deriveCornerTable(face);
  const edges = deriveEdgeTable(face);
  return {
    face,
    cornerDestination: corners2.destination,
    cornerTwist: corners2.twist,
    edgeDestination: edges.destination,
    edgeFlip: edges.flip
  };
}
var CORNER_COUNT_222 = 8;
var SOLVED_222_STATE = {
  cornerPermutation: [0, 1, 2, 3, 4, 5, 6, 7],
  cornerOrientation: [0, 0, 0, 0, 0, 0, 0, 0]
};
var BASE_FACES = ["U", "R", "F"];
function composeSelf(base, times) {
  let destination = Array.from({ length: CORNER_COUNT_222 }, (_, i) => i);
  let twist = new Array(CORNER_COUNT_222).fill(0);
  for (let t = 0; t < times; t += 1) {
    const nextDestination = new Array(CORNER_COUNT_222);
    const nextTwist2 = new Array(CORNER_COUNT_222);
    for (let i = 0; i < CORNER_COUNT_222; i += 1) {
      const mid = destination[i];
      nextDestination[i] = base.cornerDestination[mid];
      nextTwist2[i] = (twist[i] + base.cornerTwist[mid]) % 3;
    }
    destination = nextDestination;
    twist = nextTwist2;
  }
  return { cornerDestination: destination, cornerTwist: twist };
}
function buildMoveTables222() {
  const tables4 = /* @__PURE__ */ new Map();
  for (const face of BASE_FACES) {
    const base = deriveBaseMoveTable(face);
    for (const amount of [1, 2, 3]) {
      tables4.set(`${face}${amount}`, composeSelf(base, amount));
    }
  }
  return tables4;
}
var MOVE_TABLES_222 = buildMoveTables222();
function allMoves222() {
  const moves = [];
  for (const face of BASE_FACES) {
    for (const amount of [1, 2, 3]) moves.push({ face, amount });
  }
  return moves;
}
var UINT32_RANGE = 4294967296;
function randomInt(random, maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`randomInt: maxExclusive must be a positive integer, got ${maxExclusive}`);
  }
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  let value;
  do {
    value = random.nextUint32();
  } while (value >= limit);
  return value % maxExclusive;
}
var MOVABLE_POSITIONS = [0, 1, 2, 3, 4, 5, 7];
var MOVABLE_COUNT = MOVABLE_POSITIONS.length;
var ORIENTATION_FREE_SLOTS = MOVABLE_COUNT - 1;
function toDenseValue(piece) {
  return piece === 7 ? 6 : piece;
}
function generatePermutations(n) {
  const elements = Array.from({ length: n }, (_, i) => i);
  const results = [];
  function recurse(current, remaining) {
    if (remaining.length === 0) {
      results.push(current);
      return;
    }
    for (let i = 0; i < remaining.length; i += 1) {
      const next = remaining[i];
      recurse([...current, next], [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
    }
  }
  recurse([], elements);
  return results;
}
var PERMUTATIONS_7 = generatePermutations(MOVABLE_COUNT);
var CORNER_PERM_222_STATES = PERMUTATIONS_7.length;
var permutation7Index = new Map(
  PERMUTATIONS_7.map((perm, index) => [perm.join(","), index])
);
function cornerPerm222Coord(cornerPermutation) {
  const dense = MOVABLE_POSITIONS.map((pos) => toDenseValue(cornerPermutation[pos]));
  const key = dense.join(",");
  const index = permutation7Index.get(key);
  if (index === void 0) {
    throw new Error(`coordinates-222: "${key}" is not a valid permutation of the 7 movable corners`);
  }
  return index;
}
var CORNER_ORIENTATION_222_STATES = 3 ** ORIENTATION_FREE_SLOTS;
function cornerOrientation222Coord(cornerOrientation) {
  let coord = 0;
  for (let i = 0; i < ORIENTATION_FREE_SLOTS; i += 1) {
    coord = coord * 3 + cornerOrientation[MOVABLE_POSITIONS[i]];
  }
  return coord;
}
var SOLVED_CORNER_PERM_222_COORD = cornerPerm222Coord(SOLVED_222_STATE.cornerPermutation);
var SOLVED_CORNER_ORIENTATION_222_COORD = cornerOrientation222Coord(
  SOLVED_222_STATE.cornerOrientation
);
var ALL_MOVES_222 = allMoves222();
var MOVE_COUNT_222 = ALL_MOVES_222.length;
var moveIndexByKey = new Map(
  ALL_MOVES_222.map((move, i) => [`${move.face}${move.amount}`, i])
);
var DEFAULT_MOVE_ORDER_222 = ALL_MOVES_222.map((_, i) => i);
var FACES = ["U", "D", "F", "B", "L", "R"];
var AMOUNTS = [1, 2, 3];
var AXIS_BY_FACE = {
  U: "UD",
  D: "UD",
  R: "RL",
  L: "RL",
  F: "FB",
  B: "FB"
};
function axisOf(face) {
  return AXIS_BY_FACE[face];
}
function parseMove(token) {
  const match = /^([UDFBLR])(2|')?$/.exec(token);
  if (!match) {
    throw new Error(`notation: "${token}" is not a valid face-move token`);
  }
  const face = match[1];
  const suffix = match[2];
  const amount = suffix === "2" ? 2 : suffix === "'" ? 3 : 1;
  return { face, amount };
}
function randomPermutation(random, n) {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = randomInt(random, i + 1);
    const temp = perm[i];
    perm[i] = perm[j];
    perm[j] = temp;
  }
  return perm;
}
function allPermutations(n) {
  const results = [];
  const current = [];
  const used = new Array(n).fill(false);
  function recurse() {
    if (current.length === n) {
      results.push([...current]);
      return;
    }
    for (let i = 0; i < n; i += 1) {
      if (used[i]) continue;
      used[i] = true;
      current.push(i);
      recurse();
      current.pop();
      used[i] = false;
    }
  }
  recurse();
  return results;
}
function composeSelf2(base, times) {
  let cornerDestination = [...base.cornerDestination];
  let cornerTwist = base.cornerDestination.map(() => 0);
  let edgeDestination = [...base.edgeDestination];
  let edgeFlip = base.edgeDestination.map(() => 0);
  for (let i = 0; i < base.cornerDestination.length; i += 1) {
    cornerDestination[i] = i;
  }
  for (let i = 0; i < base.edgeDestination.length; i += 1) {
    edgeDestination[i] = i;
  }
  for (let t = 0; t < times; t += 1) {
    const nextCornerDestination = cornerDestination.map(() => 0);
    const nextCornerTwist = cornerTwist.map(() => 0);
    for (let i = 0; i < cornerDestination.length; i += 1) {
      const mid = cornerDestination[i];
      const dest = base.cornerDestination[mid];
      nextCornerDestination[i] = dest;
      nextCornerTwist[i] = (cornerTwist[i] + base.cornerTwist[mid]) % 3;
    }
    cornerDestination = nextCornerDestination;
    cornerTwist = nextCornerTwist;
    const nextEdgeDestination = edgeDestination.map(() => 0);
    const nextEdgeFlip = edgeFlip.map(() => 0);
    for (let i = 0; i < edgeDestination.length; i += 1) {
      const mid = edgeDestination[i];
      const dest = base.edgeDestination[mid];
      nextEdgeDestination[i] = dest;
      nextEdgeFlip[i] = (edgeFlip[i] + base.edgeFlip[mid]) % 2;
    }
    edgeDestination = nextEdgeDestination;
    edgeFlip = nextEdgeFlip;
  }
  return {
    face: base.face,
    amount: times,
    cornerDestination,
    cornerTwist,
    edgeDestination,
    edgeFlip
  };
}
function buildMoveTables() {
  const tables4 = /* @__PURE__ */ new Map();
  for (const face of FACES) {
    const base = deriveBaseMoveTable(face);
    for (const amount of AMOUNTS) {
      const table4 = composeSelf2(base, amount);
      tables4.set(moveKey({ face, amount }), table4);
    }
  }
  return tables4;
}
function moveKey(move) {
  return `${move.face}${move.amount}`;
}
var MOVE_TABLES = buildMoveTables();
function getMoveTable(move) {
  const table4 = MOVE_TABLES.get(moveKey(move));
  if (!table4) {
    throw new Error(`move-tables: no table for move ${moveKey(move)}`);
  }
  return table4;
}
function allFaceMoves() {
  const moves = [];
  for (const face of FACES) {
    for (const amount of AMOUNTS) moves.push({ face, amount });
  }
  return moves;
}
var CORNER_COUNT = 8;
var EDGE_COUNT = 12;
var SOLVED_STATE = {
  cornerPermutation: [0, 1, 2, 3, 4, 5, 6, 7],
  cornerOrientation: [0, 0, 0, 0, 0, 0, 0, 0],
  edgePermutation: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  edgeOrientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
function applyTable(state, table4) {
  const cornerPermutation = new Array(CORNER_COUNT);
  const cornerOrientation = new Array(CORNER_COUNT);
  const edgePermutation = new Array(EDGE_COUNT);
  const edgeOrientation = new Array(EDGE_COUNT);
  for (let i = 0; i < CORNER_COUNT; i += 1) {
    const dest = table4.cornerDestination[i];
    cornerPermutation[dest] = state.cornerPermutation[i];
    cornerOrientation[dest] = (state.cornerOrientation[i] + table4.cornerTwist[i]) % 3;
  }
  for (let i = 0; i < EDGE_COUNT; i += 1) {
    const dest = table4.edgeDestination[i];
    edgePermutation[dest] = state.edgePermutation[i];
    edgeOrientation[dest] = (state.edgeOrientation[i] + table4.edgeFlip[i]) % 2;
  }
  return { cornerPermutation, cornerOrientation, edgePermutation, edgeOrientation };
}
function applyMove(state, move) {
  return applyTable(state, getMoveTable(move));
}
function applyMoves(state, moves) {
  return moves.reduce(applyMove, state);
}
function maxDepthForSize(size) {
  if (!Number.isInteger(size) || size < 2) {
    throw new Error(`nxn-notation: cube size must be an integer of at least 2, got ${size}`);
  }
  return Math.floor(size / 2);
}
function allMovesForSize(size) {
  const maxDepth = maxDepthForSize(size);
  const moves = [];
  for (const face of FACES) {
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      for (const amount of AMOUNTS) moves.push({ face, depth, amount });
    }
  }
  return moves;
}
function moveAxis(move) {
  if (move.face === "R" || move.face === "L") return "x";
  if (move.face === "U" || move.face === "D") return "y";
  return "z";
}
function moveLayerSet(move) {
  return `${move.face}${move.depth}`;
}
var FACE_NORMALS = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0]
};
new Map(
  Object.keys(FACE_NORMALS).map((face) => [vecKey(FACE_NORMALS[face]), face])
);
function centerCoordinates(size) {
  return Array.from({ length: size }, (_, i) => 2 * i - size + 1);
}
function buildFacelets(size) {
  maxDepthForSize(size);
  const coordinates = centerCoordinates(size);
  const facelets = [];
  for (const face of Object.keys(FACE_NORMALS)) {
    const normal = FACE_NORMALS[face];
    const { index } = FACE_AXIS[face];
    const spans = [0, 1, 2].filter((axis) => axis !== index);
    for (const a of coordinates) {
      for (const b of coordinates) {
        const center = [0, 0, 0];
        center[index] = normal[index] * (size - 1);
        center[spans[0]] = a;
        center[spans[1]] = b;
        const position = [
          center[0] + normal[0],
          center[1] + normal[1],
          center[2] + normal[2]
        ];
        facelets.push({ position, normal, face });
      }
    }
  }
  return facelets;
}
function faceletKey(facelet) {
  return `${vecKey(facelet.position)}|${vecKey(facelet.normal)}`;
}
function inBlock(facelet, face, depth, size) {
  const { index, sign } = FACE_AXIS[face];
  const center = facelet.position[index] - facelet.normal[index];
  return sign * center >= size - 2 * depth + 1;
}
function deriveFaceletPermutation(facelets, move, size) {
  const slotByKey = new Map(facelets.map((f, i) => [faceletKey(f), i]));
  const destination = new Array(facelets.length);
  for (let i = 0; i < facelets.length; i += 1) {
    const facelet = facelets[i];
    if (!inBlock(facelet, move.face, move.depth, size)) {
      destination[i] = i;
      continue;
    }
    let position = facelet.position;
    let normal = facelet.normal;
    for (let turn = 0; turn < move.amount; turn += 1) {
      position = rotateQuarter(move.face, position);
      normal = rotateQuarter(move.face, normal);
    }
    const slot = slotByKey.get(faceletKey({ position, normal }));
    if (slot === void 0) {
      throw new Error(
        `nxn-geometry: ${move.face} carried a facelet off the cube (size ${size}, depth ${move.depth})`
      );
    }
    destination[i] = slot;
  }
  return destination;
}
var CORNER_TWIST_SLOTS = CORNER_COUNT - 1;
var EDGE_FLIP_SLOTS = EDGE_COUNT - 1;
var CORNER_ORIENTATION_STATES = 3 ** CORNER_TWIST_SLOTS;
var EDGE_ORIENTATION_STATES = 2 ** EDGE_FLIP_SLOTS;
function cornerOrientationCoord(cornerOrientation) {
  let coord = 0;
  for (let i = 0; i < CORNER_TWIST_SLOTS; i += 1) {
    coord = coord * 3 + cornerOrientation[i];
  }
  return coord;
}
function decodeCornerOrientationCoord(coord) {
  const orientation = new Array(CORNER_COUNT).fill(0);
  let remaining = coord;
  let sum = 0;
  for (let i = CORNER_TWIST_SLOTS - 1; i >= 0; i -= 1) {
    const digit = remaining % 3;
    orientation[i] = digit;
    sum += digit;
    remaining = (remaining - digit) / 3;
  }
  orientation[CORNER_COUNT - 1] = (3 - sum % 3) % 3;
  return orientation;
}
function edgeOrientationCoord(edgeOrientation) {
  let coord = 0;
  for (let i = 0; i < EDGE_FLIP_SLOTS; i += 1) {
    coord = coord * 2 + edgeOrientation[i];
  }
  return coord;
}
function decodeEdgeOrientationCoord(coord) {
  const orientation = new Array(EDGE_COUNT).fill(0);
  let remaining = coord;
  let sum = 0;
  for (let i = EDGE_FLIP_SLOTS - 1; i >= 0; i -= 1) {
    const digit = remaining % 2;
    orientation[i] = digit;
    sum += digit;
    remaining = (remaining - digit) / 2;
  }
  orientation[EDGE_COUNT - 1] = sum % 2;
  return orientation;
}
var SLICE_EDGE_PIECES = /* @__PURE__ */ new Set([8, 9, 10, 11]);
function generateCombinations(n, k) {
  const results = [];
  const current = [];
  function recurse(start) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < n; i += 1) {
      current.push(i);
      recurse(i + 1);
      current.pop();
    }
  }
  recurse(0);
  return results;
}
var UD_SLICE_COMBINATIONS = generateCombinations(EDGE_COUNT, 4);
var UD_SLICE_STATES = UD_SLICE_COMBINATIONS.length;
var udSliceCombinationIndex = new Map(
  UD_SLICE_COMBINATIONS.map((combination, index) => [combination.join(","), index])
);
function udSliceCoord(edgePermutation) {
  const positions = [];
  for (let pos = 0; pos < EDGE_COUNT; pos += 1) {
    if (SLICE_EDGE_PIECES.has(edgePermutation[pos])) positions.push(pos);
  }
  const key = positions.join(",");
  const index = udSliceCombinationIndex.get(key);
  if (index === void 0) {
    throw new Error(`coordinates: "${key}" is not a valid 4-of-12 slice-edge combination`);
  }
  return index;
}
function decodeUdSliceCoord(coord) {
  const combination = UD_SLICE_COMBINATIONS[coord];
  if (!combination) {
    throw new Error(`coordinates: udSliceCoord ${coord} is out of range [0, ${UD_SLICE_STATES})`);
  }
  return combination;
}
function toPhase1Coordinate(state) {
  return {
    twist: cornerOrientationCoord(state.cornerOrientation),
    flip: edgeOrientationCoord(state.edgeOrientation),
    udSlice: udSliceCoord(state.edgePermutation)
  };
}
var SOLVED_UD_SLICE_COORD = udSliceCoord(SOLVED_STATE.edgePermutation);
function isInG1(coordinate) {
  return coordinate.twist === 0 && coordinate.flip === 0 && coordinate.udSlice === SOLVED_UD_SLICE_COORD;
}
var ALL_MOVES = allFaceMoves();
var MOVE_COUNT = ALL_MOVES.length;
function stateForTwist(coord) {
  return { ...SOLVED_STATE, cornerOrientation: decodeCornerOrientationCoord(coord) };
}
function stateForFlip(coord) {
  return { ...SOLVED_STATE, edgeOrientation: decodeEdgeOrientationCoord(coord) };
}
function edgePermutationForUdSlice(positions) {
  const permutation = new Array(EDGE_COUNT).fill(-1);
  const slicePieces = [8, 9, 10, 11];
  positions.forEach((pos, i) => {
    permutation[pos] = slicePieces[i];
  });
  const nonSlicePositions = Array.from({ length: EDGE_COUNT }, (_, i) => i).filter(
    (i) => !positions.includes(i)
  );
  const nonSlicePieces = [0, 1, 2, 3, 4, 5, 6, 7];
  nonSlicePositions.forEach((pos, i) => {
    permutation[pos] = nonSlicePieces[i];
  });
  return permutation;
}
function stateForUdSlice(coord) {
  const positions = decodeUdSliceCoord(coord);
  return { ...SOLVED_STATE, edgePermutation: edgePermutationForUdSlice(positions) };
}
function buildTable2(states, stateForCoord, encode) {
  const table4 = [];
  for (let m = 0; m < MOVE_COUNT; m += 1) {
    const row = new Array(states);
    const move = ALL_MOVES[m];
    for (let coord = 0; coord < states; coord += 1) {
      const next = applyMove(stateForCoord(coord), move);
      row[coord] = encode(next);
    }
    table4.push(row);
  }
  return table4;
}
var twistTable = null;
var flipTable = null;
var udSliceTable = null;
function getTwistTable() {
  return twistTable ??= buildTable2(
    CORNER_ORIENTATION_STATES,
    stateForTwist,
    (s) => cornerOrientationCoord(s.cornerOrientation)
  );
}
function getFlipTable() {
  return flipTable ??= buildTable2(
    EDGE_ORIENTATION_STATES,
    stateForFlip,
    (s) => edgeOrientationCoord(s.edgeOrientation)
  );
}
function getUdSliceTable() {
  return udSliceTable ??= buildTable2(
    UD_SLICE_STATES,
    stateForUdSlice,
    (s) => udSliceCoord(s.edgePermutation)
  );
}
var moveIndexByKey2 = new Map(ALL_MOVES.map((move, i) => [moveKey(move), i]));
function moveIndex2(move) {
  const index = moveIndexByKey2.get(moveKey(move));
  if (index === void 0) {
    throw new Error(`phase1-tables: no move index for ${moveKey(move)}`);
  }
  return index;
}
function nextTwist(coord, move) {
  return getTwistTable()[moveIndex2(move)][coord];
}
function nextFlip(coord, move) {
  return getFlipTable()[moveIndex2(move)][coord];
}
function nextUdSlice(coord, move) {
  return getUdSliceTable()[moveIndex2(move)][coord];
}
function buildPhase1Tables() {
  getTwistTable();
  getFlipTable();
  getUdSliceTable();
}
var UNVISITED2 = 255;
function buildPruningTable2(dimA, dimB, next, targetA, targetB) {
  const table4 = new Uint8Array(dimA * dimB).fill(UNVISITED2);
  const startIndex = targetA * dimB + targetB;
  table4[startIndex] = 0;
  let frontier = [startIndex];
  let depth = 0;
  let visited = 1;
  const total = dimA * dimB;
  while (frontier.length > 0 && visited < total) {
    const nextFrontier = [];
    for (const index of frontier) {
      const a = Math.floor(index / dimB);
      const b = index % dimB;
      for (const move of ALL_MOVES) {
        const [na, nb] = next(a, b, move);
        const nIndex = na * dimB + nb;
        if (table4[nIndex] === UNVISITED2) {
          table4[nIndex] = depth + 1;
          nextFrontier.push(nIndex);
          visited += 1;
        }
      }
    }
    frontier = nextFrontier;
    depth += 1;
  }
  return table4;
}
var twistUdSliceTable = null;
var flipUdSliceTable = null;
function getTwistUdSliceTable() {
  return twistUdSliceTable ??= buildPruningTable2(
    CORNER_ORIENTATION_STATES,
    UD_SLICE_STATES,
    (twist, udSlice, move) => [nextTwist(twist, move), nextUdSlice(udSlice, move)],
    0,
    SOLVED_UD_SLICE_COORD
  );
}
function getFlipUdSliceTable() {
  return flipUdSliceTable ??= buildPruningTable2(
    EDGE_ORIENTATION_STATES,
    UD_SLICE_STATES,
    (flip, udSlice, move) => [nextFlip(flip, move), nextUdSlice(udSlice, move)],
    0,
    SOLVED_UD_SLICE_COORD
  );
}
function twistUdSliceDistance(twist, udSlice) {
  return getTwistUdSliceTable()[twist * UD_SLICE_STATES + udSlice];
}
function flipUdSliceDistance(flip, udSlice) {
  return getFlipUdSliceTable()[flip * UD_SLICE_STATES + udSlice];
}
function phase1Heuristic(twist, flip, udSlice) {
  return Math.max(twistUdSliceDistance(twist, udSlice), flipUdSliceDistance(flip, udSlice));
}
function buildPhase1PruningTables() {
  getTwistUdSliceTable();
  getFlipUdSliceTable();
}
var NO_END_RESTRICTIONS = {};
function endRestrictions(first, last) {
  const restrictions = {};
  if (first !== void 0) restrictions.firstMoveAxis = first;
  if (last !== void 0) restrictions.lastMoveAxis = last;
  return restrictions;
}
function isForbiddenFirstMove(move, restrictions) {
  return restrictions.firstMoveAxis !== void 0 && axisOf(move.face) === restrictions.firstMoveAxis;
}
function isForbiddenLastMove(move, restrictions) {
  if (move === void 0) return false;
  return restrictions.lastMoveAxis !== void 0 && axisOf(move.face) === restrictions.lastMoveAxis;
}
function phase1Search(state, restrictions = NO_END_RESTRICTIONS) {
  const start = toPhase1Coordinate(state);
  if (isInG1(start)) return [];
  let bound = phase1Heuristic(start.twist, start.flip, start.udSlice);
  const path = [];
  for (; ; ) {
    const result = dfs2(start, 0, bound, path, restrictions);
    if (result.found) return [...path];
    if (result.nextBound === Infinity) {
      throw new Error("phase1Search: no path to G1 found \u2014 the input state may not be reachable");
    }
    bound = result.nextBound;
  }
}
function dfs2(coord, g, bound, path, restrictions) {
  const h = phase1Heuristic(coord.twist, coord.flip, coord.udSlice);
  const f = g + h;
  if (f > bound) return { found: false, nextBound: f };
  let minExceeding = Infinity;
  const lastMove = path[path.length - 1];
  if (isInG1(coord) && !isForbiddenLastMove(lastMove, restrictions)) return { found: true };
  for (const move of ALL_MOVES) {
    if (lastMove && lastMove.face === move.face) continue;
    if (g === 0 && isForbiddenFirstMove(move, restrictions)) continue;
    const nextCoord = {
      twist: nextTwist(coord.twist, move),
      flip: nextFlip(coord.flip, move),
      udSlice: nextUdSlice(coord.udSlice, move)
    };
    path.push(move);
    const result = dfs2(nextCoord, g + 1, bound, path, restrictions);
    if (result.found) return result;
    if (result.nextBound < minExceeding) minExceeding = result.nextBound;
    path.pop();
  }
  return { found: false, nextBound: minExceeding };
}
function generatePermutations2(n) {
  const elements = Array.from({ length: n }, (_, i) => i);
  const results = [];
  function recurse(current, remaining) {
    if (remaining.length === 0) {
      results.push(current);
      return;
    }
    for (let i = 0; i < remaining.length; i += 1) {
      const next = remaining[i];
      recurse([...current, next], [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
    }
  }
  recurse([], elements);
  return results;
}
var PERMUTATIONS_8 = generatePermutations2(8);
var PERMUTATION_8_STATES = PERMUTATIONS_8.length;
var permutation8Index = new Map(
  PERMUTATIONS_8.map((perm, index) => [perm.join(","), index])
);
var PERMUTATIONS_4 = generatePermutations2(4);
var PERMUTATION_4_STATES = PERMUTATIONS_4.length;
var permutation4Index = new Map(
  PERMUTATIONS_4.map((perm, index) => [perm.join(","), index])
);
function rank8(perm) {
  const key = perm.join(",");
  const index = permutation8Index.get(key);
  if (index === void 0) {
    throw new Error(`phase2-coordinates: "${key}" is not a permutation of [0..7]`);
  }
  return index;
}
function rank4(perm) {
  const key = perm.join(",");
  const index = permutation4Index.get(key);
  if (index === void 0) {
    throw new Error(`phase2-coordinates: "${key}" is not a permutation of [0..3]`);
  }
  return index;
}
function cornerPermCoord(cornerPermutation) {
  return rank8(cornerPermutation);
}
function decodeCornerPermCoord(coord) {
  const perm = PERMUTATIONS_8[coord];
  if (!perm) throw new Error(`phase2-coordinates: cornerPermCoord ${coord} out of range`);
  return perm;
}
function edge8PermCoord(edgePermutation) {
  return rank8(edgePermutation.slice(0, 8));
}
function decodeEdge8PermCoord(coord) {
  const perm = PERMUTATIONS_8[coord];
  if (!perm) throw new Error(`phase2-coordinates: edge8PermCoord ${coord} out of range`);
  return perm;
}
function udSliceOrderCoord(edgePermutation) {
  const sliceValues = edgePermutation.slice(8, 12).map((piece) => piece - 8);
  return rank4(sliceValues);
}
function decodeUdSliceOrderCoord(coord) {
  const perm = PERMUTATIONS_4[coord];
  if (!perm) throw new Error(`phase2-coordinates: udSliceOrderCoord ${coord} out of range`);
  return perm.map((v) => v + 8);
}
function toPhase2Coordinate(state) {
  return {
    cornerPerm: cornerPermCoord(state.cornerPermutation),
    edge8Perm: edge8PermCoord(state.edgePermutation),
    udSliceOrder: udSliceOrderCoord(state.edgePermutation)
  };
}
var SOLVED_CORNER_PERM_COORD = cornerPermCoord(SOLVED_STATE.cornerPermutation);
var SOLVED_EDGE8_PERM_COORD = edge8PermCoord(SOLVED_STATE.edgePermutation);
var SOLVED_UD_SLICE_ORDER_COORD = udSliceOrderCoord(SOLVED_STATE.edgePermutation);
function isSolvedPhase2(coordinate) {
  return coordinate.cornerPerm === SOLVED_CORNER_PERM_COORD && coordinate.edge8Perm === SOLVED_EDGE8_PERM_COORD && coordinate.udSliceOrder === SOLVED_UD_SLICE_ORDER_COORD;
}
var PHASE2_MOVES = [
  { face: "U", amount: 1 },
  { face: "U", amount: 2 },
  { face: "U", amount: 3 },
  { face: "D", amount: 1 },
  { face: "D", amount: 2 },
  { face: "D", amount: 3 },
  { face: "L", amount: 2 },
  { face: "R", amount: 2 },
  { face: "F", amount: 2 },
  { face: "B", amount: 2 }
];
var PHASE2_MOVE_COUNT = PHASE2_MOVES.length;
function stateForCornerPerm(coord) {
  return { ...SOLVED_STATE, cornerPermutation: decodeCornerPermCoord(coord) };
}
function stateForEdge8Perm(coord) {
  const edge8 = decodeEdge8PermCoord(coord);
  return { ...SOLVED_STATE, edgePermutation: [...edge8, 8, 9, 10, 11] };
}
function stateForUdSliceOrder(coord) {
  const slice = decodeUdSliceOrderCoord(coord);
  return { ...SOLVED_STATE, edgePermutation: [0, 1, 2, 3, 4, 5, 6, 7, ...slice] };
}
function buildTable3(states, stateForCoord, encode) {
  const table4 = [];
  for (let m = 0; m < PHASE2_MOVE_COUNT; m += 1) {
    const row = new Array(states);
    const move = PHASE2_MOVES[m];
    for (let coord = 0; coord < states; coord += 1) {
      row[coord] = encode(applyMove(stateForCoord(coord), move));
    }
    table4.push(row);
  }
  return table4;
}
var cornerPermTable2 = null;
var edge8PermTable = null;
var udSliceOrderTable = null;
function getCornerPermTable2() {
  return cornerPermTable2 ??= buildTable3(
    PERMUTATION_8_STATES,
    stateForCornerPerm,
    (s) => cornerPermCoord(s.cornerPermutation)
  );
}
function getEdge8PermTable() {
  return edge8PermTable ??= buildTable3(
    PERMUTATION_8_STATES,
    stateForEdge8Perm,
    (s) => edge8PermCoord(s.edgePermutation)
  );
}
function getUdSliceOrderTable() {
  return udSliceOrderTable ??= buildTable3(
    PERMUTATION_4_STATES,
    stateForUdSliceOrder,
    (s) => udSliceOrderCoord(s.edgePermutation)
  );
}
var phase2MoveIndexByKey = new Map(
  PHASE2_MOVES.map((move, i) => [moveKey(move), i])
);
function phase2MoveIndex(move) {
  const index = phase2MoveIndexByKey.get(moveKey(move));
  if (index === void 0) {
    throw new Error(`phase2-tables: ${moveKey(move)} is not a phase-2 (G1-preserving) move`);
  }
  return index;
}
function nextCornerPerm(coord, move) {
  return getCornerPermTable2()[phase2MoveIndex(move)][coord];
}
function nextEdge8Perm(coord, move) {
  return getEdge8PermTable()[phase2MoveIndex(move)][coord];
}
function nextUdSliceOrder(coord, move) {
  return getUdSliceOrderTable()[phase2MoveIndex(move)][coord];
}
function buildPhase2Tables() {
  getCornerPermTable2();
  getEdge8PermTable();
  getUdSliceOrderTable();
}
var UNVISITED3 = 255;
function buildPruningTable3(dimA, dimB, next, targetA, targetB) {
  const table4 = new Uint8Array(dimA * dimB).fill(UNVISITED3);
  const startIndex = targetA * dimB + targetB;
  table4[startIndex] = 0;
  let frontier = [startIndex];
  let depth = 0;
  let visited = 1;
  const total = dimA * dimB;
  while (frontier.length > 0 && visited < total) {
    const nextFrontier = [];
    for (const index of frontier) {
      const a = Math.floor(index / dimB);
      const b = index % dimB;
      for (const move of PHASE2_MOVES) {
        const [na, nb] = next(a, b, move);
        const nIndex = na * dimB + nb;
        if (table4[nIndex] === UNVISITED3) {
          table4[nIndex] = depth + 1;
          nextFrontier.push(nIndex);
          visited += 1;
        }
      }
    }
    frontier = nextFrontier;
    depth += 1;
  }
  return table4;
}
var cornerPermUdSliceOrderTable = null;
var edge8PermUdSliceOrderTable = null;
function getCornerPermUdSliceOrderTable() {
  return cornerPermUdSliceOrderTable ??= buildPruningTable3(
    PERMUTATION_8_STATES,
    PERMUTATION_4_STATES,
    (cornerPerm, udSliceOrder, move) => [
      nextCornerPerm(cornerPerm, move),
      nextUdSliceOrder(udSliceOrder, move)
    ],
    SOLVED_CORNER_PERM_COORD,
    SOLVED_UD_SLICE_ORDER_COORD
  );
}
function getEdge8PermUdSliceOrderTable() {
  return edge8PermUdSliceOrderTable ??= buildPruningTable3(
    PERMUTATION_8_STATES,
    PERMUTATION_4_STATES,
    (edge8Perm, udSliceOrder, move) => [
      nextEdge8Perm(edge8Perm, move),
      nextUdSliceOrder(udSliceOrder, move)
    ],
    SOLVED_EDGE8_PERM_COORD,
    SOLVED_UD_SLICE_ORDER_COORD
  );
}
function cornerPermUdSliceOrderDistance(cornerPerm, udSliceOrder) {
  return getCornerPermUdSliceOrderTable()[cornerPerm * PERMUTATION_4_STATES + udSliceOrder];
}
function edge8PermUdSliceOrderDistance(edge8Perm, udSliceOrder) {
  return getEdge8PermUdSliceOrderTable()[edge8Perm * PERMUTATION_4_STATES + udSliceOrder];
}
function phase2Heuristic(cornerPerm, edge8Perm, udSliceOrder) {
  return Math.max(
    cornerPermUdSliceOrderDistance(cornerPerm, udSliceOrder),
    edge8PermUdSliceOrderDistance(edge8Perm, udSliceOrder)
  );
}
function buildPhase2PruningTables() {
  getCornerPermUdSliceOrderTable();
  getEdge8PermUdSliceOrderTable();
}
function phase2Search(state, restrictions = NO_END_RESTRICTIONS) {
  const start = toPhase2Coordinate(state);
  if (isSolvedPhase2(start)) return [];
  let bound = phase2Heuristic(start.cornerPerm, start.edge8Perm, start.udSliceOrder);
  const path = [];
  for (; ; ) {
    const result = dfs3(start, 0, bound, path, restrictions);
    if (result.found) return [...path];
    if (result.nextBound === Infinity) {
      throw new Error("phase2Search: no path to solved found \u2014 the input state may not be in G1");
    }
    bound = result.nextBound;
  }
}
function dfs3(coord, g, bound, path, restrictions) {
  const h = phase2Heuristic(coord.cornerPerm, coord.edge8Perm, coord.udSliceOrder);
  const f = g + h;
  if (f > bound) return { found: false, nextBound: f };
  let minExceeding = Infinity;
  const lastMove = path[path.length - 1];
  if (isSolvedPhase2(coord) && !isForbiddenLastMove(lastMove, restrictions)) return { found: true };
  for (const move of PHASE2_MOVES) {
    if (lastMove && lastMove.face === move.face) continue;
    if (g === 0 && isForbiddenFirstMove(move, restrictions)) continue;
    const nextCoord = {
      cornerPerm: nextCornerPerm(coord.cornerPerm, move),
      edge8Perm: nextEdge8Perm(coord.edge8Perm, move),
      udSliceOrder: nextUdSliceOrder(coord.udSliceOrder, move)
    };
    path.push(move);
    const result = dfs3(nextCoord, g + 1, bound, path, restrictions);
    if (result.found) return result;
    if (result.nextBound < minExceeding) minExceeding = result.nextBound;
    path.pop();
  }
  return { found: false, nextBound: minExceeding };
}
function solve333(state, restrictions = NO_END_RESTRICTIONS) {
  const solution = twoPhaseSolve(state, restrictions, false);
  if (!isForbiddenLastMove(solution[solution.length - 1], restrictions)) return solution;
  return twoPhaseSolve(state, restrictions, true);
}
function twoPhaseSolve(state, restrictions, carryLastMoveRestrictionToPhase1) {
  const phase1Moves = phase1Search(
    state,
    endRestrictions(
      restrictions.firstMoveAxis,
      carryLastMoveRestrictionToPhase1 ? restrictions.lastMoveAxis : void 0
    )
  );
  const g1State = applyMoves(state, phase1Moves);
  const phase2Moves = phase2Search(
    g1State,
    endRestrictions(
      phase1Moves.length === 0 ? restrictions.firstMoveAxis : void 0,
      restrictions.lastMoveAxis
    )
  );
  return [...phase1Moves, ...phase2Moves];
}
function prepare333Tables() {
  buildPhase1Tables();
  buildPhase1PruningTables();
  buildPhase2Tables();
  buildPhase2PruningTables();
}
var FEWEST_MOVES_PREFIX = "R' U' F";
var FEWEST_MOVES_SUFFIX = "R' U' F";
var PREFIX_MOVES = FEWEST_MOVES_PREFIX.split(" ").map(parseMove);
var SUFFIX_MOVES = FEWEST_MOVES_SUFFIX.split(" ").map(parseMove);
var SCRAMBLE_FIRST_MOVE_AXIS = axisOf(PREFIX_MOVES[PREFIX_MOVES.length - 1].face);
var SCRAMBLE_LAST_MOVE_AXIS = axisOf(SUFFIX_MOVES[0].face);
var CLOCK_CORNERS = ["UR", "DR", "DL", "UL"];
var CLOCK_PIN_SETS = [
  "UR",
  "DR",
  "DL",
  "UL",
  "U",
  "R",
  "D",
  "L",
  "ALL"
];
var PIN_SET_CORNERS = {
  UR: ["UR"],
  DR: ["DR"],
  DL: ["DL"],
  UL: ["UL"],
  U: ["UL", "UR"],
  R: ["UR", "DR"],
  D: ["DL", "DR"],
  L: ["UL", "DL"],
  ALL: ["UL", "UR", "DL", "DR"]
};
var CLOCK_HOURS = 12;
var PIN_SET_NAMES = new Set(CLOCK_PIN_SETS);
var DIALS_PER_SIDE = 9;
var CORNER_SLOT = {
  UL: 0,
  UR: 2,
  DL: 6,
  DR: 8
};
var NON_CORNER_SLOTS = [1, 3, 4, 5, 7];
var MIRROR_SLOT = [2, 1, 0, 5, 4, 3, 8, 7, 6];
var CORNER_NEIGHBOUR_SLOTS = (() => {
  const entry = (corner) => {
    const slot = CORNER_SLOT[corner];
    const row = Math.floor(slot / 3);
    const column = slot % 3;
    const neighbours = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        const other = r * 3 + c;
        if (other === slot) continue;
        if (Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1) neighbours.push(other);
      }
    }
    return neighbours;
  };
  return { UL: entry("UL"), UR: entry("UR"), DL: entry("DL"), DR: entry("DR") };
})();
function drivenSlots(corners2) {
  const slots = /* @__PURE__ */ new Set();
  for (const corner of corners2) {
    slots.add(CORNER_SLOT[corner]);
    for (const neighbour of CORNER_NEIGHBOUR_SLOTS[corner]) slots.add(neighbour);
  }
  return [...slots].sort((a, b) => a - b);
}
function normalizeHours(value) {
  return (value % CLOCK_HOURS + CLOCK_HOURS) % CLOCK_HOURS;
}
var SOLVED_CLOCK_STATE = {
  front: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  back: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  pinsUp: { UR: false, DR: false, DL: false, UL: false }
};
function applyClockTurn(state, corners2, amount, flipped) {
  const near = [...flipped ? state.back : state.front];
  const far = [...flipped ? state.front : state.back];
  for (const slot of drivenSlots(corners2)) {
    near[slot] = normalizeHours(near[slot] + amount);
  }
  for (const corner of corners2) {
    const slot = CORNER_SLOT[corner];
    far[MIRROR_SLOT[slot]] = normalizeHours(far[MIRROR_SLOT[slot]] - amount);
  }
  return {
    front: flipped ? far : near,
    back: flipped ? near : far,
    pinsUp: setPins(state.pinsUp, corners2, flipped)
  };
}
function applyClockDial(state, pins, amount, flipped) {
  return applyClockTurn(state, PIN_SET_CORNERS[pins], amount, flipped);
}
function setPins(current, up, flipped) {
  const raised = new Set(flipped ? up.map(mirrorCorner) : up);
  const next = { ...current };
  for (const corner of CLOCK_CORNERS) {
    next[corner] = flipped ? !raised.has(corner) : raised.has(corner);
  }
  return next;
}
function mirrorCorner(corner) {
  const slot = MIRROR_SLOT[CORNER_SLOT[corner]];
  const found = CLOCK_CORNERS.find((c) => CORNER_SLOT[c] === slot);
  if (!found) throw new Error(`clock-state: no corner mirrors ${corner}`);
  return found;
}
var CLOCK_DIMENSION = DIALS_PER_SIDE + NON_CORNER_SLOTS.length;
function toClockVector(state) {
  return [...state.front, ...NON_CORNER_SLOTS.map((slot) => state.back[slot])];
}
function integerDeterminant(matrix) {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  let sign = 1;
  let previous = 1;
  for (let k = 0; k < n - 1; k += 1) {
    if (a[k][k] === 0) {
      const swap = a.findIndex((row, i) => i > k && row[k] !== 0);
      if (swap === -1) return 0;
      [a[k], a[swap]] = [a[swap], a[k]];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i += 1) {
      for (let j = k + 1; j < n; j += 1) {
        a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / previous;
      }
    }
    previous = a[k][k];
  }
  const determinant = sign * a[n - 1][n - 1];
  return determinant === 0 ? 0 : determinant;
}
var FRONT_TEMPLATE = [
  "UR",
  "DR",
  "DL",
  "UL",
  "U",
  "R",
  "D",
  "L",
  "ALL"
];
var BACK_TEMPLATE = ["U", "R", "D", "L", "ALL"];
var TEMPLATE_LENGTH = FRONT_TEMPLATE.length + BACK_TEMPLATE.length;
var TEMPLATE_MATRIX = [
  ...FRONT_TEMPLATE.map((pins) => toClockVector(applyClockDial(SOLVED_CLOCK_STATE, pins, 1, false))),
  ...BACK_TEMPLATE.map((pins) => toClockVector(applyClockDial(SOLVED_CLOCK_STATE, pins, 1, true)))
];
integerDeterminant(TEMPLATE_MATRIX);
var PHI = (1 + Math.sqrt(5)) / 2;
var INV_PHI = PHI - 1;
var TOLERANCE = 1e-6;
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function scale(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function length(a) {
  return Math.sqrt(dot(a, a));
}
function normalize(a) {
  return scale(a, 1 / length(a));
}
function distance(a, b) {
  return length([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}
function positionKey(a) {
  return a.map((v) => (Math.abs(v) < TOLERANCE ? 0 : v).toFixed(9)).join(",");
}
function signedCyclicFamily(pattern) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (let rotation = 0; rotation < 3; rotation += 1) {
    const p = [
      pattern[rotation % 3],
      pattern[(rotation + 1) % 3],
      pattern[(rotation + 2) % 3]
    ];
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
          const v = [p[0] * sx, p[1] * sy, p[2] * sz];
          const key = positionKey(v);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(v);
        }
      }
    }
  }
  return out;
}
function sortByKey(positions) {
  return [...positions].sort((a, b) => positionKey(a) < positionKey(b) ? -1 : 1);
}
var FACE_CENTERS = sortByKey(signedCyclicFamily([0, PHI, 1]));
var CORNER_POSITIONS_MINX = sortByKey([
  ...signedCyclicFamily([1, 1, 1]),
  ...signedCyclicFamily([0, INV_PHI, PHI])
]);
var EDGE_LENGTH = 2 * INV_PHI;
var EDGE_POSITIONS_MINX = (() => {
  const midpoints = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < CORNER_POSITIONS_MINX.length; i += 1) {
    for (let j = i + 1; j < CORNER_POSITIONS_MINX.length; j += 1) {
      const a = CORNER_POSITIONS_MINX[i];
      const b = CORNER_POSITIONS_MINX[j];
      if (Math.abs(distance(a, b) - EDGE_LENGTH) > TOLERANCE) continue;
      const mid = scale(add(a, b), 0.5);
      const key = positionKey(mid);
      if (seen.has(key)) continue;
      seen.add(key);
      midpoints.push(mid);
    }
  }
  return sortByKey(midpoints);
})();
var FACE_COUNT_MINX = FACE_CENTERS.length;
var CORNER_COUNT_MINX = CORNER_POSITIONS_MINX.length;
var EDGE_COUNT_MINX = EDGE_POSITIONS_MINX.length;
function rotateFifths(axis, v, fifths) {
  const n = normalize(axis);
  const angle = fifths * 2 * Math.PI / 5;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(
    add(scale(v, c), scale(cross(n, v), s)),
    scale(n, dot(n, v) * (1 - c))
  );
}
function indexOfPosition(positions, target) {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < positions.length; i += 1) {
    const d = distance(positions[i], target);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  if (bestDistance > TOLERANCE) {
    throw new Error(
      `megaminx-geometry: [${target.join(",")}] is ${bestDistance} from the nearest position \u2014 not a lattice point`
    );
  }
  return best;
}
function maxProjection(positions, face) {
  return Math.max(...positions.map((p) => dot(p, face)));
}
var MAX_PROJECTION_CACHE = /* @__PURE__ */ new Map();
function projections(face) {
  const key = positionKey(face);
  let cached2 = MAX_PROJECTION_CACHE.get(key);
  if (!cached2) {
    cached2 = {
      corners: maxProjection(CORNER_POSITIONS_MINX, face),
      edges: maxProjection(EDGE_POSITIONS_MINX, face),
      centers: maxProjection(FACE_CENTERS, face)
    };
    MAX_PROJECTION_CACHE.set(key, cached2);
  }
  return cached2;
}
function cornerOnFace(face, position) {
  return Math.abs(dot(position, face) - projections(face).corners) < TOLERANCE;
}
function edgeOnFace(face, position) {
  return Math.abs(dot(position, face) - projections(face).edges) < TOLERANCE;
}
function centerOnFace(face, position) {
  return Math.abs(dot(position, face) - projections(face).centers) < TOLERANCE;
}
function facesAtCorner(position) {
  return FACE_CENTERS.filter((face) => cornerOnFace(face, position));
}
function facesAtEdge(position) {
  return FACE_CENTERS.filter((face) => edgeOnFace(face, position));
}
function cornerFaceCycle(position) {
  const faces = facesAtCorner(position);
  if (faces.length !== 3) {
    throw new Error(`megaminx-geometry: corner [${position.join(",")}] touches ${faces.length} faces, expected 3`);
  }
  const first = sortByKey(faces)[0];
  const second = rotateFifths(position, first, 5 / 3);
  const third = rotateFifths(position, second, 5 / 3);
  return [first, second, third];
}
function edgeReferenceFace(position) {
  const faces = facesAtEdge(position);
  if (faces.length !== 2) {
    throw new Error(`megaminx-geometry: edge [${position.join(",")}] touches ${faces.length} faces, expected 2`);
  }
  return sortByKey(faces)[0];
}
var CORNER_CYCLES = CORNER_POSITIONS_MINX.map(cornerFaceCycle);
var EDGE_REFERENCES = EDGE_POSITIONS_MINX.map(edgeReferenceFace);
function deriveMoveTableMinx(axis, fifths, moving) {
  const wants = (onLayer) => moving === "on-layer" ? onLayer : !onLayer;
  const cornerDestination = [];
  const cornerTwist = [];
  for (let i = 0; i < CORNER_COUNT_MINX; i += 1) {
    const from = CORNER_POSITIONS_MINX[i];
    if (!wants(cornerOnFace(axis, from))) {
      cornerDestination[i] = i;
      cornerTwist[i] = 0;
      continue;
    }
    const to = rotateFifths(axis, from, fifths);
    const destination = indexOfPosition(CORNER_POSITIONS_MINX, to);
    cornerDestination[i] = destination;
    const carried = rotateFifths(axis, CORNER_CYCLES[i][0], fifths);
    const cycle = CORNER_CYCLES[destination];
    const twist = cycle.findIndex((face) => distance(face, carried) < TOLERANCE);
    if (twist === -1) {
      throw new Error(`megaminx-geometry: corner ${i} lost track of its reference sticker`);
    }
    cornerTwist[i] = twist;
  }
  const edgeDestination = [];
  const edgeFlip = [];
  for (let i = 0; i < EDGE_COUNT_MINX; i += 1) {
    const from = EDGE_POSITIONS_MINX[i];
    if (!wants(edgeOnFace(axis, from))) {
      edgeDestination[i] = i;
      edgeFlip[i] = 0;
      continue;
    }
    const to = rotateFifths(axis, from, fifths);
    const destination = indexOfPosition(EDGE_POSITIONS_MINX, to);
    edgeDestination[i] = destination;
    const carried = rotateFifths(axis, EDGE_REFERENCES[i], fifths);
    edgeFlip[i] = distance(carried, EDGE_REFERENCES[destination]) < TOLERANCE ? 0 : 1;
  }
  const centerDestination = [];
  for (let i = 0; i < FACE_COUNT_MINX; i += 1) {
    const from = FACE_CENTERS[i];
    centerDestination[i] = wants(centerOnFace(axis, from)) ? indexOfPosition(FACE_CENTERS, rotateFifths(axis, from, fifths)) : i;
  }
  return { cornerDestination, cornerTwist, edgeDestination, edgeFlip, centerDestination };
}
var U_FACE = FACE_CENTERS[0];
var L_FACE = (() => {
  const neighbours = FACE_CENTERS.filter(
    (face) => positionKey(face) !== positionKey(U_FACE) && sharesAnEdgeWith(U_FACE, face)
  );
  return sortByKey(neighbours)[0];
})();
function sharesAnEdgeWith(a, b) {
  return EDGE_POSITIONS_MINX.some((edge) => edgeOnFace(a, edge) && edgeOnFace(b, edge));
}
var identity = (n) => Array.from({ length: n }, (_, i) => i);
var zeros = (n) => new Array(n).fill(0);
var SOLVED_MEGAMINX_STATE = {
  cornerPermutation: identity(CORNER_COUNT_MINX),
  cornerOrientation: zeros(CORNER_COUNT_MINX),
  edgePermutation: identity(EDGE_COUNT_MINX),
  edgeOrientation: zeros(EDGE_COUNT_MINX),
  centerPermutation: identity(FACE_COUNT_MINX)
};
var MOVE_TABLES2 = (() => {
  const tables4 = /* @__PURE__ */ new Map();
  tables4.set("U1", deriveMoveTableMinx(U_FACE, -1, "on-layer"));
  tables4.set("U2", deriveMoveTableMinx(U_FACE, 1, "on-layer"));
  tables4.set("D1", deriveMoveTableMinx(U_FACE, 2, "off-layer"));
  tables4.set("D2", deriveMoveTableMinx(U_FACE, -2, "off-layer"));
  tables4.set("R1", deriveMoveTableMinx(L_FACE, 2, "off-layer"));
  tables4.set("R2", deriveMoveTableMinx(L_FACE, -2, "off-layer"));
  return tables4;
})();
var RANDOM_MOVE_CUBES = [
  { event: "555", size: 5, length: 60 },
  { event: "666", size: 6, length: 80 },
  { event: "777", size: 7, length: 100 }
];
var PYRAMINX_VERTICES = ["U", "L", "R", "B"];
var PYRAMINX_AMOUNTS = [1, 2];
function allLayerMovesPyraminx() {
  const moves = [];
  for (const vertex of PYRAMINX_VERTICES) {
    for (const amount of PYRAMINX_AMOUNTS) moves.push({ vertex, amount, tip: false });
  }
  return moves;
}
var VERTEX_POSITIONS = {
  U: [1, 1, 1],
  L: [-1, 1, -1],
  R: [-1, -1, 1],
  B: [1, -1, -1]
};
var EDGE_VERTEX_PAIRS = (() => {
  const pairs = [];
  for (let i = 0; i < PYRAMINX_VERTICES.length; i += 1) {
    for (let j = i + 1; j < PYRAMINX_VERTICES.length; j += 1) {
      pairs.push([PYRAMINX_VERTICES[i], PYRAMINX_VERTICES[j]]);
    }
  }
  return pairs;
})();
var EDGE_COUNT_PYRAMINX = EDGE_VERTEX_PAIRS.length;
var VERTEX_COUNT_PYRAMINX = PYRAMINX_VERTICES.length;
EDGE_VERTEX_PAIRS.map(([a, b]) => `${a}${b}`);
var EDGE_POSITIONS2 = EDGE_VERTEX_PAIRS.map(
  ([a, b]) => vecHalve(vecAdd(VERTEX_POSITIONS[a], VERTEX_POSITIONS[b]))
);
function edgeIndexAt(position) {
  const index = EDGE_POSITIONS2.findIndex((p) => vecEquals(p, position));
  if (index === -1) {
    throw new Error(`pyraminx-geometry: no edge slot at [${position.join(",")}]`);
  }
  return index;
}
function faceNormalsOfEdge(index) {
  const [a, b] = EDGE_VERTEX_PAIRS[index];
  const others = PYRAMINX_VERTICES.filter((v) => v !== a && v !== b);
  return [vecNegate(VERTEX_POSITIONS[others[0]]), vecNegate(VERTEX_POSITIONS[others[1]])];
}
function referenceNormal(index) {
  const [n1, n2] = faceNormalsOfEdge(index);
  return vecLess(n1, n2) ? n1 : n2;
}
var REFERENCE_NORMALS = EDGE_POSITIONS2.map((_, i) => referenceNormal(i));
function deriveTurnTable(vertex) {
  const axis = VERTEX_POSITIONS[vertex];
  const edgeDestination = [];
  const edgeFlip = [];
  for (let i = 0; i < EDGE_COUNT_PYRAMINX; i += 1) {
    const [a, b] = EDGE_VERTEX_PAIRS[i];
    if (a !== vertex && b !== vertex) {
      edgeDestination[i] = i;
      edgeFlip[i] = 0;
      continue;
    }
    const destination = edgeIndexAt(rotate120(axis, EDGE_POSITIONS2[i], -1));
    edgeDestination[i] = destination;
    const carriedReference = rotate120(axis, REFERENCE_NORMALS[i], -1);
    edgeFlip[i] = vecEquals(carriedReference, REFERENCE_NORMALS[destination]) ? 0 : 1;
  }
  const axialTwist = PYRAMINX_VERTICES.map((v) => v === vertex ? 1 : 0);
  return { vertex, edgeDestination, edgeFlip, axialTwist };
}
function composeSelf3(base, times) {
  let destination = Array.from({ length: EDGE_COUNT_PYRAMINX }, (_, i) => i);
  let flip = new Array(EDGE_COUNT_PYRAMINX).fill(0);
  for (let t = 0; t < times; t += 1) {
    const nextDestination = new Array(EDGE_COUNT_PYRAMINX);
    const nextFlip2 = new Array(EDGE_COUNT_PYRAMINX);
    for (let i = 0; i < EDGE_COUNT_PYRAMINX; i += 1) {
      const mid = destination[i];
      nextDestination[i] = base.edgeDestination[mid];
      nextFlip2[i] = (flip[i] + base.edgeFlip[mid]) % 2;
    }
    destination = nextDestination;
    flip = nextFlip2;
  }
  return {
    vertex: base.vertex,
    edgeDestination: destination,
    edgeFlip: flip,
    axialTwist: base.axialTwist.map((t) => t * times % 3)
  };
}
function buildTurnTables() {
  const tables4 = /* @__PURE__ */ new Map();
  for (const vertex of PYRAMINX_VERTICES) {
    const base = deriveTurnTable(vertex);
    for (const amount of [1, 2]) {
      tables4.set(`${vertex}${amount}`, composeSelf3(base, amount));
    }
  }
  return tables4;
}
var TURN_TABLES_PYRAMINX = buildTurnTables();
var PERMUTATIONS_6 = allPermutations(EDGE_COUNT_PYRAMINX);
var EDGE_PERM_PYRAMINX_STATES = PERMUTATIONS_6.length;
var EDGE_ORIENTATION_PYRAMINX_STATES = 2 ** EDGE_COUNT_PYRAMINX;
var AXIAL_PYRAMINX_STATES = 3 ** VERTEX_COUNT_PYRAMINX;
var permutationIndex = new Map(
  PERMUTATIONS_6.map((perm, index) => [perm.join(","), index])
);
function edgePermPyraminxCoord(edgePermutation) {
  const index = permutationIndex.get(edgePermutation.join(","));
  if (index === void 0) {
    throw new Error(
      `pyraminx-coordinates: [${edgePermutation.join(",")}] is not a permutation of the 6 edges`
    );
  }
  return index;
}
var PYRAMINX_COORDINATE_STATES = EDGE_PERM_PYRAMINX_STATES * EDGE_ORIENTATION_PYRAMINX_STATES * AXIAL_PYRAMINX_STATES;
var SOLVED_PYRAMINX_COORDINATE = {
  edgePerm: edgePermPyraminxCoord([0, 1, 2, 3, 4, 5]),
  edgeOrientation: 0,
  axial: 0
};
var ALL_LAYER_MOVES_PYRAMINX = allLayerMovesPyraminx();
var MOVE_COUNT2 = ALL_LAYER_MOVES_PYRAMINX.length;
new Map(
  ALL_LAYER_MOVES_PYRAMINX.map((move, i) => [`${move.vertex}${move.amount}`, i])
);
var DEFAULT_MOVE_ORDER = ALL_LAYER_MOVES_PYRAMINX.map((_, i) => i);
var SKEWB_CORNERS = ["U", "R", "L", "B"];
var SKEWB_AMOUNTS = [1, 2];
function allMovesSkewb() {
  const moves = [];
  for (const corner of SKEWB_CORNERS) {
    for (const amount of SKEWB_AMOUNTS) moves.push({ corner, amount });
  }
  return moves;
}
var CORNER_POSITIONS_SKEWB = [
  [1, 1, 1],
  //  0 — the held corner (white up, green front-left)
  [1, 1, -1],
  //  1
  [1, -1, 1],
  //  2
  [-1, 1, 1],
  //  3
  [1, -1, -1],
  //  4 — R
  [-1, 1, -1],
  //  5 — U
  [-1, -1, 1],
  //  6 — L
  [-1, -1, -1]
  // 7 — B
];
var CORNER_COUNT_SKEWB = CORNER_POSITIONS_SKEWB.length;
var CENTER_POSITIONS_SKEWB = [
  [1, 0, 0],
  //  0 +x  (front-right in the WCA holding)
  [-1, 0, 0],
  // 1 -x
  [0, 1, 0],
  //  2 +y  (white / up)
  [0, -1, 0],
  // 3 -y
  [0, 0, 1],
  //  4 +z  (green / front-left)
  [0, 0, -1]
  // 5 -z
];
var CENTER_COUNT_SKEWB = CENTER_POSITIONS_SKEWB.length;
var TURN_AXIS = {
  U: [-1, 1, -1],
  R: [1, -1, -1],
  L: [-1, -1, 1],
  B: [-1, -1, -1]
};
function cornerIndexAt(position) {
  const index = CORNER_POSITIONS_SKEWB.findIndex((p) => vecEquals(p, position));
  if (index === -1) throw new Error(`skewb-geometry: no corner at [${position.join(",")}]`);
  return index;
}
function centerIndexAt(position) {
  const index = CENTER_POSITIONS_SKEWB.findIndex((p) => vecEquals(p, position));
  if (index === -1) throw new Error(`skewb-geometry: no center at [${position.join(",")}]`);
  return index;
}
function orientationCycle(position) {
  const first = [0, position[1], 0];
  const second = rotate120(position, first, 1);
  const third = rotate120(position, second, 1);
  return [first, second, third];
}
var CORNER_ORIENTATION_CYCLES = CORNER_POSITIONS_SKEWB.map(orientationCycle);
function deriveTurnTableSkewb(corner) {
  const axis = TURN_AXIS[corner];
  const cornerDestination = [];
  const cornerTwist = [];
  const centerDestination = [];
  for (let i = 0; i < CORNER_COUNT_SKEWB; i += 1) {
    const from = CORNER_POSITIONS_SKEWB[i];
    if (vecDot(from, axis) < 0) {
      cornerDestination[i] = i;
      cornerTwist[i] = 0;
      continue;
    }
    const to = rotate120(axis, from, -1);
    const destination = cornerIndexAt(to);
    cornerDestination[i] = destination;
    const carried = rotate120(axis, CORNER_ORIENTATION_CYCLES[i][0], -1);
    const cycle = CORNER_ORIENTATION_CYCLES[destination];
    const twist = cycle.findIndex((normal) => vecEquals(normal, carried));
    if (twist === -1) {
      throw new Error(
        `skewb-geometry: ${corner} carried corner ${i}'s reference sticker onto a face that is not one of its own`
      );
    }
    cornerTwist[i] = twist;
  }
  for (let i = 0; i < CENTER_COUNT_SKEWB; i += 1) {
    const from = CENTER_POSITIONS_SKEWB[i];
    centerDestination[i] = vecDot(from, axis) < 0 ? i : centerIndexAt(rotate120(axis, from, -1));
  }
  return { corner, cornerDestination, cornerTwist, centerDestination };
}
Object.freeze(
  Object.fromEntries(SKEWB_CORNERS.map((c) => [c, deriveTurnTableSkewb(c)]))
);
function composeSelf4(base, times) {
  let cornerDestination = Array.from({ length: CORNER_COUNT_SKEWB }, (_, i) => i);
  let cornerTwist = new Array(CORNER_COUNT_SKEWB).fill(0);
  let centerDestination = Array.from({ length: CENTER_COUNT_SKEWB }, (_, i) => i);
  for (let t = 0; t < times; t += 1) {
    const nextCornerDestination = new Array(CORNER_COUNT_SKEWB);
    const nextCornerTwist = new Array(CORNER_COUNT_SKEWB);
    for (let i = 0; i < CORNER_COUNT_SKEWB; i += 1) {
      const mid = cornerDestination[i];
      nextCornerDestination[i] = base.cornerDestination[mid];
      nextCornerTwist[i] = (cornerTwist[i] + base.cornerTwist[mid]) % 3;
    }
    const nextCenterDestination = new Array(CENTER_COUNT_SKEWB);
    for (let i = 0; i < CENTER_COUNT_SKEWB; i += 1) {
      nextCenterDestination[i] = base.centerDestination[centerDestination[i]];
    }
    cornerDestination = nextCornerDestination;
    cornerTwist = nextCornerTwist;
    centerDestination = nextCenterDestination;
  }
  return { corner: base.corner, cornerDestination, cornerTwist, centerDestination };
}
function buildTurnTables2() {
  const tables4 = /* @__PURE__ */ new Map();
  for (const corner of SKEWB_CORNERS) {
    const base = deriveTurnTableSkewb(corner);
    for (const amount of [1, 2]) tables4.set(`${corner}${amount}`, composeSelf4(base, amount));
  }
  return tables4;
}
var TURN_TABLES = buildTurnTables2();
var ALL_MOVES_SKEWB = allMovesSkewb();
var MOVE_COUNT_SKEWB = ALL_MOVES_SKEWB.length;
var DEFAULT_MOVE_ORDER2 = ALL_MOVES_SKEWB.map((_, i) => i);
var SQUARE1_UNITS = 12;
var RING_SLOTS = SQUARE1_UNITS;
var SQUARE1_SLOT_COUNT = 2 * RING_SLOTS;
var PHASE2_ALIGNMENT_COUNT = 9;
var PERMUTATION_COUNT = 40320;
function alignmentIndex(upper, lower) {
  return upper * 3 + lower;
}
var SOLVED_ALIGNMENT_INDEX = alignmentIndex(0, 0);
var PHASE2_TABLE_SIZE = PHASE2_ALIGNMENT_COUNT * 2 * PERMUTATION_COUNT;
var PHASE2_CLASS_COUNT = PHASE2_ALIGNMENT_COUNT * 2 * 2 * 2;
var CUT_STRADDLING_STARTS = 1 << 2 | 1 << 8 | 1 << RING_SLOTS + 2 | 1 << RING_SLOTS + 8;
var RING_MASK = (1 << RING_SLOTS) - 1;
function shapeKeyFromStarts(upper, lower) {
  return upper & RING_MASK | (lower & RING_MASK) << RING_SLOTS;
}
function rotateStarts(mask, amount) {
  const shift = (amount % RING_SLOTS + RING_SLOTS) % RING_SLOTS;
  return (mask << shift | mask >>> RING_SLOTS - shift) & RING_MASK;
}
var MOVING_STARTS = 1 << 9 | 1 << 10 | 1 << 11 | 1 << 0 | 1 << 1;
var FIXED_STARTS = 1 << 3 | 1 << 4 | 1 << 5 | 1 << 6 | 1 << 7;
var STRADDLING_STARTS = 1 << 2 | 1 << 8;
var SQUARE_RING_STARTS = 585;
function squareRingStarts(alignment) {
  return rotateStarts(SQUARE_RING_STARTS, alignment);
}
var SQUARE_LAYER_SHAPE_KEYS = [0, 1, 2].flatMap(
  (top) => [0, 1, 2].map((bottom) => shapeKeyFromStarts(squareRingStarts(top), squareRingStarts(bottom)))
);
var SIZE_444 = 4;
var CORNER_COUNT_444 = 8;
var WING_COUNT_444 = 24;
var CENTRE_COUNT_444 = 24;
function cubieOf(facelet) {
  return [
    facelet.position[0] - facelet.normal[0],
    facelet.position[1] - facelet.normal[1],
    facelet.position[2] - facelet.normal[2]
  ];
}
var cached;
function centreIndexWithinFace(cubie, faceAxis) {
  const others = [0, 1, 2].filter((axis) => axis !== faceAxis);
  return others.reduce((index, axis) => index * 2 + (cubie[axis] > 0 ? 0 : 1), 0);
}
function signVector(cubie) {
  return [Math.sign(cubie[0]), Math.sign(cubie[1]), Math.sign(cubie[2])];
}
function indexOfVector(table4, vector) {
  const index = table4.findIndex((candidate) => vecKey(candidate) === vecKey(vector));
  if (index < 0) throw new Error(`444-pieces: no entry for ${vecKey(vector)}`);
  return index;
}
function pieces444() {
  if (cached) return cached;
  const facelets = buildFacelets(SIZE_444);
  const byCubie = /* @__PURE__ */ new Map();
  for (const [id, facelet] of facelets.entries()) {
    const key = vecKey(cubieOf(facelet));
    const group = byCubie.get(key);
    if (group) group.push(id);
    else byCubie.set(key, [id]);
  }
  const cornerFacelets = Array.from({ length: CORNER_COUNT_444 }, () => []);
  const wingFacelets = Array.from({ length: WING_COUNT_444 }, () => []);
  const centreFacelets = new Array(CENTRE_COUNT_444).fill(-1);
  const centreFace = new Array(CENTRE_COUNT_444).fill(-1);
  for (const ids of byCubie.values()) {
    const cubie = cubieOf(facelets[ids[0]]);
    if (ids.length === 3) {
      cornerFacelets[indexOfVector(CORNER_POSITIONS, signVector(cubie))] = orderCornerFacelets(
        facelets,
        ids,
        cubie
      );
      continue;
    }
    if (ids.length === 2) {
      const oddAxis = [0, 1, 2].find((axis) => Math.abs(cubie[axis]) === 1);
      const signs = signVector(cubie);
      const edgeVector = [
        oddAxis === 0 ? 0 : signs[0],
        oddAxis === 1 ? 0 : signs[1],
        oddAxis === 2 ? 0 : signs[2]
      ];
      const edge = indexOfVector(EDGE_POSITIONS, edgeVector);
      wingFacelets[2 * edge + (cubie[oddAxis] > 0 ? 0 : 1)] = [...ids];
      continue;
    }
    const id = ids[0];
    const faceAxis = [0, 1, 2].find((axis) => Math.abs(cubie[axis]) === SIZE_444 - 1);
    const face = FACES.indexOf(facelets[id].face);
    const slot = 4 * face + centreIndexWithinFace(cubie, faceAxis);
    centreFacelets[slot] = id;
    centreFace[slot] = face;
  }
  orderWingFacelets(facelets, wingFacelets);
  const complete = cornerFacelets.every((c) => c.length === 3) && wingFacelets.every((w) => w.length === 2) && centreFacelets.every((c) => c >= 0);
  if (!complete) {
    throw new Error("444-pieces: the geometry did not account for every piece");
  }
  cached = { facelets, cornerFacelets, wingFacelets, centreFacelets, centreFace };
  return cached;
}
function orderWingFacelets(facelets, wings) {
  const slotOfFacelet = /* @__PURE__ */ new Map();
  wings.forEach((ids, slot) => ids.forEach((id) => slotOfFacelet.set(id, slot)));
  const permutations = allMovesForSize(SIZE_444).map(
    (move) => deriveFaceletPermutation(facelets, move, SIZE_444)
  );
  const first = new Array(wings.length).fill(-1);
  first[0] = wings[0][0];
  const queue = [0];
  for (let head = 0; head < queue.length; head += 1) {
    const slot = queue[head];
    for (const destination of permutations) {
      const landedFirst = destination[first[slot]];
      const landedSlot = slotOfFacelet.get(landedFirst);
      if (first[landedSlot] === -1) {
        first[landedSlot] = landedFirst;
        queue.push(landedSlot);
        continue;
      }
      if (first[landedSlot] !== landedFirst) {
        throw new Error(
          `444-pieces: wing ${landedSlot} would have to flip \u2014 the propagated order is inconsistent`
        );
      }
    }
  }
  if (first.some((id) => id === -1)) {
    throw new Error("444-pieces: the moves do not reach every wing");
  }
  wings.forEach((ids, slot) => {
    const lead = first[slot];
    wings[slot] = [lead, ids.find((id) => id !== lead)];
  });
}
function orderCornerFacelets(facelets, ids, cubie) {
  const byAxis = /* @__PURE__ */ new Map();
  for (const id of ids) {
    const axis = facelets[id].normal.findIndex((component) => component !== 0);
    byAxis.set(axis, id);
  }
  const chirality = Math.sign(cubie[0] * cubie[1] * cubie[2]);
  const order = chirality > 0 ? [1, 0, 2] : [1, 2, 0];
  return order.map((axis) => byAxis.get(axis));
}
var SOLVED_444_STATE = {
  cornerPermutation: Array.from({ length: CORNER_COUNT_444 }, (_, i) => i),
  cornerOrientation: new Array(CORNER_COUNT_444).fill(0),
  wingPermutation: Array.from({ length: WING_COUNT_444 }, (_, i) => i),
  centreColour: Array.from({ length: CENTRE_COUNT_444 }, (_, i) => pieces444().centreFace[i])
};
var tables2;
function move444Tables() {
  if (tables2) return tables2;
  const { facelets, cornerFacelets, wingFacelets, centreFacelets } = pieces444();
  const cornerSlotOfFacelet = /* @__PURE__ */ new Map();
  cornerFacelets.forEach((ids, slot) => {
    ids.forEach((id, index) => cornerSlotOfFacelet.set(id, { slot, index }));
  });
  const wingSlotOfFacelet = /* @__PURE__ */ new Map();
  wingFacelets.forEach((ids, slot) => ids.forEach((id) => wingSlotOfFacelet.set(id, slot)));
  const centreSlotOfFacelet = /* @__PURE__ */ new Map();
  centreFacelets.forEach((id, slot) => centreSlotOfFacelet.set(id, slot));
  tables2 = allMovesForSize(SIZE_444).map((move) => {
    const destination = deriveFaceletPermutation(facelets, move, SIZE_444);
    const cornerDestination = new Array(CORNER_COUNT_444).fill(-1);
    const cornerTwist = new Array(CORNER_COUNT_444).fill(-1);
    for (let slot = 0; slot < CORNER_COUNT_444; slot += 1) {
      const landed = cornerSlotOfFacelet.get(destination[cornerFacelets[slot][0]]);
      cornerDestination[slot] = landed.slot;
      cornerTwist[slot] = landed.index;
      for (let index = 0; index < 3; index += 1) {
        const other = cornerSlotOfFacelet.get(destination[cornerFacelets[slot][index]]);
        if (other.slot !== landed.slot || other.index !== (index + landed.index) % 3) {
          throw new Error(`444-state: ${move.face} tore corner ${slot} apart`);
        }
      }
    }
    const wingDestination = new Array(WING_COUNT_444).fill(-1);
    for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
      const ids = wingFacelets[slot];
      const landed = wingSlotOfFacelet.get(destination[ids[0]]);
      if (wingSlotOfFacelet.get(destination[ids[1]]) !== landed) {
        throw new Error(`444-state: ${move.face} tore wing ${slot} apart`);
      }
      wingDestination[slot] = landed;
    }
    const centreDestination = new Array(CENTRE_COUNT_444).fill(-1);
    for (let slot = 0; slot < CENTRE_COUNT_444; slot += 1) {
      centreDestination[slot] = centreSlotOfFacelet.get(destination[centreFacelets[slot]]);
    }
    return { move, cornerDestination, cornerTwist, wingDestination, centreDestination };
  });
  return tables2;
}
function apply444Table(state, table4) {
  const cornerPermutation = new Array(CORNER_COUNT_444);
  const cornerOrientation = new Array(CORNER_COUNT_444);
  for (let slot = 0; slot < CORNER_COUNT_444; slot += 1) {
    const landing = table4.cornerDestination[slot];
    cornerPermutation[landing] = state.cornerPermutation[slot];
    cornerOrientation[landing] = (state.cornerOrientation[slot] + table4.cornerTwist[slot]) % 3;
  }
  const wingPermutation = new Array(WING_COUNT_444);
  for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
    wingPermutation[table4.wingDestination[slot]] = state.wingPermutation[slot];
  }
  const centreColour = new Array(CENTRE_COUNT_444);
  for (let slot = 0; slot < CENTRE_COUNT_444; slot += 1) {
    centreColour[table4.centreDestination[slot]] = state.centreColour[slot];
  }
  return { cornerPermutation, cornerOrientation, wingPermutation, centreColour };
}
function apply444Moves(state, moveIndices) {
  const all = move444Tables();
  return moveIndices.reduce((current, index) => apply444Table(current, all[index]), state);
}
function is444Solved(state) {
  return cube444StatesEqual(state, SOLVED_444_STATE);
}
function cube444StatesEqual(a, b) {
  return a.cornerPermutation.every((v, i) => v === b.cornerPermutation[i]) && a.cornerOrientation.every((v, i) => v === b.cornerOrientation[i]) && a.wingPermutation.every((v, i) => v === b.wingPermutation[i]) && a.centreColour.every((v, i) => v === b.centreColour[i]);
}
var SLOT_COUNT = 24;
var BINOMIAL = (() => {
  const table4 = [];
  for (let n = 0; n <= SLOT_COUNT; n += 1) {
    const row = new Array(SLOT_COUNT + 2).fill(0);
    row[0] = 1;
    for (let k = 1; k <= SLOT_COUNT + 1; k += 1) {
      row[k] = (table4[n - 1]?.[k] ?? 0) + (table4[n - 1]?.[k - 1] ?? 0);
    }
    table4.push(row);
  }
  return table4;
})();
function binomial(n, k) {
  return BINOMIAL[n][k];
}
function subsetCount(size) {
  return binomial(SLOT_COUNT, size);
}
function rankSubset(mask, size) {
  let rank = 0;
  let index = 1;
  for (let bits = mask; bits !== 0; bits &= bits - 1) {
    const slot = 31 - Math.clz32(bits & -bits);
    rank += BINOMIAL[slot][index];
    index += 1;
  }
  if (index !== size + 1) {
    throw new Error(`444-subsets: expected a subset of ${size} slots, got ${index - 1}`);
  }
  return rank;
}
function buildMaskPermuter(destination) {
  const lookup = new Int32Array(3 * 256);
  for (let chunk = 0; chunk < 3; chunk += 1) {
    for (let byte = 0; byte < 256; byte += 1) {
      let permuted = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        if ((byte & 1 << bit) === 0) continue;
        permuted |= 1 << destination[chunk * 8 + bit];
      }
      lookup[chunk * 256 + byte] = permuted;
    }
  }
  return lookup;
}
function permuteMask(mask, lookup) {
  return lookup[mask & 255] | lookup[256 + (mask >>> 8 & 255)] | lookup[512 + (mask >>> 16 & 255)];
}
var CENTRE_SUBSET_SIZE = 8;
var CENTRE_SUBSET_COUNT = subsetCount(CENTRE_SUBSET_SIZE);
function rankCentreSubset(mask) {
  return rankSubset(mask, CENTRE_SUBSET_SIZE);
}
var AXIS_PAIRS = [
  [FACES.indexOf("U"), FACES.indexOf("D")],
  [FACES.indexOf("F"), FACES.indexOf("B")],
  [FACES.indexOf("L"), FACES.indexOf("R")]
];
function centreMaskFor(state, pair) {
  let mask = 0;
  for (let slot = 0; slot < CENTRE_COUNT_444; slot += 1) {
    const colour = state.centreColour[slot];
    if (colour === pair[0] || colour === pair[1]) mask |= 1 << slot;
  }
  return mask;
}
function solvedCentreMaskFor(pair) {
  const { centreFace } = pieces444();
  let mask = 0;
  for (let slot = 0; slot < CENTRE_COUNT_444; slot += 1) {
    const face = centreFace[slot];
    if (face === pair[0] || face === pair[1]) mask |= 1 << slot;
  }
  return mask;
}
var maskTables;
function centreMaskTables() {
  maskTables ??= move444Tables().map((table4) => buildMaskPermuter(table4.centreDestination));
  return maskTables;
}
function permuteCentreMask(mask, moveIndex3) {
  return permuteMask(mask, centreMaskTables()[moveIndex3]);
}
function buildCentrePairTable(pair) {
  const moveCount = move444Tables().length;
  const distance2 = new Uint8Array(CENTRE_SUBSET_COUNT).fill(255);
  const queue = new Int32Array(CENTRE_SUBSET_COUNT);
  const goal = solvedCentreMaskFor(pair);
  distance2[rankCentreSubset(goal)] = 0;
  queue[0] = goal;
  let tail = 1;
  for (let head = 0; head < tail; head += 1) {
    const mask = queue[head];
    const depth = distance2[rankCentreSubset(mask)] + 1;
    for (let move = 0; move < moveCount; move += 1) {
      const next = permuteCentreMask(mask, move);
      const rank = rankCentreSubset(next);
      if (distance2[rank] !== 255) continue;
      distance2[rank] = depth;
      queue[tail] = next;
      tail += 1;
    }
  }
  if (tail !== CENTRE_SUBSET_COUNT) {
    throw new Error(
      `444-phase1: the centre subsets are not all reachable (${tail} of ${CENTRE_SUBSET_COUNT})`
    );
  }
  return distance2;
}
var tables3 = /* @__PURE__ */ new Map();
function centrePairTable(index) {
  const cached2 = tables3.get(index);
  if (cached2) return cached2;
  const built = buildCentrePairTable(AXIS_PAIRS[index]);
  tables3.set(index, built);
  return built;
}
function phase1CoordinateOf(state) {
  return {
    upDown: centreMaskFor(state, AXIS_PAIRS[0]),
    frontBack: centreMaskFor(state, AXIS_PAIRS[1]),
    leftRight: centreMaskFor(state, AXIS_PAIRS[2])
  };
}
function isPhase1Solved(coordinate) {
  return coordinate.upDown === solvedCentreMaskFor(AXIS_PAIRS[0]) && coordinate.frontBack === solvedCentreMaskFor(AXIS_PAIRS[1]);
}
function phase1LowerBound(coordinate) {
  return Math.max(
    centrePairTable(0)[rankCentreSubset(coordinate.upDown)],
    centrePairTable(1)[rankCentreSubset(coordinate.frontBack)],
    centrePairTable(2)[rankCentreSubset(coordinate.leftRight)]
  );
}
function centrePreservingMoveIndices() {
  return move444Tables().map((table4, index) => ({ table: table4, index })).filter(({ table: table4 }) => table4.move.depth === 1 || table4.move.amount === 2).map(({ index }) => index);
}
function edgeOfWingSlot(slot) {
  return Math.floor(slot / 2);
}
function areWingsPaired(state) {
  for (let edge = 0; edge < WING_COUNT_444 / 2; edge += 1) {
    const first = state.wingPermutation[2 * edge];
    const second = state.wingPermutation[2 * edge + 1];
    if (edgeOfWingSlot(first) !== edgeOfWingSlot(second)) return false;
  }
  return true;
}
function areCentresSolved(state) {
  const { centreFace } = pieces444();
  for (let slot = 0; slot < CENTRE_COUNT_444; slot += 1) {
    if (state.centreColour[slot] !== centreFace[slot]) return false;
  }
  return true;
}
function isReduced(state) {
  return areCentresSolved(state) && areWingsPaired(state);
}
var CENTRE_PAIR_SUBSETS = binomial(8, 4);
var CENTRE_COORDINATE_COUNT = CENTRE_PAIR_SUBSETS ** 3;
var layout;
function centreLayout() {
  if (layout) return layout;
  const { centreFace } = pieces444();
  const slots = AXIS_PAIRS.map((pair) => {
    const own = [];
    for (let slot = 0; slot < CENTRE_COUNT_444; slot += 1) {
      if (pair.includes(centreFace[slot])) own.push(slot);
    }
    if (own.length !== 8) throw new Error("444-centres: an axis pair without eight slots");
    return own;
  });
  const tables4 = move444Tables();
  const destination = centrePreservingMoveIndices().map(
    (moveIndex3) => slots.map((own) => {
      const map = new Int32Array(8);
      for (const [index, slot] of own.entries()) {
        const target = own.indexOf(tables4[moveIndex3].centreDestination[slot]);
        if (target < 0) {
          throw new Error("444-centres: a centre-preserving move left its axis pair");
        }
        map[index] = target;
      }
      return map;
    })
  );
  layout = { slots, destination };
  return layout;
}
function pairMask(centreColour, pair) {
  const { slots } = centreLayout();
  const colour = AXIS_PAIRS[pair][0];
  let mask = 0;
  for (const [index, slot] of slots[pair].entries()) {
    if (centreColour[slot] === colour) mask |= 1 << index;
  }
  return mask;
}
function coordinateOfColours(centreColour) {
  return rankSubset(pairMask(centreColour, 0), 4) + CENTRE_PAIR_SUBSETS * rankSubset(pairMask(centreColour, 1), 4) + CENTRE_PAIR_SUBSETS ** 2 * rankSubset(pairMask(centreColour, 2), 4);
}
function centreCoordinateOf(state) {
  return coordinateOfColours(state.centreColour);
}
function solvedCentreCoordinate() {
  return coordinateOfColours(pieces444().centreFace);
}
var unrankCache;
function unrankPairMask(rank) {
  if (!unrankCache) {
    unrankCache = new Int32Array(CENTRE_PAIR_SUBSETS);
    for (let mask = 0; mask < 256; mask += 1) {
      let bits = 0;
      for (let bit = 0; bit < 8; bit += 1) if ((mask & 1 << bit) !== 0) bits += 1;
      if (bits === 4) unrankCache[rankSubset(mask, 4)] = mask;
    }
  }
  return unrankCache[rank];
}
function permutePairMask(mask, map) {
  let moved = 0;
  for (let index = 0; index < 8; index += 1) {
    if ((mask & 1 << index) !== 0) moved |= 1 << map[index];
  }
  return moved;
}
function applyCentreCoordinate(coordinate, move) {
  const maps = centreLayout().destination[move];
  const first = coordinate % CENTRE_PAIR_SUBSETS;
  const second = Math.floor(coordinate / CENTRE_PAIR_SUBSETS) % CENTRE_PAIR_SUBSETS;
  const third = Math.floor(coordinate / CENTRE_PAIR_SUBSETS ** 2);
  return rankSubset(permutePairMask(unrankPairMask(first), maps[0]), 4) + CENTRE_PAIR_SUBSETS * rankSubset(permutePairMask(unrankPairMask(second), maps[1]), 4) + CENTRE_PAIR_SUBSETS ** 2 * rankSubset(permutePairMask(unrankPairMask(third), maps[2]), 4);
}
var table3;
function centreTable() {
  if (table3) return table3;
  const moveCount = centrePreservingMoveIndices().length;
  const distance2 = new Uint8Array(CENTRE_COORDINATE_COUNT).fill(255);
  const queue = new Int32Array(CENTRE_COORDINATE_COUNT);
  const start = solvedCentreCoordinate();
  distance2[start] = 0;
  queue[0] = start;
  let tail = 1;
  for (let head = 0; head < tail; head += 1) {
    const coordinate = queue[head];
    const depth = distance2[coordinate] + 1;
    for (let move = 0; move < moveCount; move += 1) {
      const next = applyCentreCoordinate(coordinate, move);
      if (distance2[next] !== 255) continue;
      distance2[next] = depth;
      queue[tail] = next;
      tail += 1;
    }
  }
  table3 = distance2;
  return distance2;
}
function solveCentres444(state) {
  const preserving = centrePreservingMoveIndices();
  const distances = centreTable();
  const moves = [];
  let coordinate = centreCoordinateOf(state);
  let remaining = distances[coordinate];
  if (remaining === 255) {
    throw new Error("444-centres: this centre coordinate is unreachable \u2014 run phase 1 first");
  }
  while (remaining > 0) {
    let stepped = false;
    for (const [index, moveIndex3] of preserving.entries()) {
      const next = applyCentreCoordinate(coordinate, index);
      if (distances[next] !== remaining - 1) continue;
      moves.push(moveIndex3);
      coordinate = next;
      remaining -= 1;
      stepped = true;
      break;
    }
    if (!stepped) throw new Error("444-centres: exact table with no descending move");
  }
  return moves;
}
[
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 11]
].map(([a, b]) => [2 * a, 2 * a + 1, 2 * b, 2 * b + 1]);
var SINGLE_EDGE_COORDINATE_COUNT = 24 * 23;
function rankSingleEdge(first, second) {
  return first * 23 + (second > first ? second - 1 : second);
}
function singleEdgeFromRank(rank) {
  const first = Math.floor(rank / 23);
  const offset = rank % 23;
  return [first, offset >= first ? offset + 1 : offset];
}
var singleEdge;
function singleEdgeTable() {
  if (singleEdge) return singleEdge;
  const moves = centrePreservingMoveIndices();
  const tables4 = move444Tables();
  const distance2 = new Uint8Array(SINGLE_EDGE_COORDINATE_COUNT).fill(255);
  const queue = new Int32Array(SINGLE_EDGE_COORDINATE_COUNT);
  let tail = 0;
  for (let rank = 0; rank < SINGLE_EDGE_COORDINATE_COUNT; rank += 1) {
    const [first, second] = singleEdgeFromRank(rank);
    if (edgeOfWingSlot(first) !== edgeOfWingSlot(second)) continue;
    distance2[rank] = 0;
    queue[tail] = rank;
    tail += 1;
  }
  for (let head = 0; head < tail; head += 1) {
    const rank = queue[head];
    const [first, second] = singleEdgeFromRank(rank);
    const depth = distance2[rank] + 1;
    for (const move of moves) {
      const next = rankSingleEdge(
        tables4[move].wingDestination[first],
        tables4[move].wingDestination[second]
      );
      if (distance2[next] !== 255) continue;
      distance2[next] = depth;
      queue[tail] = next;
      tail += 1;
    }
  }
  singleEdge = distance2;
  return distance2;
}
function mergePass(moves) {
  const out = [];
  let changed = false;
  for (const move of moves) {
    const axis = moveAxis(move);
    const layerSet = moveLayerSet(move);
    let merged = false;
    for (let index = out.length - 1; index >= 0; index -= 1) {
      const earlier = out[index];
      if (moveAxis(earlier) !== axis) break;
      if (moveLayerSet(earlier) !== layerSet) continue;
      const amount = (earlier.amount + move.amount) % 4;
      if (amount === 0) out.splice(index, 1);
      else out[index] = { face: move.face, depth: move.depth, amount };
      merged = true;
      changed = true;
      break;
    }
    if (!merged) out.push(move);
  }
  return changed ? out : void 0;
}
function mergeWideMoves(moves) {
  let current = [...moves];
  for (; ; ) {
    const next = mergePass(current);
    if (!next) return current;
    current = next;
  }
}
function randomCube444State(random) {
  const cornerPermutation = randomPermutation(random, CORNER_COUNT_444);
  const cornerOrientation = new Array(CORNER_COUNT_444).fill(0);
  let twistSum = 0;
  for (let corner = 0; corner < CORNER_COUNT_444 - 1; corner += 1) {
    const twist = randomInt(random, 3);
    cornerOrientation[corner] = twist;
    twistSum += twist;
  }
  cornerOrientation[CORNER_COUNT_444 - 1] = (3 - twistSum % 3) % 3;
  const wingPermutation = randomPermutation(random, WING_COUNT_444);
  const centreColour = pieces444().centreFace.map((face) => face);
  for (let i = centreColour.length - 1; i > 0; i -= 1) {
    const j = randomInt(random, i + 1);
    [centreColour[i], centreColour[j]] = [centreColour[j], centreColour[i]];
  }
  return { cornerPermutation, cornerOrientation, wingPermutation, centreColour };
}
var flipReference;
function edgeFlipReference() {
  if (flipReference) return flipReference;
  const edges = WING_COUNT_444 / 2;
  const tables4 = move444Tables();
  const constraints = [];
  for (const faceMove of allFaceMoves()) {
    const index = tables4.findIndex(
      (table4) => table4.move.depth === 1 && table4.move.face === faceMove.face && table4.move.amount === faceMove.amount
    );
    if (index < 0) continue;
    const turned444 = apply444Moves(SOLVED_444_STATE, [index]);
    const turned333 = applyMoves(SOLVED_STATE, [faceMove]);
    for (let slot = 0; slot < edges; slot += 1) {
      const wing = turned444.wingPermutation[2 * slot];
      const piece = Math.floor(wing / 2);
      if (piece === slot) continue;
      constraints.push([slot, piece, wing % 2 ^ turned333.edgeOrientation[slot]]);
    }
  }
  const bits = new Array(edges).fill(-1);
  bits[0] = 0;
  for (let sweep = 0; sweep < edges; sweep += 1) {
    for (const [a, b, bit] of constraints) {
      if (bits[a] !== -1 && bits[b] === -1) bits[b] = bits[a] ^ bit;
      else if (bits[b] !== -1 && bits[a] === -1) bits[a] = bits[b] ^ bit;
    }
    if (bits.every((bit) => bit !== -1)) break;
  }
  if (bits.some((bit) => bit === -1)) {
    throw new Error("@cubesmith/scrambler: 4x4x4 flip reference is underdetermined");
  }
  for (const [a, b, bit] of constraints) {
    if ((bits[a] ^ bits[b]) !== bit) {
      throw new Error("@cubesmith/scrambler: 4x4x4 flip reference is inconsistent");
    }
  }
  flipReference = bits;
  return flipReference;
}
function to333State(state) {
  if (!areWingsPaired(state) || !areCentresSolved(state)) {
    throw new Error("@cubesmith/scrambler: 4x4x4 hand-off needs a reduced cube");
  }
  const reference = edgeFlipReference();
  const edgePermutation = new Array(WING_COUNT_444 / 2);
  const edgeOrientation = new Array(WING_COUNT_444 / 2);
  for (let edge = 0; edge < WING_COUNT_444 / 2; edge += 1) {
    const wing = state.wingPermutation[2 * edge];
    const piece = Math.floor(wing / 2);
    edgePermutation[edge] = piece;
    edgeOrientation[edge] = wing % 2 ^ reference[edge] ^ reference[piece];
  }
  return {
    cornerPermutation: [...state.cornerPermutation],
    cornerOrientation: [...state.cornerOrientation],
    edgePermutation,
    edgeOrientation
  };
}
function permutationParity2(permutation) {
  const seen = new Array(permutation.length).fill(false);
  let transpositions = 0;
  for (let start = 0; start < permutation.length; start += 1) {
    if (seen[start]) continue;
    let length2 = 0;
    for (let at = start; !seen[at]; at = permutation[at]) {
      seen[at] = true;
      length2 += 1;
    }
    transpositions += length2 - 1;
  }
  return transpositions % 2;
}
function is333Reachable(state) {
  const twist = state.cornerOrientation.reduce((sum, twist2) => sum + twist2, 0);
  if (twist % 3 !== 0) return false;
  const flips = state.edgeOrientation.reduce((sum, flip) => sum + flip, 0);
  if (flips % 2 !== 0) return false;
  return permutationParity2(state.cornerPermutation) === permutationParity2(state.edgePermutation);
}
function parityOf444Handoff(state) {
  const flips = state.edgeOrientation.reduce((sum, flip) => sum + flip, 0) % 2 !== 0;
  const swapped = permutationParity2(state.cornerPermutation) !== permutationParity2(state.edgePermutation);
  if (flips && swapped) return "both";
  if (flips) return "flip";
  if (swapped) return "permutation";
  return "none";
}
function wingEffectOf(moves) {
  const tables4 = move444Tables();
  const destination = Array.from({ length: WING_COUNT_444 }, (_, slot) => slot);
  for (const move of moves) {
    for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
      destination[slot] = tables4[move].wingDestination[destination[slot]];
    }
  }
  return destination;
}
function inverseMoveIndex(move) {
  const tables4 = move444Tables();
  const { face, depth, amount } = tables4[move].move;
  const wanted = amount === 2 ? 2 : amount === 1 ? 3 : 1;
  const index = tables4.findIndex(
    (candidate) => candidate.move.face === face && candidate.move.depth === depth && candidate.move.amount === wanted
  );
  if (index < 0) throw new Error("444-generators: a move without an inverse");
  return index;
}
function preservesSlotPairsMap(destination) {
  for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
    const sibling = slot % 2 === 0 ? slot + 1 : slot - 1;
    if (Math.floor(destination[slot] / 2) !== Math.floor(destination[sibling] / 2)) {
      return false;
    }
  }
  return true;
}
function isCentreNeutral(moves) {
  const tables4 = move444Tables();
  const solved = SOLVED_444_STATE.centreColour;
  let colours = solved;
  for (const move of moves) {
    const { centreDestination } = tables4[move];
    const next = new Array(colours.length);
    for (let slot = 0; slot < colours.length; slot += 1) {
      next[centreDestination[slot]] = colours[slot];
    }
    colours = next;
  }
  for (let slot = 0; slot < colours.length; slot += 1) {
    if (colours[slot] !== solved[slot]) return false;
  }
  return true;
}
var conjugates;
function conjugateLibrary(coreDepth = 4) {
  if (conjugates) return conjugates;
  const tables4 = move444Tables();
  const wide = tables4.map((table4, index) => ({ table: table4, index })).filter(({ table: table4 }) => table4.move.depth === 2).map(({ index }) => index);
  const outer = tables4.map((table4, index) => ({ table: table4, index })).filter(({ table: table4 }) => table4.move.depth === 1).map(({ index }) => index);
  const byEffect = /* @__PURE__ */ new Map();
  const core = [];
  const walkCore = (setup, setupInverse, previous) => {
    if (core.length > 0) {
      const moves = [setup, ...core, setupInverse];
      const destination = wingEffectOf(moves);
      if (!preservesSlotPairsMap(destination) && isCentreNeutral(moves)) {
        let support = 0;
        for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
          if (destination[slot] !== slot) support += 1;
        }
        const key = destination.join(",");
        const existing = byEffect.get(key);
        if (!existing || existing.moves.length > moves.length) {
          byEffect.set(key, {
            moves,
            setup: [setup],
            core: [...core],
            wingDestination: destination,
            support
          });
        }
      }
    }
    if (core.length >= coreDepth) return;
    for (const move of outer) {
      if (previous >= 0 && tables4[move].move.face === tables4[previous].move.face) continue;
      core.push(move);
      walkCore(setup, setupInverse, move);
      core.pop();
    }
  };
  for (const setup of wide) {
    walkCore(setup, inverseMoveIndex(setup), -1);
  }
  conjugates = [...byEffect.values()].sort(
    (a, b) => a.support - b.support || a.moves.length - b.moves.length
  );
  return conjugates;
}
var extended;
function extendedLibrary() {
  if (extended) return extended;
  const library = conjugateLibrary(4);
  const small = library.filter((generator) => generator.support === 6);
  const byEffect = /* @__PURE__ */ new Map();
  for (const first of small) {
    for (const second of library) {
      const destination = new Array(WING_COUNT_444);
      let support = 0;
      for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
        const landed = second.wingDestination[first.wingDestination[slot]];
        destination[slot] = landed;
        if (landed !== slot) support += 1;
      }
      if (support === 0 || support > 4) continue;
      const key = destination.join(",");
      const moves = [...first.moves, ...second.moves];
      const existing = byEffect.get(key);
      if (existing && existing.moves.length <= moves.length) continue;
      byEffect.set(key, {
        moves,
        setup: first.setup,
        core: first.core,
        wingDestination: destination,
        support
      });
    }
  }
  extended = [...library, ...byEffect.values()].sort(
    (a, b) => a.support - b.support || a.moves.length - b.moves.length
  );
  return extended;
}
var edgeOf = (slot) => Math.floor(slot / 2);
function pairedEdgeCount(wingPermutation) {
  let paired = 0;
  for (let edge = 0; edge < WING_COUNT_444 / 2; edge += 1) {
    if (edgeOf(wingPermutation[2 * edge]) === edgeOf(wingPermutation[2 * edge + 1])) {
      paired += 1;
    }
  }
  return paired;
}
function areAllEdgesPaired(wingPermutation) {
  return pairedEdgeCount(wingPermutation) === WING_COUNT_444 / 2;
}
function applyGenerator(wingPermutation, generator) {
  const next = new Array(WING_COUNT_444);
  for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
    next[generator.wingDestination[slot]] = wingPermutation[slot];
  }
  return next;
}
var PairingStalledError = class extends Error {
  paired;
  constructor(paired) {
    super(
      `@cubesmith/scrambler: 4x4x4 pairing stalled with ${paired} of 12 edges paired \u2014 the greedy step is insufficient even though the library is complete`
    );
    this.name = "PairingStalledError";
    this.paired = paired;
  }
};
var compiled;
function prepareCompiledLibrary() {
  compiledLibrary();
}
function compiledLibrary() {
  if (compiled) return compiled;
  const library = extendedLibrary();
  const count = library.length;
  const destination = new Uint8Array(count * WING_COUNT_444);
  const source = new Uint8Array(count * WING_COUNT_444);
  const length2 = new Uint8Array(count);
  library.forEach((generator, index) => {
    const base = index * WING_COUNT_444;
    for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
      const landed = generator.wingDestination[slot];
      destination[base + slot] = landed;
      source[base + landed] = slot;
    }
    length2[index] = generator.moves.length;
  });
  compiled = { destination, source, length: length2, count };
  return compiled;
}
function pairedInTyped(wings) {
  let paired = 0;
  for (let edge = 0; edge < WING_COUNT_444 / 2; edge += 1) {
    if (wings[2 * edge] >> 1 === wings[2 * edge + 1] >> 1) paired += 1;
  }
  return paired;
}
var PAIRING_BEAM_WIDTH = 64;
var MOVES_PER_EDGE_ESTIMATE = 4;
function searchPairing(state) {
  const library = extendedLibrary();
  const { destination, source, length: length2, count } = compiledLibrary();
  const start = new Uint8Array(WING_COUNT_444);
  for (let slot = 0; slot < WING_COUNT_444; slot += 1) start[slot] = state.wingPermutation[slot];
  let beam = [{ wings: start, moves: 0, path: [] }];
  let best;
  const edges = WING_COUNT_444 / 2;
  const compose = (node, generator) => {
    const base = generator * WING_COUNT_444;
    const composed = new Uint8Array(WING_COUNT_444);
    for (let slot = 0; slot < WING_COUNT_444; slot += 1) {
      composed[destination[base + slot]] = node.wings[slot];
    }
    return composed;
  };
  for (let depth = 0; depth < edges && beam.length > 0; depth += 1) {
    const shortlistLimit = PAIRING_BEAM_WIDTH * 2;
    const shortlist = [];
    let worst = Infinity;
    for (const node of beam) {
      const wings = node.wings;
      const current = pairedInTyped(wings);
      for (let generator = 0; generator < count; generator += 1) {
        const base = generator * WING_COUNT_444;
        let paired = 0;
        for (let edge = 0; edge < edges; edge += 1) {
          const first = wings[source[base + 2 * edge]];
          const second = wings[source[base + 2 * edge + 1]];
          if (first >> 1 === second >> 1) paired += 1;
        }
        if (paired <= current) continue;
        const moves2 = node.moves + length2[generator];
        if (best && moves2 >= best.moves) continue;
        if (paired === edges) {
          best = { wings: compose(node, generator), moves: moves2, path: [...node.path, generator] };
          continue;
        }
        const score = moves2 + (edges - paired) * MOVES_PER_EDGE_ESTIMATE;
        if (shortlist.length >= shortlistLimit && score >= worst) continue;
        let at = shortlist.length;
        while (at > 0 && shortlist[at - 1].score > score) at -= 1;
        shortlist.splice(at, 0, { node, generator, moves: moves2, score });
        if (shortlist.length > shortlistLimit) shortlist.pop();
        worst = shortlist[shortlist.length - 1].score;
      }
    }
    if (shortlist.length === 0) break;
    const seen = /* @__PURE__ */ new Set();
    beam = [];
    for (const candidate of shortlist) {
      const wings = compose(candidate.node, candidate.generator);
      const key = wings.join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      beam.push({
        wings,
        moves: candidate.moves,
        path: [...candidate.node.path, candidate.generator]
      });
      if (beam.length >= PAIRING_BEAM_WIDTH) break;
    }
  }
  if (!best) return void 0;
  const moves = [];
  for (const generator of best.path) moves.push(...library[generator].moves);
  return {
    moves,
    wingPermutation: [...best.wings],
    steps: best.path.length
  };
}
function pairWings444(state, maxSteps = 40) {
  return searchPairing(state) ?? greedyPairWings444(state, maxSteps);
}
function greedyPairWings444(state, maxSteps = 40) {
  const library = extendedLibrary();
  let wings = [...state.wingPermutation];
  const moves = [];
  let steps = 0;
  while (!areAllEdgesPaired(wings)) {
    if (steps >= maxSteps) throw new PairingStalledError(pairedEdgeCount(wings));
    const current = pairedEdgeCount(wings);
    let best;
    for (const generator of library) {
      const paired = pairedEdgeCount(applyGenerator(wings, generator));
      if (paired <= current) continue;
      if (!best || paired > best.paired || paired === best.paired && generator.moves.length < best.generator.moves.length) {
        best = { generator, paired };
      }
      if (paired === current + 3) break;
    }
    if (best) {
      wings = applyGenerator(wings, best.generator);
      moves.push(...best.generator.moves);
      steps += 1;
      continue;
    }
    const rescue = lookAhead(library, wings, current);
    if (!rescue) throw new PairingStalledError(current);
    for (const generator of rescue) {
      wings = applyGenerator(wings, generator);
      moves.push(...generator.moves);
      steps += 1;
    }
  }
  return { moves, wingPermutation: wings, steps };
}
function lookAhead(library, wings, current) {
  const candidates = library.map((generator) => ({ generator, wings: applyGenerator(wings, generator) })).map((step) => ({ ...step, paired: pairedEdgeCount(step.wings) })).filter((step) => step.paired >= current - 3).sort((a, b) => b.paired - a.paired || a.generator.moves.length - b.generator.moves.length);
  for (const first of candidates) {
    for (const second of library) {
      if (pairedEdgeCount(applyGenerator(first.wings, second)) > current) {
        return [first.generator, second];
      }
    }
  }
  return void 0;
}
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return (t ^ t >>> 14) >>> 0;
  };
}
function hashStringToUint32(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function seedToUint32(seed) {
  if (typeof seed === "string") return hashStringToUint32(seed);
  return Math.floor(seed) >>> 0;
}
function createSeededSource(seed) {
  const next = mulberry32(seedToUint32(seed));
  return { nextUint32: next };
}
function createCryptoSource() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    return {
      nextUint32: () => {
        const buffer = new Uint32Array(1);
        cryptoObj.getRandomValues(buffer);
        return buffer[0];
      }
    };
  }
  return {
    nextUint32: () => Math.floor(Math.random() * 4294967296)
  };
}
function createRandomSource(seed) {
  if (seed !== void 0) return createSeededSource(seed);
  return createCryptoSource();
}
var meta;
function moveMeta() {
  meta ??= move444Tables().map((table4) => ({
    axis: moveAxis(table4.move),
    layerSet: moveLayerSet(table4.move)
  }));
  return meta;
}
function phase1Solutions2(state, options = {}) {
  const start = phase1CoordinateOf(state);
  const maxLength = options.maxLength ?? 12;
  const maxSolutions = options.maxSolutions ?? 1;
  const visit = options.visit;
  const info = moveMeta();
  const moveCount = info.length;
  const solutions = [];
  const path = [];
  let stopped = false;
  const search = (upDown, frontBack, leftRight, cost, bound, previous) => {
    if (stopped) return;
    const coordinate = { upDown, frontBack, leftRight };
    const remaining = phase1LowerBound(coordinate);
    if (remaining === 0 && isPhase1Solved(coordinate)) {
      if (cost !== bound) return;
      if (visit) {
        if (visit(path)) stopped = true;
      } else {
        solutions.push([...path]);
        if (solutions.length >= maxSolutions) stopped = true;
      }
      return;
    }
    if (cost + remaining > bound) return;
    for (let move = 0; move < moveCount; move += 1) {
      if (previous >= 0) {
        if (info[move].layerSet === info[previous].layerSet) continue;
        if (info[move].axis === info[previous].axis && info[move].layerSet < info[previous].layerSet) {
          continue;
        }
      }
      path.push(move);
      search(
        permuteCentreMask(upDown, move),
        permuteCentreMask(frontBack, move),
        permuteCentreMask(leftRight, move),
        cost + 1,
        bound,
        move
      );
      path.pop();
      if (stopped) return;
    }
  };
  const optimal = phase1LowerBound(start);
  for (let bound = optimal; bound <= maxLength; bound += 1) {
    search(start.upDown, start.frontBack, start.leftRight, 0, bound, -1);
    if (stopped || solutions.length >= maxSolutions) break;
  }
  return solutions;
}
function phase1Search2(state) {
  const [solution] = phase1Solutions2(state);
  if (!solution) {
    throw new Error("444-phase1: no solution within the length cap \u2014 the tables are wrong");
  }
  return solution;
}
function permutationParity3(permutation) {
  const seen = new Array(permutation.length).fill(false);
  let transpositions = 0;
  for (let start = 0; start < permutation.length; start += 1) {
    if (seen[start]) continue;
    let length2 = 0;
    for (let at = start; !seen[at]; at = permutation[at]) {
      seen[at] = true;
      length2 += 1;
    }
    transpositions += length2 - 1;
  }
  return transpositions % 2;
}
function wingParityOf(wingPermutation) {
  return permutationParity3(wingPermutation);
}
var ODD_GADGET_POOL = 48;
var oddWings;
function oddWingGadget(index = 0) {
  oddWings ??= buildOddWingGadgets();
  const gadget = oddWings[index];
  if (!gadget) {
    throw new Error(
      `@cubesmith/scrambler: odd-wing gadget ${index} is past the pool of ${oddWings.length}`
    );
  }
  return gadget;
}
function prepareOddWingGadgets() {
  oddWings ??= buildOddWingGadgets();
}
function buildOddWingGadgets() {
  const tables4 = move444Tables();
  const random = createRandomSource("cubesmith 4x4x4 odd wing gadget");
  const found = [];
  for (let attempt = 0; found.length < ODD_GADGET_POOL; attempt += 1) {
    if (attempt >= 2e4) {
      throw new Error(`@cubesmith/scrambler: only ${found.length} odd-wing gadgets found`);
    }
    const prefix = Array.from(
      { length: 3 + attempt % 6 },
      () => randomInt(random, tables4.length)
    );
    const seeded = apply444Moves(SOLVED_444_STATE, prefix);
    const toPairs = phase1Search2(seeded);
    const withPairs = apply444Moves(seeded, toPairs);
    const sequence = [...prefix, ...toPairs, ...solveCentres444(withPairs)];
    const landed = apply444Moves(SOLVED_444_STATE, sequence);
    if (!areCentresSolved(landed) || !isCentreNeutral(sequence)) continue;
    if (wingParityOf(landed.wingPermutation) !== 1) continue;
    found.push(sequence);
  }
  return found.map((moves, discovered) => ({ moves, discovered })).sort((a, b) => a.moves.length - b.moves.length || a.discovered - b.discovered).map((entry) => entry.moves);
}
function reduceVia(state, toAxisPairs) {
  const afterPhase1 = apply444Moves(state, toAxisPairs);
  const centres = solveCentres444(afterPhase1);
  const withCentres = apply444Moves(afterPhase1, centres);
  const pairing = pairWings444(withCentres);
  const reduced = apply444Moves(withCentres, pairing.moves);
  if (!isReduced(reduced)) {
    throw new Error("@cubesmith/scrambler: 4x4x4 reduction did not reduce");
  }
  return {
    moves: [...toAxisPairs, ...centres, ...pairing.moves],
    state: reduced,
    centreMoves: toAxisPairs.length + centres.length,
    pairingMoves: pairing.moves.length
  };
}
function parityPassesFor(reduced) {
  switch (parityOf444Handoff(to333State(reduced))) {
    case "none":
      return 0;
    case "permutation":
      return 2;
    default:
      return 1;
  }
}
var MAX_REDUCTION_ROUTES = 4;
var MAX_EXTRA_PHASE1_LENGTH = 2;
var MAX_ROUTES_EXAMINED = 3e3;
function landsWithoutOllParity(state, route) {
  return wingParityOf(apply444Moves(state, route).wingPermutation) === 0;
}
function evenPhase1Routes(state, wanted) {
  const optimal = phase1Search2(state).length;
  const found = [];
  let examined = 0;
  phase1Solutions2(state, {
    maxLength: optimal + MAX_EXTRA_PHASE1_LENGTH,
    visit: (route) => {
      examined += 1;
      if (landsWithoutOllParity(state, route)) found.push([...route]);
      return found.length >= wanted || examined >= MAX_ROUTES_EXAMINED;
    }
  });
  return found;
}
function reduce444BestRoute(state, maxRoutes = MAX_REDUCTION_ROUTES) {
  const routes = [...evenPhase1Routes(state, maxRoutes), phase1Search2(state)];
  let best;
  for (const route of routes) {
    const reduction = reduceVia(state, route);
    const passes = parityPassesFor(reduction.state);
    if (!best || passes < best.passes || passes === best.passes && reduction.moves.length < best.reduction.moves.length) {
      best = { reduction, passes };
    }
    if (passes === 0) break;
  }
  return best.reduction;
}
var MAX_PARITY_PASSES = 8;
var PARITY_CANDIDATES = 6;
function partnerGadget(index) {
  return (index + 17) % (MAX_PARITY_PASSES * PARITY_CANDIDATES);
}
var Solve444Error = class extends Error {
  constructor(message) {
    super(`@cubesmith/scrambler: ${message}`);
    this.name = "Solve444Error";
  }
};
function outerIndex(face, amount) {
  const index = move444Tables().findIndex(
    (table4) => table4.move.depth === 1 && table4.move.face === face && table4.move.amount === amount
  );
  if (index < 0) throw new Solve444Error(`no 4x4x4 outer move for ${face}${amount}`);
  return index;
}
var indexByMove;
function moveIndexOf(move) {
  indexByMove ??= new Map(
    move444Tables().map((table4, index2) => [
      `${table4.move.face}${table4.move.depth}${table4.move.amount}`,
      index2
    ])
  );
  const index = indexByMove.get(`${move.face}${move.depth}${move.amount}`);
  if (index === void 0) {
    throw new Solve444Error(`no 4x4x4 move for ${move.face} depth ${move.depth} x${move.amount}`);
  }
  return index;
}
function mergeMoveIndices(moves) {
  const tables4 = move444Tables();
  const merged = mergeWideMoves(moves.map((index) => tables4[index].move));
  return merged.map(moveIndexOf);
}
function solve444(state) {
  const reduction = reduce444BestRoute(state);
  const moves = [...reduction.moves];
  let current = reduction.state;
  for (let pass = 0; !is333Reachable(to333State(current)); pass += 1) {
    if (pass >= MAX_PARITY_PASSES) {
      throw new Solve444Error(
        `4x4x4 parity unresolved after ${MAX_PARITY_PASSES} passes (${parityOf444Handoff(to333State(current))})`
      );
    }
    const doubled = parityOf444Handoff(to333State(current)) === "permutation";
    let chosen;
    for (let candidate = 0; candidate < PARITY_CANDIDATES; candidate += 1) {
      const at = pass * PARITY_CANDIDATES + candidate;
      const gadget = doubled ? [...oddWingGadget(at), ...oddWingGadget(partnerGadget(at))] : oddWingGadget(at);
      const disturbed = apply444Moves(current, gadget);
      const repaired = pairWings444(disturbed);
      const landed = apply444Moves(disturbed, repaired.moves);
      const attempt = { moves: [...gadget, ...repaired.moves], state: landed };
      chosen ??= attempt;
      if (is333Reachable(to333State(landed))) {
        chosen = attempt;
        break;
      }
    }
    moves.push(...chosen.moves);
    current = chosen.state;
  }
  const handoff = to333State(current);
  if (!is333Reachable(handoff)) {
    throw new Solve444Error(
      `4x4x4 parity fix left the cube unreachable (${parityOf444Handoff(handoff)})`
    );
  }
  for (const move of solve333(handoff)) {
    moves.push(outerIndex(move.face, move.amount));
  }
  const solution = mergeMoveIndices(moves);
  if (!is444Solved(apply444Moves(state, solution))) {
    throw new Solve444Error("4x4x4 solution does not solve the cube");
  }
  return solution;
}
function prepare444Tables() {
  move444Tables();
  prepareOddWingGadgets();
  prepareCompiledLibrary();
  centreTable();
  for (let index = 0; index < AXIS_PAIRS.length; index += 1) centrePairTable(index);
  singleEdgeTable();
  prepare333Tables();
}
var CUBE_555 = (() => {
  const entry = RANDOM_MOVE_CUBES.find((c) => c.event === "555");
  if (!entry) throw new Error("variants: 555 is missing from RANDOM_MOVE_CUBES");
  return entry;
})();
var FACE_FAMILIES = ["U", "D", "F", "B", "L", "R"];
var SLICE_FAMILIES = ["M", "E", "S"];
var ROTATION_FAMILIES = ["x", "y", "z"];
var ALL_FAMILIES = /* @__PURE__ */ new Set([
  ...FACE_FAMILIES,
  ...SLICE_FAMILIES,
  ...ROTATION_FAMILIES
]);
var BESPOKE_NOTATION_BY_EVENT = {
  minx: "megaminx",
  clock: "clock",
  pyram: "pyraminx",
  skewb: "skewb",
  sq1: "square1"
};
new Set(
  Object.keys(BESPOKE_NOTATION_BY_EVENT)
);
export {
  apply444Moves,
  createRandomSource,
  move444Tables,
  pieces444,
  prepare444Tables,
  randomCube444State,
  solve444
};
