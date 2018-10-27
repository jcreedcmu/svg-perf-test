import * as t from 'io-ts';

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

const _SmPoint = t.tuple([t.number, t.number, t.number]);

const _Arc = t.exact(t.type({
  name: t.string,
  type: t.literal('arc'),
  points: t.array(_SmPoint),
  properties: t.dictionary(t.string, t.any),
}));

export interface SmPoint extends t.TypeOf<typeof _SmPoint> { };
export interface Arc extends t.TypeOf<typeof _Arc> { };


export type Label = {
  name: string
  type: "point",
  pt: ArPoint,
  properties: { [k: string]: any },
};

export type Poly = {
  type: 'Polygon',
  arcs: string[], // arc names, really
  name: string,
  properties: { [k: string]: any }
};

export type Images = { [k: string]: Image };
export type Obj = Label | Arc | Poly;
export type Sketches = any;

export type Geo = {
  counter: number,
  images: Images,
  objects: Obj[],
  sketches: Sketches,
};
