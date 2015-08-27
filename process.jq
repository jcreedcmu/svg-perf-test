def bi: . as $orig | range(length) | [$orig[.], .];

[(.features[] | (.arcs[] |= "arc" + (. | tostring))),
(.arcs | bi as [$obj, $ix] | $obj + {name: ("arc" + ($ix | tostring))})]