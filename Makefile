all:
	ts-node server/server.ts

val:
	perl -e 'local $$/; print qq(import { Geo } from "../src/types";\n export const data: Geo =); print <>' data/geo.json  > validation/test.ts
	tsc -p validation
