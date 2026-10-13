/**
 * orval input transformer.
 *
 * The Nest swagger occasionally emits an operation whose URL contains a path
 * placeholder (e.g. `/branches/{id}/my-access`) without declaring that
 * placeholder as a path parameter, which fails orval's spec validation and
 * would otherwise produce a hook missing the argument. This walks every
 * operation and injects any missing `in: path` parameters so codegen succeeds
 * and the generated hook takes the id argument.
 *
 * Remove once the backend declares the parameters (e.g. via @ApiParam).
 */
const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];

module.exports = (spec) => {
  const paths = (spec && spec.paths) || {};
  for (const [route, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue;
    const names = [...route.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    if (names.length === 0) continue;
    const pathLevel = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const op = item[method];
      if (!op || typeof op !== 'object') continue;
      if (!Array.isArray(op.parameters)) op.parameters = [];
      for (const name of names) {
        const declared = [...pathLevel, ...op.parameters].some(
          (p) => p && p.in === 'path' && p.name === name,
        );
        if (!declared) {
          op.parameters.push({
            name,
            in: 'path',
            required: true,
            schema: { type: 'string' },
          });
        }
      }
    }
  }
  return spec;
};
