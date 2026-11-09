'use strict';
// A small JSON Schema checker for the keywords catalog/schema.json uses, so the tests need no
// dependency: type, const, enum, required, properties, additionalProperties: false, items,
// minItems, maxItems, uniqueItems, minLength, maxLength, pattern, $ref (#/$defs/...), anyOf,
// not, if/then/else. An unknown keyword throws, so the schema can't quietly outgrow this file.

const KNOWN = new Set(['$schema', '$id', 'title', 'description', '$defs', 'type', 'const', 'enum', 'required',
  'properties', 'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength',
  'maxLength', 'pattern', '$ref', 'anyOf', 'not', 'if', 'then', 'else']);

const typeOf = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Returns a list of "path: problem" strings; empty means valid.
function validate(schema, value, root = schema, at = '$') {
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) throw new Error(`json-schema.js does not support "${k}" (at ${at})`);
  const errs = [];
  if (schema.$ref) {
    const m = schema.$ref.match(/^#\/\$defs\/(.+)$/);
    if (!m || !root.$defs?.[m[1]]) throw new Error(`unresolvable $ref ${schema.$ref}`);
    errs.push(...validate(root.$defs[m[1]], value, root, at));
  }
  const t = typeOf(value);
  if (schema.type && !(schema.type === t || (schema.type === 'number' && t === 'integer'))) return [...errs, `${at}: expected ${schema.type}, got ${t}`];
  if ('const' in schema && !same(schema.const, value)) errs.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(e => same(e, value))) errs.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  if (t === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) errs.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errs.push(`${at}: does not match ${schema.pattern}`);
  }
  if (t === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) errs.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errs.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) errs.push(`${at}: items are not unique`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, root, `${at}[${i}]`)));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${at}: missing "${k}"`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) errs.push(...validate(schema.properties[k], v, root, `${at}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${at}: unexpected "${k}"`);
    }
  }
  if (schema.anyOf && !schema.anyOf.some(s => !validate(s, value, root, at).length)) errs.push(`${at}: matches none of anyOf`);
  if (schema.not && !validate(schema.not, value, root, at).length) errs.push(`${at}: matches a schema it must not`);
  if (schema.if) {
    const branch = validate(schema.if, value, root, at).length ? schema.else : schema.then;
    if (branch) errs.push(...validate(branch, value, root, at));
  }
  return errs;
}

module.exports = { validate };
