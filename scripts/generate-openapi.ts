import { writeFileSync } from 'node:fs';
import { getOpenApiJson } from '../worker/src/openapi.ts';

writeFileSync('frontend/public/openapi.json', getOpenApiJson());
console.log('Generated frontend/public/openapi.json');
