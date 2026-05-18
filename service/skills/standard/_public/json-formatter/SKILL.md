---
name: json-formatter
description: Format, validate, and prettify JSON data. Use when the user needs to format messy JSON, validate JSON syntax, or convert between compact and pretty JSON.
license: MIT
metadata:
  author: muuai-platform
  version: "1.0.0"
  tags: ["json", "format", "validate"]
allowed-tools: "javascript"
---

# JSON Formatter

Format, validate, and analyze JSON data.

## Steps

1. Receive the JSON string from the user or a previous tool
2. Execute `scripts/format.js` with the JSON content and desired options
3. Return the formatted result or validation errors

## Parameters

The script accepts a JSON object via stdin:
```json
{
  "json_string": "{\"key\":\"value\"}",
  "indent": 2
}
```

- `json_string` (required): The JSON text to process
- `indent` (optional, default 2): Number of spaces for indentation

## Output Format

On success:
```json
{
  "success": true,
  "formatted": "{\n  \"key\": \"value\"\n}",
  "keys": ["key"],
  "depth": 1,
  "size_bytes": 16
}
```

On failure:
```json
{
  "success": false,
  "error": "Unexpected token at position 5"
}
```

## Gotchas

- Trailing commas are NOT valid JSON and will cause parse errors
- Single-quoted strings are NOT valid JSON — suggest the user use double quotes
- Very large JSON (>1MB) may be truncated in the response
