labels = [
    {p: {x:247.5, y:1587.5}, txt: "Piada", type: "region"},
    {p: {x: 752.96875, y: 1524.375}, txt: "Ezdi Mtns", type: "region"},
    {p: {x: 454.375, y: 1590.3125}, txt: "Koennif", type: "region"},
    {p: {x: 413.4375, y: 1475.9375}, txt: "Yul Mtns", type: "region"},
    {p: {x: 658.4375, y: 1849.6875}, txt: "Nivdal", type: "region"},
    {p: {x: 992.8125, y: 1280.75}, txt: "Zbegyanda", type: "region"},
    {p: {x: 1373.4375, y: 1225.3125}, txt: "Gurvyet", type: "region"},
    {p: {x: 1130.625, y: 1565}, txt: "Old Sea", type: "sea"},
    {p: {x: 1137.1875, y: 1871.25}, txt: "Wild Droub Bay", type: "sea"},

    {p: {x: 3080.3125, y: 288.75}, txt: "Daloe", type: "region"},
    {p: {x: 2841.5625, y: 278.75}, txt: "Gorik", type: "region"},
    {p: {x: 2836.5625, y: 472.5}, txt: "Pengerra", type: "region"},
    {p: {x: 3250.3125, y: 511.25}, txt: "Minar", type: "region"},
]

rt = new RTree(10);
labels.forEach(function(lab) {
  rt.insert({x: lab.p.x, y:lab.p.y, w:0, h:0}, lab);
});

exports.render = function(d, camera, world_bbox) {
  if (camera.zoom < 1) return;
  function draw_label(p, txt, typ) {
    txt = txt.toUpperCase();
    var stroke = true;
    var height;
    if (typ == "region") {
      d.fillStyle = "#333";
      d.strokeStyle = "white";
      d.lineWidth = 2;
      height = Math.min(32, 11 * camera.scale());
    }
    else if (typ == "sea") {
      d.fillStyle = "#44a";
      stroke = false;
      height = 1.4 * Math.min(32, 11 * camera.scale());
    }
    d.font = "bold " + height + "px sans-serif";
    var width = d.measureText(txt).width;
    if (stroke)
      d.strokeText(txt, camera.x + camera.scale() * p.x - width/2,
		   camera.y - camera.scale() * p.y + height/2);
    d.fillText(txt, camera.x + camera.scale() * p.x - width/2,
	       camera.y - camera.scale() * p.y + height/2);
  }

  rt.bbox.apply(rt, world_bbox).forEach(function(lab) {
    draw_label(lab.p, lab.txt, lab.type);
  });
}
