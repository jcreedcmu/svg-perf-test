def bi: . as $orig | range(length) | [$orig[.], .];
def make_arc:
 . as [$obj,$ix]
 | {name: ("mtnarc" + ($ix | tostring)),
    type: "arc",
    properties: {},
    points: [$obj.geometry.coordinates[0][]]};

def make_poly:
 . as [$obj, $ix]
 | {name: ("mtn" + ($ix | tostring)),
    type: "Polygon",
    properties: {"natural": "mountain"},
    arcs: [("mtnarc" + ($ix | tostring))]};

# jq -f process.jq -s geo.json mountains.json

. as [$geo, $mountains] | ($geo | (. |= (.objects += [($mountains.features | bi | (make_poly, make_arc))])))
