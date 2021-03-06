export type Dict<T> = { [k: string]: T };
export type Point = { x: number, y: number };
export type Color = { r: number, g: number, b: number };
export type Ctx = CanvasRenderingContext2D;
import * as rbush from 'rbush';

export type Mode = "Pan" | "Freehand" | "Move" | "Select" | "Label" | "Measure" | "Extract";
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export type Rect = [number, number, number, number];
export type Path = Zpoint[];
export type ArPoint = [number, number];

export type Bundle =
  ['coastline', { point: Point }]
  | ['label', string];


export type Gpoint = { id: string };
export type Zpoint = { point: Point, z: number };
export type Gzpoint = { point: Gpoint, z: number };
export type ZpointWith<T> = { point: Point, z: number, extra: T };

// minx, miny, maxx, maxy
export type ArRectangle = [number, number, number, number];

export type Segment = { arc_id: string, ix: number };

export type ArcVertexTarget = { ptId: string };
export type LabelTarget = string;
export type Target = ["coastline", ArcVertexTarget] | ["label", LabelTarget];

export type Image = {
  scale: number,
  x: number,
  y: number
};

export type RawArcPoint = string;

export type RawArc = {
  points: RawArcPoint[],
};

export type Arc = {
  name: string,
  _points: Gzpoint[],
  bbox: Bbox,
};

export type LabType =
  "park" | "city" | "region" | "sea" | "minorsea" | "river";

export type LabelProps = {
  label: LabType,
  text: string,
  zoom?: number,
};

export type RoadProps =
  { t: "road", road: "highway" | "street" | "street2", text: string, zoom?: number };

export type PolyProps =
  | {
    t: "natural", natural: "lake" | "coastline" | "mountain",
    text?: string // not sure if this is used anywhere
  }
  | RoadProps
  | { t: "boundary" }
  | { t: "city", text: string, zoom?: number }

export type RawLabel = {
  pt: ArPoint,
  properties: LabelProps,
};

export type Label = {
  name: string
  pt: Point,
  properties: LabelProps,
};

export type RawPoly = {
  arcs: ArcSpec[], // arc names, really
  properties: PolyProps,
};

export type ArcSpec = { id: string, rev?: boolean };
export type Poly = {
  name: string,
  arcs: ArcSpec[],
  properties: PolyProps,
  bbox: Bbox,
};


export type Images = Dict<Image>;

export type Geo = {
  counter: number,
  points: Dict<Point>,
  images: Dict<Image>,
  arcs: Dict<RawArc>,
  polys: Dict<RawPoly>,
  labels: Dict<RawLabel>,
};

export type River = { geometry: { coordinates: ArPoint[][] } };
export type Rivers = { features: River[] };


export type Stopper = (offx: number, offy: number) => void;

export const nonce = "";

// RTree types from rbush
export type Bbox = rbush.BBox;
export type RBush<T> = rbush.RBush<T>;
export type Bush<T> = RBush<Bbox & { payload: T }>;

export type LabelUIMode = { text: string, tp: string, zoom: string };
type UIMode =
  | { t: 'normal' }
  | {
    t: 'label-modal', v: LabelUIMode, status:
    { isNew: true, pt: Point } |
    { isNew: false, prev: Label }
  }
  | { t: 'feature-modal', points: Point[] };

export type UIState = {
  mode: UIMode,
  layers: {
    road: boolean,
    boundary: boolean,
    river: boolean,
  }
};

export interface Layer {
  render(rc: RenderCtx): void;
}

export type RenderCtx = {
  d: Ctx,
  us: UIState,
  camera: Camera,
  mode: Mode,
  world_bbox: ArRectangle,
};

export type FeatureModalResult =
  | { t: "FeatureModalCancel" }
  | { t: "FeatureModalOk", v: { text: string, tp: string, zoom: string } };

export type LabelModalResult =
  | { t: "LabelModalCancel" }
  | { t: "LabelModalOk" }
  | { t: "LabelModalChange", lm: LabelUIMode };

export type Result =
  | FeatureModalResult
  | LabelModalResult
  | { t: "RadioToggle", k: keyof UIState['layers'] };
