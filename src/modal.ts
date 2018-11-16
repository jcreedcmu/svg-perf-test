import { Point, Label, LabType } from './types';
import _ = require('underscore');

function setVal(q: string, v: string): void {
  ($(q)[0] as HTMLInputElement).value = v;
}

function sanitize(s: string): LabType {
  if (s == "park" || s == "city" || s == "region" || s == "sea" || s == "minorsea" || s == "river")
    return s;
  return "region";
}

export function make_insert_label_modal(worldp: Point, lab: Label | null, k: (x: Label) => void) {
  let process_f: (obj: any) => void;

  if (lab) {
    console.log(lab);
    setVal('#insert_label input[name="text"]', lab.properties.text);
    setVal('#insert_label input[name="type"]', lab.properties.label);
    if (lab.properties.zoom == null) lab.properties.zoom = undefined;
    setVal('#insert_label input[name="zoom"]', lab.properties.zoom + '');
  }
  else {
    setVal('#insert_label input[name="text"]', "");
    setVal('#insert_label input[name="type"]', "region");
    setVal('#insert_label input[name="zoom"]', "");
  }
  let submit_f: any = (e: Event) => {
    e.preventDefault();
    const obj = (_.object($("#insert_label form").serializeArray().map(pair => {
      return [pair.name, pair.value];
    }))) as { zoom: string, type: string, text: string };
    if (obj.zoom == null || obj.zoom == "")
      delete obj.zoom;

    if (lab) {
      _.extend(obj, { pt: lab.pt, name: lab.name });
      k({
        name: lab.name,
        pt: lab.pt,
        properties: { text: obj.text, label: sanitize(obj.type), zoom: parseInt(obj.zoom) }
      });
    }
    else {
      k({
        name: "anonymous",
        pt: [worldp.x, worldp.y],
        properties: { text: obj.text, label: sanitize(obj.type), zoom: parseInt(obj.zoom) }
      });

    }

    ($("#insert_label") as any).modal("hide");
  };
  $("#insert_label form").off("submit");
  $("#insert_label form").on("submit", submit_f);
  $("#insert_label form button[type=submit]").off("click");
  $("#insert_label form button[type=submit]").on("click", submit_f);


  ($('#insert_label') as any).modal('show');
  setTimeout(function() { $('#insert_label input[name="text"]').focus(); }, 500);
}
