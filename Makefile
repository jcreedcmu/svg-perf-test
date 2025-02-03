serve:
	npx ts-node server/server.ts

watch:
	node build.js watch

test:
	cd src && npm run test-watch

val:
	perl -e 'local $$/; print qq(import { Geo } from "../src/types";\n export const data: Geo =); print <>' data/geo.json  > validation/test.ts
	npx tsc -p validation

count:
	ag -g 'js$$|tsx?$$' --ignore='public' --ignore 'src/__tests__' | xargs wc -l

check:
	cd src && npx tsc -w
