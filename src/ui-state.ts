import { mkCameraData } from './camera-state';
import { Dict, NamedImage, SizedImage, UiState } from './types';

export function mkUiState(images: Dict<SizedImage>, counter: number): UiState {
  const named_imgs: NamedImage[] = Object.entries(images).map(pair => {
    return { ...pair[1], name: pair[0] };
  });

  return {
    counter,
    layers: { boundary: false, river: false, road: false },
    mode: { t: 'normal', tool: 'Pan' },
    cameraData: mkCameraData(),
    mouseState: { t: 'up' },
    imageLayerState: {
      cur_img_ix: 0,
      named_imgs,
      overlay: null,
    },
    lastz: [],
    slastz: "[]",
  };
}
