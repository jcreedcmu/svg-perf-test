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
export type Bundle =
  ['coastline', { point: ArPoint }]
  | ['label', string];

export type ArRectangle = [number, number, number, number];

export type Feature = any;
export type Segment = any;

export type ArcVertexTarget = { arc: string, point: ArPoint };
export type LabelTarget = string;
export type Target = ["coastline", ArcVertexTarget] | ["label", LabelTarget];


const _ArPoint = t.tuple([t.number, t.number]);
const _SmPoint = t.tuple([t.number, t.number, t.number]);
const _Arc = t.exact(t.type({
  name: t.string,
  type: t.literal('arc'),
  points: t.array(_SmPoint),
  properties: t.dictionary(t.string, t.any),
}));
const _Arc2 = t.exact(t.type({
  name: t.string,
  type: t.literal('arc'),
  points: t.array(_ArPoint),
  properties: t.dictionary(t.string, t.any),
}));
const _Label = t.exact(t.type({
  name: t.string,
  type: t.literal('point'),
  pt: _ArPoint,
  properties: t.dictionary(t.string, t.any),
}));
const _Poly = t.exact(t.type({
  name: t.string,
  type: t.literal('Polygon'),
  arcs: t.array(t.string),
  properties: t.dictionary(t.string, t.any),
}));
const _Image = t.exact(t.type({
  scale: t.number,
  x: t.number,
  y: t.number
}));
const _Images = t.dictionary(t.string, _Image);
const _Obj = t.union([_Label, _Arc2, _Poly]);
const _Sketches = t.any;
export const _Geo = t.exact(t.type({
  counter: t.number,
  images: _Images,
  objects: t.array(_Obj),
  sketches: _Sketches,
}));

export interface SmPoint extends t.TypeOf<typeof _SmPoint> { };
export interface Arc extends t.TypeOf<typeof _Arc> { };
export interface Label extends t.TypeOf<typeof _Label> { };
export interface ArPoint extends t.TypeOf<typeof _ArPoint> { };
export interface Image extends t.TypeOf<typeof _Image> { };
export interface Images extends t.TypeOf<typeof _Images> { };
export interface Poly extends t.TypeOf<typeof _Poly> { };
export interface Geo extends t.TypeOf<typeof _Geo> { };
