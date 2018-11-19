export type Dict<T> = { [k: string]: T };
export type Point = { x: number, y: number };
export type Color = { r: number, g: number, b: number };
export type Ctx = CanvasRenderingContext2D;

export type Mode = "Pan" | "Freehand" | "Move" | "Select" | "Label" | "Measure";
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export type Rect = [number, number, number, number];
export type Path = Zpoint[];
export type AarPoint = [number, number];
export type ArPoint = Point;
export type Bundle =
  ['coastline', { point: ArPoint }]
  | ['label', string];


export type Zpoint = { point: ArPoint, z: number };

// minx, miny, maxx, maxy
export type ArRectangle = [number, number, number, number];

export type Segment = any;

export type ArcVertexTarget = { arc: string, point: ArPoint };
export type LabelTarget = string;
export type Target = ["coastline", ArcVertexTarget] | ["label", LabelTarget];

export type Image = {
  scale: number,
  x: number,
  y: number
};

export type Bbox = {
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
};

export type RawArc = {
  points: AarPoint[],
};

export type Arc = {
  name: string,
  points: Zpoint[],
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
  | { t: "city", text: string, zoom?: number }

export type RawLabel = {
  pt: AarPoint,
  properties: LabelProps,
};

export type Label = {
  name: string
  pt: ArPoint,
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
  images: Dict<Image>,
  arcs: Dict<RawArc>,
  polys: Dict<RawPoly>,
  labels: Dict<RawLabel>,
};

export type River = { geometry: { coordinates: AarPoint[][] } };
export type Rivers = { features: River[] };

export interface Layer {
  render(d: Ctx, camera: Camera, mode: Mode, world_bbox: ArRectangle): void;
}

export type Stopper = (offx: number, offy: number) => void;

export const nonce = "";
