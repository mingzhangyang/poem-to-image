/**
 * InkPoem's original hand-authored pictorial seal motifs (肖形印).
 *
 * The designs follow the language of carved Han pictorial seals rather than
 * line illustration: bold solid masses, few strong strokes, and details that
 * are *carved back out* of the ink (eyes, petal separations, bamboo nodes,
 * mountain texture). Everything is in a -50..50 coordinate frame, is
 * deterministic and keeps its geometry independent of raster scale and
 * paper/background choice. Nothing is fetched or loaded from images/fonts.
 */
export const SEAL_MOTIF_IDS = [
  'dragon', 'phoenix', 'plum', 'bamboo',
  'pine', 'landscape', 'lotus', 'clouds',
] as const;

export type SealMotifId = (typeof SEAL_MOTIF_IDS)[number];

export function isSealMotifId(value: unknown): value is SealMotifId {
  return typeof value === 'string'
    && (SEAL_MOTIF_IDS as readonly string[]).includes(value);
}

export type SealPathCommand =
  | readonly ['M' | 'L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z'];

export interface SealMotifPath {
  /** Stroke width in motif units; filled marks use it to soften their edge. */
  readonly weight: number;
  readonly filled?: boolean;
  /**
   * A carved mark removes what earlier marks deposited. In Zhu Wen it cuts
   * paper-coloured detail into the red design; in Bai Wen it restores red.
   */
  readonly carve?: boolean;
  readonly commands: readonly SealPathCommand[];
}

type Point = readonly [number, number];

const round = (value: number) => Math.round(value * 100) / 100;

/** Stroked ink. */
const S = (weight: number, ...commands: SealPathCommand[]): SealMotifPath =>
  ({ weight, commands });
/** Solid ink mass. */
const F = (...commands: SealPathCommand[]): SealMotifPath =>
  ({ weight: 0.8, filled: true, commands });
/** Carved line through earlier ink. */
const K = (weight: number, ...commands: SealPathCommand[]): SealMotifPath =>
  ({ weight, carve: true, commands });
/** Carved area through earlier ink. */
const KF = (...commands: SealPathCommand[]): SealMotifPath =>
  ({ weight: 0.6, filled: true, carve: true, commands });

const asFill = (mark: SealMotifPath): SealMotifPath => ({ ...mark, weight: 0.8, filled: true });
/** The same outline, carved as a separating line in front of earlier masses. */
const asCarvedOutline = (mark: SealMotifPath, weight: number): SealMotifPath =>
  ({ weight, carve: true, commands: mark.commands });

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/**
 * A brush-like solid stroke whose width tapers along a chain of cubic
 * segments: [start, c1, c2, end, c1, c2, end, ...]. `widths` are sampled at
 * the start, the middle and the end, so a stroke can swell in its belly.
 */
function taper(chain: readonly Point[], widths: readonly [number, number, number],
  samples = 14): SealMotifPath {
  const centre: Point[] = [];
  for (let index = 0; index + 3 < chain.length; index += 3) {
    for (let step = index === 0 ? 0 : 1; step <= samples; step++) {
      centre.push(cubicAt(chain[index], chain[index + 1], chain[index + 2],
        chain[index + 3], step / samples));
    }
  }
  const left: Point[] = [];
  const right: Point[] = [];
  const last = centre.length - 1;
  centre.forEach((point, index) => {
    const before = centre[Math.max(0, index - 1)];
    const after = centre[Math.min(last, index + 1)];
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const length = Math.hypot(dx, dy) || 1;
    const t = index / last;
    const width = t < 0.5
      ? widths[0] + (widths[1] - widths[0]) * Math.sin(t * Math.PI)
      : widths[2] + (widths[1] - widths[2]) * Math.sin(t * Math.PI);
    const nx = -dy / length * width / 2;
    const ny = dx / length * width / 2;
    left.push([round(point[0] + nx), round(point[1] + ny)]);
    right.push([round(point[0] - nx), round(point[1] - ny)]);
  });
  const commands: SealPathCommand[] = [['M', left[0][0], left[0][1]]];
  for (const point of left.slice(1)) commands.push(['L', point[0], point[1]]);
  for (const point of right.reverse()) commands.push(['L', point[0], point[1]]);
  commands.push(['Z']);
  return F(...commands);
}

/** A pointed leaf / petal lens from its base toward its tip. */
function lens(baseX: number, baseY: number, tipX: number, tipY: number,
  width: number, bend = 0): SealMotifPath {
  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const midX = baseX + dx * 0.42 + nx * bend;
  const midY = baseY + dy * 0.42 + ny * bend;
  return F(['M', round(baseX), round(baseY)],
    ['Q', round(midX + nx * width), round(midY + ny * width), round(tipX), round(tipY)],
    ['Q', round(midX - nx * width), round(midY - ny * width), round(baseX), round(baseY)],
    ['Z']);
}

function circle(x: number, y: number, radius: number): SealPathCommand[] {
  const k = radius * 0.5523;
  return [
    ['M', round(x + radius), round(y)],
    ['C', round(x + radius), round(y + k), round(x + k), round(y + radius), round(x), round(y + radius)],
    ['C', round(x - k), round(y + radius), round(x - radius), round(y + k), round(x - radius), round(y)],
    ['C', round(x - radius), round(y - k), round(x - k), round(y - radius), round(x), round(y - radius)],
    ['C', round(x + k), round(y - radius), round(x + radius), round(y - k), round(x + radius), round(y)],
    ['Z'],
  ];
}

/** An inward spiral polyline, used for cloud scrolls and tail curls. */
function spiral(x: number, y: number, radius: number, startAngle: number,
  turns: number, clockwise: boolean, innerRatio = 0.28): Point[] {
  const points: Point[] = [];
  const steps = Math.max(8, Math.round(turns * 28));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const angle = startAngle + (clockwise ? 1 : -1) * t * turns * Math.PI * 2;
    const r = radius * (1 - (1 - innerRatio) * t);
    points.push([round(x + Math.cos(angle) * r), round(y + Math.sin(angle) * r)]);
  }
  return points;
}

const polyline = (points: readonly Point[]): SealPathCommand[] =>
  points.map((point, index) => [index === 0 ? 'M' : 'L', point[0], point[1]] as const);

/** A solid five-petal plum blossom with a carved heart and stamens. */
function blossom(x: number, y: number, radius: number, turn = 0): SealMotifPath[] {
  const marks: SealMotifPath[] = [];
  const petal = radius * 0.47;
  for (let index = 0; index < 5; index++) {
    const angle = turn + index * Math.PI * 2 / 5 - Math.PI / 2;
    marks.push(F(...circle(x + Math.cos(angle) * radius * 0.55,
      y + Math.sin(angle) * radius * 0.55, petal)));
  }
  marks.push(F(...circle(x, y, radius * 0.5)));
  marks.push(KF(...circle(x, y, radius * 0.3)));
  marks.push(F(...circle(x, y, radius * 0.13)));
  return marks;
}

/** A pine needle crown: a flattened fan with carved radiating needles. */
function pineCrown(x: number, y: number, rx: number, ry: number): SealMotifPath[] {
  const marks: SealMotifPath[] = [
    F(['M', round(x - rx), round(y)],
      ['C', round(x - rx), round(y - ry * 1.3), round(x + rx), round(y - ry * 1.3), round(x + rx), round(y)],
      ['Q', round(x), round(y + ry * 0.35), round(x - rx), round(y)], ['Z']),
  ];
  const needles: SealPathCommand[] = [];
  for (let index = 1; index < 6; index++) {
    const angle = Math.PI + index * Math.PI / 6;
    needles.push(['M', round(x), round(y + ry * 0.12)],
      ['L', round(x + Math.cos(angle) * rx * 0.78), round(y + Math.sin(angle) * ry * 0.85)]);
  }
  marks.push(K(1.7, ...needles));
  return marks;
}

function dragon(): SealMotifPath[] {
  // A coiled dragon (蟠龙) circling a flaming pearl, head raised at the top.
  const body = taper([
    [-17, -20], [-30, -14], [-36, 0], [-33, 12],
    [-30, 24], [-16, 33], [0, 33],
    [16, 33], [30, 24], [32, 8],
    [34, -6], [30, -18], [22, -24],
    [15, -29], [20, -38], [30, -41],
  ], [12, 14, 2.6], 16);
  return [
    // Pearl with flames and a carved swirl.
    F(...circle(0, 3, 9.5)),
    K(2, ...polyline(spiral(0, 3, 6, 0, 1.1, true, 0.2))),
    lens(-5, -5, -10, -15, 2.8), lens(0, -6, 1, -17, 3), lens(5, -5, 11, -14, 2.8),
    body,
    K(2.2, ['M', -25, -4], ['C', -27, 12, -14, 26, 0, 26],
      ['C', 14, 26, 25, 16, 25, 4], ['C', 25, -8, 20, -16, 14, -20]),
    // Tail tip flicks into a single flame.
    lens(28, -41, 40, -47, 3.6, -1.5),
    // Head: heavy brow, long snout and an open jaw.
    F(['M', -25, -19], ['C', -31, -25, -31, -36, -22, -40],
      ['Q', -14, -45, -5, -41], ['L', 5, -39], ['Q', 8, -35, 3, -34],
      ['L', -7, -33], ['L', 1, -28], ['Q', 2, -23, -4, -24],
      ['L', -12, -22], ['Q', -17, -17, -25, -19], ['Z']),
    KF(...circle(-14, -36, 2)),
    // Antlers, mane and whisker.
    taper([[-21, -40], [-25, -45], [-32, -47], [-39, -45]], [4.2, 3.4, 1.6], 10),
    taper([[-27, -36], [-34, -38], [-40, -36], [-44, -30]], [4, 3.2, 1.4], 10),
    taper([[-28, -26], [-36, -27], [-42, -22], [-46, -16]], [4, 3, 1.2], 10),
    taper([[4, -38], [10, -42], [16, -42], [18, -47]], [2.4, 2, 1], 10),
    // Legs with three-toed claws, reaching outward.
    taper([[-32, 4], [-40, 2], [-44, 8], [-46, 14]], [6.4, 5.2, 3], 10),
    S(2.4, ['M', -46, 14], ['L', -48, 19], ['M', -46, 14], ['L', -43, 19],
      ['M', -46, 14], ['L', -50, 12]),
    taper([[-8, 33], [-10, 39], [-6, 43], [-1, 46]], [6.4, 5.2, 3], 10),
    S(2.4, ['M', -1, 46], ['L', 5, 46], ['M', -1, 46], ['L', 3, 49], ['M', -1, 46], ['L', -3, 50]),
    taper([[30, 14], [38, 18], [41, 26], [45, 30]], [6.4, 5.2, 3], 10),
    S(2.4, ['M', 45, 30], ['L', 49, 27], ['M', 45, 30], ['L', 49, 33], ['M', 45, 30], ['L', 44, 35]),
  ];
}

function phoenix(): SealMotifPath[] {
  const wing = F(['M', -4, -2], ['C', -2, -20, 10, -34, 34, -42],
    ['C', 30, -34, 34, -30, 30, -24], ['Q', 34, -20, 28, -14],
    ['Q', 31, -8, 22, -4], ['Q', 22, 2, 12, 3], ['Q', 4, 6, -4, -2], ['Z']);
  return [
    // Tail plumes sweep behind and curl into eye-spots.
    taper([[8, 10], [24, 14], [38, 22], [40, 36]], [8.4, 7, 3.6], 14),
    taper([[6, 14], [14, 26], [22, 36], [20, 45]], [7.6, 6.4, 3.4], 14),
    taper([[2, 16], [-2, 28], [-8, 36], [-16, 42]], [6.2, 5.2, 3], 14),
    F(...circle(40, 38, 5.6)), KF(...circle(40, 38, 2.6)),
    F(...circle(20, 45, 4.8)), KF(...circle(20, 45, 2.2)),
    F(...circle(-17, 42, 4.2)), KF(...circle(-17, 42, 1.8)),
    // Body and neck as one breasted mass.
    F(['M', -12, 4], ['C', -14, -6, -16, -14, -20, -20],
      ['C', -24, -26, -26, -34, -18, -38], ['C', -11, -40, -8, -32, -10, -26],
      ['C', -11, -18, -2, -10, 6, -6], ['C', 16, -1, 18, 12, 8, 17],
      ['C', 0, 20, -10, 14, -12, 4], ['Z']),
    // Beak and crest plumes.
    F(['M', -24, -34], ['L', -34, -30], ['L', -22, -29], ['Z']),
    taper([[-15, -38], [-12, -44], [-6, -46], [-2, -44]], [3.2, 2.6, 1.4], 10),
    F(...circle(-1, -44, 2.4)),
    taper([[-18, -38], [-18, -44], [-14, -48], [-10, -48]], [2.6, 2.2, 1.2], 10),
    KF(...circle(-17, -33, 1.7)),
    // Raised wing with carved flight feathers.
    wing,
    asCarvedOutline(wing, 2),
    K(1.9, ['M', 2, -6], ['Q', 14, -22, 30, -38],
      ['M', 6, -2], ['Q', 18, -14, 29, -24],
      ['M', 8, 2], ['Q', 18, -4, 26, -12]),
    // Breast feathers carved.
    K(1.6, ['M', -10, -6], ['Q', -6, -4, -6, 2], ['M', -8, 6], ['Q', -2, 8, 0, 13]),
  ];
}

function plum(): SealMotifPath[] {
  return [
    taper([[-42, 44], [-32, 26], [-30, 10], [-14, 0],
      [-2, -8], [8, -22], [24, -36]], [13, 9, 3], 14),
    taper([[-16, 2], [-4, 10], [14, 10], [36, 18]], [7, 5, 2], 12),
    taper([[-20, 4], [-30, -6], [-30, -22], [-38, -36]], [6, 4, 1.6], 12),
    taper([[6, -16], [14, -14], [22, -8], [34, -10]], [4.6, 3.6, 1.6], 10),
    K(2, ['M', -38, 36], ['Q', -32, 24, -24, 14], ['M', -18, 2], ['Q', -10, -4, -4, -8]),
    ...blossom(-30, -30, 11, 0.2),
    ...blossom(22, -34, 10.5, -0.15),
    ...blossom(32, 12, 10, 0.4),
    ...blossom(-2, -10, 8.6, 0.1),
    ...blossom(30, -8, 7, -0.3),
    F(...circle(-40, -40, 3.6)),
    F(...circle(40, 22, 3.2)),
    F(...circle(10, 18, 3)),
  ];
}

function bamboo(): SealMotifPath[] {
  const marks: SealMotifPath[] = [
    taper([[-16, 48], [-17, 16], [-16, -16], [-13, -48]], [10, 9.5, 8.5], 16),
    taper([[11, 48], [12, 22], [13, -6], [16, -40]], [8.4, 8, 6.8], 16),
  ];
  // Carved nodes.
  marks.push(K(2.4,
    ['M', -22, 26], ['L', -10, 26], ['M', -21, -2], ['L', -10, -2],
    ['M', -19, -28], ['L', -8, -28],
    ['M', 6, 30], ['L', 17, 30], ['M', 7, 6], ['L', 18, 6], ['M', 9, -18], ['L', 20, -18]));
  marks.push(K(1.5,
    ['M', -14, 20], ['Q', -13, 12, -14, 4], ['M', 13, 24], ['Q', 13.5, 18, 13, 12]));
  // Broad drooping leaves gathered in 个 clusters.
  marks.push(
    lens(-14, -28, -42, -38, 6.4, 3),
    lens(-15, -27, -44, -18, 6, 3),
    lens(-15, -26, -34, -4, 5.6, 3),
    lens(15, -18, 44, -26, 6.4, -3),
    lens(15, -17, 44, -6, 6, -3),
    lens(15, -16, 34, 6, 5.6, -3),
    lens(-15, 0, -44, 12, 5.6, 3),
    lens(-15, 1, -32, 22, 5.2, 3),
    lens(16, 8, 42, 20, 5.6, -3),
    lens(16, 9, 30, 30, 5.2, -3),
  );
  marks.push(K(1.4,
    ['M', -18, -29], ['Q', -30, -32, -38, -36], ['M', 18, -19], ['Q', 30, -21, 40, -25],
    ['M', -18, -1], ['Q', -30, 4, -40, 10], ['M', 19, 7], ['Q', 30, 12, 38, 18]));
  return marks;
}

function pine(): SealMotifPath[] {
  return [
    // Rock the pine grips.
    F(['M', -46, 47], ['Q', -44, 34, -32, 32], ['Q', -24, 26, -14, 34],
      ['Q', 0, 30, 6, 40], ['Q', 12, 44, 14, 47], ['Z']),
    K(2, ['M', -36, 41], ['Q', -28, 36, -20, 40], ['M', -6, 40], ['Q', 0, 38, 4, 44]),
    // Twisted trunk and branches.
    taper([[-12, 40], [-2, 26], [-20, 12], [-12, -4],
      [-6, -16], [6, -20], [2, -36]], [13, 10, 5], 16),
    K(2, ['M', -10, 30], ['Q', -14, 22, -16, 14], ['M', -12, 4], ['Q', -10, -4, -4, -10],
      ['M', -6, 20], ['L', -2, 16]),
    taper([[-12, -2], [-22, -6], [-30, -10], [-40, -10]], [6.4, 4.8, 2.4], 10),
    taper([[-4, -14], [8, -10], [20, -16], [34, -12]], [6, 4.6, 2.4], 10),
    taper([[-6, 14], [6, 12], [18, 16], [30, 14]], [5.4, 4.2, 2.2], 10),
    // Needle crowns.
    ...pineCrown(-32, -12, 15, 11),
    ...pineCrown(4, -34, 15, 11),
    ...pineCrown(30, -14, 15, 11),
    ...pineCrown(30, 13, 13, 9),
  ];
}

function landscape(): SealMotifPath[] {
  const back = F(['M', -22, 24], ['Q', -10, 6, -2, -8], ['Q', 4, -18, 8, -18],
    ['Q', 12, -36, 19, -38], ['Q', 26, -38, 29, -26], ['Q', 32, -16, 36, -14],
    ['Q', 44, 2, 48, 24], ['Z']);
  const front = F(['M', -48, 24], ['Q', -42, 8, -33, 0], ['Q', -26, -10, -20, -6],
    ['Q', -12, 2, -6, 10], ['Q', 4, 18, 14, 24], ['Z']);
  return [
    F(...circle(-27, -28, 8.6)),
    back,
    // Texture strokes (披麻皴) carved down the far peaks.
    K(2, ['M', 18, -33], ['Q', 14, -20, 8, -10], ['M', 22, -30], ['Q', 24, -18, 22, -6],
      ['M', 34, -10], ['Q', 38, 2, 40, 12]),
    front,
    asCarvedOutline(front, 2.6),
    asFill(front),
    K(2, ['M', -30, 0], ['Q', -32, 8, -38, 16], ['M', -20, -2], ['Q', -18, 6, -10, 14]),
    // Water and a lone boat.
    S(3.6, ['M', -46, 32], ['Q', -36, 28, -26, 32], ['Q', -16, 36, -6, 32],
      ['Q', 4, 28, 14, 32], ['Q', 24, 36, 34, 32], ['Q', 40, 29, 46, 32]),
    S(3.4, ['M', -40, 42], ['Q', -30, 38, -20, 42], ['Q', -10, 46, 0, 42]),
    F(['M', 10, 39], ['L', 32, 39], ['Q', 28, 46, 20, 46], ['Q', 14, 46, 10, 39], ['Z']),
    S(2, ['M', 20, 39], ['L', 20, 27]),
    F(['M', 20, 28], ['L', 27, 37], ['L', 20, 37], ['Z']),
  ];
}

function lotus(): SealMotifPath[] {
  const outerLeft = lens(-6, 10, -36, -10, 15, 3);
  const outerRight = lens(-2, 10, 28, -10, 15, -3);
  const left = lens(-6, 10, -25, -28, 19, 3);
  const right = lens(-2, 10, 17, -28, 19, -3);
  const centre = lens(-4, 10, -4, -38, 21);
  const leaf = F(['M', 6, 26], ['C', 12, 14, 40, 12, 47, 24], ['Q', 44, 28, 46, 32],
    ['C', 36, 40, 14, 40, 6, 32], ['Q', 9, 29, 6, 26], ['Z']);
  return [
    taper([[-4, 8], [-4, 24], [-6, 36], [-8, 48]], [4.8, 4.4, 4], 10),
    taper([[-6, 26], [-16, 30], [-26, 24], [-32, 14]], [3.6, 3.2, 2.6], 10),
    lens(-32, 16, -40, -2, 6),
    leaf,
    K(1.8, ['M', 22, 27], ['L', 12, 20], ['M', 22, 27], ['L', 26, 16],
      ['M', 22, 27], ['L', 40, 20], ['M', 22, 27], ['L', 42, 32], ['M', 22, 27], ['L', 20, 36]),
    KF(...circle(22, 27, 2)),
    outerLeft, outerRight,
    left, asCarvedOutline(left, 2.2), asFill(left),
    right, asCarvedOutline(right, 2.2), asFill(right),
    centre, asCarvedOutline(centre, 2.4), asFill(centre),
    K(1.6, ['M', -4, 2], ['L', -4, -26], ['M', -18, -16], ['L', -10, -2], ['M', 10, -16], ['L', 2, -2]),
    S(3.4, ['M', -48, 42], ['Q', -38, 38, -28, 42], ['Q', -20, 46, -12, 42]),
    S(3.4, ['M', 4, 45], ['Q', 14, 41, 24, 45], ['Q', 34, 49, 44, 44]),
  ];
}

function clouds(): SealMotifPath[] {
  // Auspicious ruyi clouds: each head is a pair of scrolls rolling outward
  // from a shared crown, carried on a long flowing ribbon.
  const head = (x: number, y: number, radius: number, weight: number) => {
    const left = spiral(x - radius, y, radius, -Math.PI / 2, 1.05, false, 0.3).reverse();
    const right = spiral(x + radius, y, radius, -Math.PI / 2, 1.05, true, 0.3);
    return S(weight, ...polyline([...left, ...right]));
  };
  return [
    head(-16, -16, 13, 5.6),
    S(5.6, ['M', -47, 14], ['C', -36, 2, -26, 12, -16, 6], ['Q', -9, 2, -8, -6]),
    head(20, 16, 11, 5.2),
    S(5.2, ['M', -40, 38], ['C', -22, 30, -2, 44, 14, 34], ['Q', 20, 30, 22, 24]),
    head(30, -32, 7, 4.2),
    S(4.2, ['M', 6, -22], ['Q', 16, -18, 24, -26]),
  ];
}

const MOTIFS: Readonly<Record<SealMotifId, readonly SealMotifPath[]>> = {
  dragon: dragon(),
  phoenix: phoenix(),
  plum: plum(),
  bamboo: bamboo(),
  pine: pine(),
  landscape: landscape(),
  lotus: lotus(),
  clouds: clouds(),
};

export function getSealMotifPaths(id: SealMotifId): readonly SealMotifPath[] {
  return MOTIFS[id];
}

export interface DrawSealMotifOptions {
  /**
   * Bai Wen: the caller already filled the face, and the design is carved out
   * of it. Carved detail marks then restore ink instead of removing it.
   */
  carved?: boolean;
  /** Ink used for deposited marks; defaults to the context's current fill. */
  inkColor?: string;
}

/**
 * Draw a motif in the current transform. Ink marks deposit `inkColor` (or,
 * in carved mode, erase the face); carved marks do the opposite, so the same
 * design reads correctly as both Zhu Wen and Bai Wen.
 */
export function drawSealMotif(ctx: CanvasRenderingContext2D, id: SealMotifId,
  options: DrawSealMotifOptions = {}): void {
  const carved = options.carved === true;
  const ink = options.inkColor ?? (typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#b33227');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const mark of MOTIFS[id]) {
    const removesInk = mark.carve === true ? !carved : carved;
    ctx.globalCompositeOperation = removesInk ? 'destination-out' : 'source-over';
    ctx.fillStyle = removesInk ? '#000' : ink;
    ctx.strokeStyle = removesInk ? '#000' : ink;
    ctx.beginPath();
    for (const command of mark.commands) {
      switch (command[0]) {
        case 'M': ctx.moveTo(command[1], command[2]); break;
        case 'L': ctx.lineTo(command[1], command[2]); break;
        case 'Q': ctx.quadraticCurveTo(command[1], command[2], command[3], command[4]); break;
        case 'C': ctx.bezierCurveTo(
          command[1], command[2], command[3], command[4], command[5], command[6]); break;
        case 'Z': ctx.closePath(); break;
      }
    }
    ctx.lineWidth = mark.weight;
    if (mark.filled) ctx.fill();
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
