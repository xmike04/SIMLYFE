// Narrow document fixture for the save transport's JSON values. This models
// documented setDoc options, not transforms, nested mask syntax, or a backend.
const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function recursiveMerge(prior, incoming) {
  if (!isMap(incoming) || Object.keys(incoming).length === 0) return structuredClone(incoming);
  const next = isMap(prior) ? structuredClone(prior) : {};
  for (const [key, value] of Object.entries(incoming)) next[key] = recursiveMerge(next[key], value);
  return next;
}
export function applyFirestoreSave(prior, incoming, options) {
  if (!options || Object.keys(options).length === 0) return structuredClone(incoming);
  if (Object.keys(options).length !== 1) throw new Error('Unsupported fixture setDoc options');
  if (options.merge === true) {
    const next = structuredClone(prior ?? {});
    // The document root is not an empty-map field: an empty merge preserves it.
    for (const [key, value] of Object.entries(incoming)) next[key] = recursiveMerge(next[key], value);
    return next;
  }
  if (!Array.isArray(options.mergeFields)) throw new Error('Unsupported fixture setDoc options');
  const next = structuredClone(prior ?? {});
  for (const field of options.mergeFields) {
    if (typeof field !== 'string' || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(field)) {
      throw new Error('Fixture supports only literal top-level mergeFields');
    }
    if (!Object.hasOwn(incoming, field)) throw new Error('Fixture mask field absent from payload');
    next[field] = structuredClone(incoming[field]);
  }
  return next;
}
