/**
 * InkPoem's original hand-authored seal-cut motif paths (Phase 4B).
 * All marks are in a -50..50 coordinate frame, are deterministic and keep
 * their geometry independent of raster scale and paper/background choice.
 * Nothing is fetched or loaded from external images/fonts.
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
  readonly weight: number;
  readonly filled?: boolean;
  readonly commands: readonly SealPathCommand[];
}
const S = (weight: number, ...commands: SealPathCommand[]): SealMotifPath =>
  ({ weight, commands });
const F = (...commands: SealPathCommand[]): SealMotifPath =>
  ({ weight: 1.4, filled: true, commands });

/** Hand-carved five-petal blossoms reused in the plum composition. */
function blossom(x: number, y: number, radius: number): SealMotifPath[] {
  const petals: SealMotifPath[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 - Math.PI / 2;
    const c = Math.cos(a), s = Math.sin(a);
    const sideX = -s, sideY = c;
    const tipX = x + c * radius, tipY = y + s * radius;
    const shoulderX = x + c * radius * 0.55;
    const shoulderY = y + s * radius * 0.55;
    petals.push(S(1.45, ['M', x, y],
      ['Q', shoulderX + sideX * radius * 0.55,
        shoulderY + sideY * radius * 0.55, tipX, tipY],
      ['Q', shoulderX - sideX * radius * 0.55,
        shoulderY - sideY * radius * 0.55, x, y]));
  }
  petals.push(S(2.2, ['M', x - 1.1, y], ['L', x + 1.1, y]));
  return petals;
}

const MOTIFS: Readonly<Record<SealMotifId, readonly SealMotifPath[]>> = {
  dragon: [
    // A single S-shaped dragon winds through the circular negative space.
    S(6.4, ['M', 15, -30], ['C', 39, -29, 38, -5, 16, 2],
      ['C', -7, 8, -25, 2, -20, 23], ['C', -16, 39, 11, 42, 27, 30],
      ['C', 39, 21, 29, 10, 19, 15]),
    S(2.8, ['M', 14, -28], ['C', 35, -19, 30, -4, 14, -3],
      ['C', -15, 2, -30, 10, -13, 30], ['C', 0, 43, 16, 35, 22, 28]),
    // Horns, whiskers, and squared snout distinguish the head.
    S(3.2, ['M', 15, -30], ['Q', -4, -39, -21, -30],
      ['L', -34, -30], ['L', -28, -21], ['Q', -16, -19, -12, -24]),
    S(2.1, ['M', -6, -32], ['L', -10, -43], ['L', -3, -38],
      ['L', 4, -44], ['L', 4, -34]),
    S(2.1, ['M', -23, -25], ['Q', -37, -23, -41, -13],
      ['M', -27, -23], ['Q', -40, -28, -44, -32]),
    F(['M', -17, -30], ['Q', -14, -34, -11, -30], ['Q', -14, -26, -17, -30], ['Z']),
    S(2, ['M', -30, -22], ['Q', -24, -17, -17, -21]),
    // Scales and claws.
    S(1.5, ['M', 25, -18], ['L', 17, -15], ['M', 29, -11], ['L', 20, -7],
      ['M', 16, 8], ['L', 6, 10], ['M', -5, 10], ['L', -13, 13],
      ['M', -11, 27], ['L', -3, 29], ['M', 8, 36], ['L', 13, 29]),
    S(2.8, ['M', 31, -4], ['Q', 42, -4, 41, 6], ['L', 35, 5],
      ['M', 26, 20], ['Q', 41, 22, 39, 33], ['L', 33, 29]),
    S(2.8, ['M', -16, 15], ['Q', -34, 6, -39, 20],
      ['L', -33, 18], ['M', -5, 34], ['L', -10, 44]),
    // Two cloud curls anchor the dragon without becoming a background.
    S(2, ['M', -36, 4], ['C', -45, 0, -41, -10, -33, -8],
      ['C', -28, -6, -30, 0, -35, -1]),
    S(2, ['M', 31, 41], ['C', 42, 44, 46, 34, 38, 32],
      ['C', 32, 31, 31, 36, 36, 37]),
  ],
  phoenix: [
    S(5.4, ['M', -5, 23], ['C', -15, 6, -6, -15, 14, -22],
      ['C', 25, -25, 23, -38, 11, -38]),
    S(2.8, ['M', 10, -33], ['Q', 24, -30, 32, -21], ['L', 19, -19]),
    S(2.4, ['M', 11, -35], ['L', 7, -45], ['L', 17, -39],
      ['L', 22, -44], ['L', 21, -34]),
    F(['M', 18, -35], ['L', 21, -34], ['L', 18, -32], ['Z']),
    S(4.2, ['M', -2, 6], ['C', -25, -10, -35, -8, -38, 5],
      ['C', -31, 17, -17, 17, -6, 13]),
    S(2.3, ['M', -12, -5], ['C', -34, -20, -38, -22, -40, -14],
      ['M', -18, 0], ['C', -29, -7, -36, -8, -42, -3]),
    // Sweeping feathers run diagonally and then curl back at the tail.
    S(4.6, ['M', -3, 23], ['C', 13, 30, 36, 19, 41, 5],
      ['C', 34, 29, 16, 38, -3, 39]),
    S(3, ['M', -3, 23], ['C', 13, 17, 36, 6, 39, -7],
      ['C', 41, 12, 24, 21, 10, 29]),
    S(3, ['M', -4, 22], ['C', -12, 34, -34, 39, -40, 29],
      ['C', -31, 32, -18, 22, -13, 16]),
    S(1.9, ['M', 3, 30], ['Q', 19, 37, 25, 30],
      ['M', 8, 19], ['Q', 26, 20, 31, 12]),
    S(2.5, ['M', -7, 29], ['L', -13, 42], ['L', -20, 45],
      ['M', 2, 31], ['L', 3, 42], ['L', 12, 44]),
  ],
  plum: [
    S(5.8, ['M', -39, 42], ['C', -20, 17, -16, -12, 25, -35]),
    S(3.7, ['M', -18, 12], ['Q', -3, 17, 19, 34],
      ['M', -12, -4], ['Q', -30, -24, -36, -39],
      ['M', 8, -21], ['L', 30, -12]),
    S(2.2, ['M', -15, 17], ['L', -30, 18],
      ['M', 17, -30], ['L', 24, -43],
      ['M', -1, 21], ['L', -1, 35]),
    ...blossom(-22, -20, 9),
    ...blossom(23, -32, 10),
    ...blossom(22, 24, 9),
    ...blossom(-33, 18, 7.5),
    ...blossom(30, -8, 7),
  ],
  bamboo: [
    S(5.8, ['M', -22, 42], ['C', -24, 15, -20, -10, -18, -43]),
    S(5.3, ['M', 7, 42], ['C', 6, 13, 9, -11, 9, -42]),
    S(2.7, ['M', -25, -16], ['L', -13, -16],
      ['M', -24, 15], ['L', -14, 15],
      ['M', 4, -20], ['L', 15, -20],
      ['M', 4, 13], ['L', 13, 13]),
    F(['M', -19, -26], ['Q', -43, -43, -45, -32], ['Q', -35, -16, -19, -26], ['Z']),
    F(['M', -17, -8], ['Q', -44, -20, -42, -8], ['Q', -31, 1, -17, -8], ['Z']),
    F(['M', -17, -29], ['Q', 0, -48, 4, -39], ['Q', -2, -27, -17, -29], ['Z']),
    F(['M', 9, -30], ['Q', 26, -49, 35, -44], ['Q', 32, -32, 9, -30], ['Z']),
    F(['M', 9, -6], ['Q', 31, -24, 43, -13], ['Q', 31, -1, 9, -6], ['Z']),
    F(['M', 8, 13], ['Q', 27, 0, 42, 9], ['Q', 29, 23, 8, 13], ['Z']),
    S(1.8, ['M', 8, -32], ['L', 33, -40],
      ['M', 9, -6], ['L', 37, -14],
      ['M', -18, -9], ['L', -40, -11]),
  ],
  pine: [
    S(7.2, ['M', -14, 44], ['C', -9, 27, -19, 10, -13, -5],
      ['C', -8, -21, 2, -31, -3, -43]),
    S(4, ['M', -12, 7], ['Q', 7, -7, 27, -5],
      ['M', -9, -15], ['Q', -30, -24, -39, -20],
      ['M', -5, -27], ['Q', 19, -36, 37, -30]),
    S(3.2, ['M', -13, 23], ['L', -21, 37],
      ['M', -8, 18], ['L', -2, 33]),
    S(2.2, ['M', -40, -20], ['C', -31, -33, -18, -30, -11, -21],
      ['C', -20, -13, -33, -10, -40, -20]),
    S(2.2, ['M', 9, -32], ['C', 20, -43, 35, -40, 42, -30],
      ['C', 30, -19, 13, -23, 9, -32]),
    S(2.2, ['M', -2, -5], ['C', 10, -20, 27, -17, 37, -4],
      ['C', 26, 7, 11, 4, -2, -5]),
    S(1.5, ['M', -33, -25], ['L', -35, -34],
      ['M', -24, -27], ['L', -21, -37],
      ['M', -17, -25], ['L', -11, -34],
      ['M', 18, -35], ['L', 15, -44],
      ['M', 27, -33], ['L', 31, -43],
      ['M', 15, -7], ['L', 14, -16],
      ['M', 26, -6], ['L', 29, -15]),
    S(2.5, ['M', -37, 42], ['Q', -11, 35, 12, 42],
      ['M', -29, 46], ['L', 22, 46]),
  ],
  landscape: [
    // Peaks, an empty cloud band, a solitary pine, and quiet water.
    S(3.4, ['M', -45, 11], ['L', -19, -18], ['L', -10, -6],
      ['L', 12, -40], ['L', 44, 6]),
    S(2.1, ['M', -8, -3], ['L', 12, -27], ['L', 27, -5],
      ['M', -19, -17], ['L', -12, -9],
      ['M', 10, -29], ['L', 17, -14]),
    S(2.7, ['M', -43, 27], ['L', -35, 16], ['L', -28, 22],
      ['M', 23, 16], ['L', 35, 3], ['L', 45, 15]),
    S(2.1, ['M', -42, 38], ['Q', -16, 28, 5, 38],
      ['Q', 25, 46, 43, 33]),
    S(1.9, ['M', -25, 44], ['Q', -4, 39, 10, 45],
      ['M', 18, 31], ['Q', 35, 27, 44, 30],
      ['M', -42, 31], ['Q', -32, 27, -23, 29]),
    S(3.2, ['M', -28, 27], ['L', -29, 4],
      ['M', -29, 11], ['Q', -41, 7, -44, 13],
      ['M', -29, 8], ['Q', -18, -2, -11, 9]),
    S(1.9, ['M', -43, 12], ['Q', -36, -1, -29, 7],
      ['Q', -21, -3, -16, 12]),
    S(1.7, ['M', 4, 28], ['L', 25, 28], ['L', 21, 31],
      ['M', 13, 25], ['L', 17, 20]),
  ],
  lotus: [
    S(3.5, ['M', 0, 26], ['Q', -22, -1, 0, -40],
      ['Q', 25, -4, 0, 26]),
    S(3, ['M', 0, 26], ['Q', -42, -7, -38, -21],
      ['Q', -8, -23, 0, 26],
      ['M', 0, 26], ['Q', 38, -6, 39, -23],
      ['Q', 9, -22, 0, 26]),
    S(3.3, ['M', -29, -12], ['Q', -40, -11, -44, 4],
      ['Q', -34, 21, -7, 28],
      ['M', 29, -12], ['Q', 40, -11, 44, 4],
      ['Q', 34, 21, 7, 28]),
    S(2.1, ['M', -17, -16], ['Q', -12, -27, 0, -31],
      ['M', 16, -16], ['Q', 12, -27, 0, -31]),
    S(3.2, ['M', 0, 26], ['L', 0, 44]),
    S(2.2, ['M', -44, 38], ['Q', -24, 32, -8, 38],
      ['Q', 11, 44, 39, 35],
      ['M', -39, 45], ['Q', -20, 41, -2, 46],
      ['M', 15, 45], ['Q', 28, 42, 40, 45]),
  ],
  clouds: [
    S(4, ['M', -43, 0], ['C', -33, -11, -17, -11, -12, 0],
      ['C', -7, 11, -26, 17, -29, 6],
      ['C', -31, -1, -19, -3, -19, 2]),
    S(4.2, ['M', -12, 0], ['C', -7, -17, 13, -24, 23, -12],
      ['C', 32, -2, 21, 12, 12, 5],
      ['C', 6, -1, 15, -8, 18, -2]),
    S(4.2, ['M', -40, 18], ['C', -21, 17, -20, 30, -2, 26],
      ['C', 14, 23, 24, 15, 42, 23]),
    S(3.1, ['M', -35, -25], ['C', -20, -30, -14, -18, -19, -13],
      ['C', -26, -7, -35, -18, -28, -20],
      ['M', 4, -31], ['C', 19, -39, 35, -31, 29, -21]),
    S(2.4, ['M', -25, 40], ['C', -7, 36, 8, 40, 19, 34],
      ['M', -42, -38], ['Q', -30, -43, -22, -38],
      ['M', 25, 37], ['Q', 34, 33, 43, 36]),
  ],
};

export function getSealMotifPaths(id: SealMotifId): readonly SealMotifPath[] {
  return MOTIFS[id];
}

/** Draw with the caller's fill/stroke colour and compositing (ink or carving). */
export function drawSealMotif(ctx: CanvasRenderingContext2D, id: SealMotifId): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const mark of MOTIFS[id]) {
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
}
