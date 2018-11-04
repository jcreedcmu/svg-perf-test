export type Dict<T> = { [k: string]: T };
export type Point = { x: number, y: number };
export type Color = { r: number, g: number, b: number };
export type Ctx = CanvasRenderingContext2D;

export type Mode = "Pan" | "Freehand" | "Move" | "Select" | "Label" | "Measure";
export interface Camera {
  x: number;
  y: number;
  zoom: number;
  scale(): number;
};

export type Rect = [number, number, number, number];
export type Path = any;
export type ArPoint = [number, number];
export type Bundle =
  ['coastline', { point: ArPoint }]
  | ['label', string];


export type SmPoint = [number, number, number?];

export type ArRectangle = [number, number, number, number];

export type Feature = any;
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

export type Arc = {
  name: string,
  type: "arc",
  points: SmPoint[],
  properties: { [k: string]: any },
};

export type LabelProps = {
  label: "park" | "city" | "region" | "sea" | "minorsea" | "river",
  text: string,
  zoom?: number | string
};

export type Label = {
  name: string
  type: "point",
  pt: ArPoint,
  properties: LabelProps,
};

export type PolyProps =
  | {
    t: "natural", natural: "lake" | "coastline" | "mountain",
    text?: string // not sure if this is used anywhere
  }
  | { t: "road", road: "highway" | "street" | "street2", text: string, zoom?: string }
  | { t: "city", text: string, zoom?: string } // shouldn't zoom be number?

export type Poly = {
  type: 'Polygon',
  arcs: string[], // arc names, really
  name: string,
  properties: PolyProps,
};

export type Images = { [k: string]: Image };
export type Obj = Label | Arc | Poly;
export type Sketches = any;

export type Geo = {
  counter: number,
  images: Images,
  objects: Obj[],
};
