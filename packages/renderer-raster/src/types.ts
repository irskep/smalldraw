export interface TileCoord {
  x: number;
  y: number;
}

export interface TileProvider<TCanvas = HTMLCanvasElement> {
  /**
   * Return a canvas for the tile coordinate. Implementations may reuse
   * pre-existing canvases instead of creating new ones.
   */
  getTileCanvas: (coord: TileCoord) => TCanvas;
  releaseTileCanvas?: (coord: TileCoord, canvas: TCanvas) => void;
}

export interface TileBaker<TCanvas = HTMLCanvasElement> {
  bakeTile: (coord: TileCoord, canvas: TCanvas) => Promise<void> | void;
}

export interface TileSnapshotAdapter<TCanvas = HTMLCanvasElement, TSnapshot = unknown> {
  captureSnapshot: (canvas: TCanvas) => TSnapshot;
  applySnapshot: (canvas: TCanvas, snapshot: TSnapshot) => void;
}

export interface TileSnapshotStore<TSnapshot = unknown> {
  getSnapshot: (key: string) => TSnapshot | undefined;
  setSnapshot: (key: string, snapshot: TSnapshot) => void;
  deleteSnapshot: (key: string) => void;
  clearSnapshots?: () => void;
}
