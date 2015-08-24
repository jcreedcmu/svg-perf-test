def bi: . as $orig | range(length) | [$orig[.], .];

.features.objects |=
[.[] | . as $obj | .arcs | bi
 | . as [$arcs, $ix]
 | ($obj | (.name = .name + "-" + ($ix | tostring))
         | (.arcs = [$arcs])
	 | (.properties.natural =
	      if $ix == 0 then "coastline" else "lake" end))]