def bi: . as $orig | range(length) | [$orig[.], .];

.objects += (.labels | to_entries | map({
  name: ("label" + .key),
  pt: [.value.p.x, .value.p.y],
  type: "point",
  properties: {label: .value.type, text: .value.text, zoom: (.value.zoom // 2)}
}))
| del(.labels)