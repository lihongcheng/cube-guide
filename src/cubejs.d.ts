declare module 'cubejs' {
  export default class Cube {
    constructor();
    static initSolver(): void;
    static fromString(state: string): Cube;
    static random(): Cube;
    asString(): string;
    solve(maxDepth?: number): string;
    move(algorithm: string): Cube;
    isSolved(): boolean;
  }
}
