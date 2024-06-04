export type Dict<T> = { [k: string]: T };
export type Point = { x: number, y: number };
export type Color = { r: number, g: number, b: number };
export type Ctx = CanvasRenderingContext2D;
import RBush, * as rbush from 'rbush';
import { ArcStore } from './arcstore';
import { CameraData } from './camera-state';
import { LabelStore } from './labelstore';
import { RiverLayer } from './rivers';
import { SketchLayer } from './sketch';

export type Tool = "Pan" | "Freehand" | "Move" | "Select" | "Label" | "Measure" | "Extract";


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

export type SizedImage = {
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


export type Images = Dict<SizedImage>;

export type Geo = {
  counter: number,
  points: Dict<Point>,
  images: Dict<SizedImage>,
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
export type Bush<T> = RBush<Bbox & { payload: T }>;

export type LabelModalState = { text: string, tp: string, zoom: string };
export type UiMode =
  | { t: 'normal', tool: Tool }
  | {
    t: 'label-modal', v: LabelModalState, status:
    { isNew: true, pt: Point } |
    { isNew: false, prev: Label }
  }
  | { t: 'feature-modal', points: Point[] };

export type MouseState =
  | { t: 'up' }
  | {
    t: 'pan',
    orig_p_in_page: Point, // XXX: Is this needed?
    p_in_page: Point,
    cameraData: CameraData,
  }
  | {
    t: 'measure',
    orig_p_in_page: Point,
    p_in_page: Point,
  }
  ;

export type NamedImage = SizedImage & { name: string };

export type ImageLayerState = {
  cur_img_ix: number,
  named_imgs: NamedImage[],
  overlay: string | null,
}

export type UiState = {
  mode: UiMode,
  layers: {
    road: boolean,
    boundary: boolean,
    river: boolean,
  },
  cameraData: CameraData,
  mouseState: MouseState,
  highlightTarget: Target | undefined,
  imageLayerState: ImageLayerState,
};

export interface Layer {
  render(rc: RenderCtx): void;
}

export type RenderCtx = {
  d: Ctx,
  us: UiState,
  cameraData: CameraData,
  mode: Tool,
  bbox_in_world: ArRectangle,
};

export type FeatureModalResult =
  | { t: "FeatureModalCancel" }
  | { t: "FeatureModalOk", v: { text: string, tp: string, zoom: string } };

export type LabelModalResult =
  | { t: "LabelModalCancel" }
  | { t: "LabelModalOk", result: LabelModalState }
  ;

export type Geometry = {
  arcStore: ArcStore,
  labelStore: LabelStore,
  riverLayer: RiverLayer,
  sketchLayer: SketchLayer,
};

export type Action =
  | FeatureModalResult
  | LabelModalResult
  | { t: "RadioToggle", k: keyof UiState['layers'] }
  | { t: "setMode", mode: UiMode }
  | { t: "setCameraData", camera: CameraData }
  | { t: "mouseDown", p_in_page: Point }
  | { t: "mouseMove", p_in_page: Point }
  | { t: "mouseUp", p_in_page: Point }
  | { t: "doZoom", zoom_amount: number, p_in_canvas: Point } // +1/-1 is zoom in/out by factor of two
  | { t: "setCurrentImage", ix: number }
  | { t: "setOverlayImage" }
  | { t: "setHighlight", highlight: Target | undefined }
  | { t: "multiple", actions: Action[] }
  ;
