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
