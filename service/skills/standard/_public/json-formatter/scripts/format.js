/**
 * JSON Formatter Script
 * Reads JSON { json_string: "...", indent: 2 } from stdin, outputs formatted JSON or error.
 */

const input = JSON.parse(params.json_string || params.text || '{}');
const jsonString = input.json_string || '';
const indent = input.indent || 2;

if (!jsonString || typeof jsonString !== 'string') {
  return { success: false, error: 'No JSON string provided' };
}

try {
  const parsed = JSON.parse(jsonString);
  const formatted = JSON.stringify(parsed, null, indent);

  // Collect top-level keys
  const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];

  // Calculate nesting depth
  const getDepth = (obj, current = 0) => {
    if (typeof obj !== 'object' || obj === null) return current;
    let max = current + 1;
    for (const value of Object.values(obj)) {
      const d = getDepth(value, current + 1);
      if (d > max) max = d;
    }
    return max;
  };

  return {
    success: true,
    formatted,
    keys,
    depth: getDepth(parsed),
    size_bytes: formatted.length,
  };
} catch (err) {
  return {
    success: false,
    error: err.message,
  };
}
