module.exports.make_insert_label_modal = function(worldp, lab, k) {
  var process_f = null;
  if (lab) {
    console.log(lab);
    $('#insert_label input[name="text"]')[0].value = lab.properties.text;
    $('#insert_label input[name="type"]')[0].value = lab.properties.label;
    if (lab.properties.zoom == null) lab.properties.zoom = "";
    $('#insert_label input[name="zoom"]')[0].value = lab.properties.zoom;

    process_f = function (obj) {
      _.extend(obj, {pt: lab.pt, name:lab.name});
      k({name: lab.name, pt: lab.pt, type: "point",
	 properties: {text: obj.text, label: obj.type, zoom: obj.zoom}});
    }
  }
  else {
    $('#insert_label input[name="text"]')[0].value = "";
    $('#insert_label input[name="type"]')[0].value = "region";
    $('#insert_label input[name="zoom"]')[0].value = "";

    process_f = function (obj) {
      k({pt: [worldp.x, worldp.y], type: "point",
	 properties: {text: obj.text, label: obj.type, zoom: obj.zoom}});

    }
  }
  var submit_f = function(e) {
    e.preventDefault();
    var obj = _.object($("#insert_label form").serializeArray().map(function(pair) {
      return [pair.name, pair.value];
    }));
    if (obj.zoom == null || obj.zoom == "")
      delete obj.zoom;
    process_f(obj);

    $("#insert_label").modal("hide");
  };
  $("#insert_label form").off("submit");
  $("#insert_label form").on("submit", submit_f);
  $("#insert_label form button[type=submit]").off("click");
  $("#insert_label form button[type=submit]").on("click", submit_f);



  $('#insert_label').modal('show');
  setTimeout(function() { $('#insert_label input[name="text"]').focus(); }, 500);
}
