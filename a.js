var $svg = $("#circle-bin");

for (var i = 0; i < 10000; i++) {
  var newc = $(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
  newc.attr({cx: Math.random() * 300, cy: Math.random() * 300, r: 10});
  newc.prependTo($svg);
}

$("#my-circle").on('mousedown', function(e) {
  var th = $(this);
  var x = e.pageX;
  var y = e.pageY;
  var cx = parseInt(th.attr('cx'));
  var cy = parseInt(th.attr('cy'));
  $(document).on('mousemove.drag', function(e) {
    var t = Date.now();
    th.attr('cx', cx + e.pageX - x);
    th.attr('cy', cy + e.pageY - y);
    $svg.attr('transform', 'translate(' + (50 + e.pageX - x) + ', ' +
     (50 + e.pageY - y) + ')');
    console.log(Date.now() - t);
  });
  $(document).on('mouseup.drag', function(e) {
    $(document).off('.drag');
  });
});
