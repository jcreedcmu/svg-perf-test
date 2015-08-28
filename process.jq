def bi: . as $orig | range(length) | [$orig[.], .];

.objects = [(.features[] | (.arcs[] |= "arc" + (. | tostring))),
(.arcs | bi as [$obj, $ix] | $obj + {name: ("arc" + ($ix | tostring))})]
| del(.features)
| del(.arcs)