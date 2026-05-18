---
name: text-stats
description: Analyze text content — count characters, words, lines, sentences, and estimate reading time. Use when the user asks for text statistics, word count, or document metrics.
license: MIT
metadata:
  author: muuai-platform
  version: "1.0.0"
  tags: ["text", "analysis", "statistics"]
allowed-tools: "javascript"
---

# Text Statistics

Analyze and report statistics for any given text content.

## Steps

1. Receive the text input from the user or from a previous tool result
2. Execute `scripts/stats.js` with the text content as input
3. Report the results in a clean, formatted manner

## Parameters

The script accepts a JSON object via stdin:
```json
{
  "text": "the text content to analyze"
}
```

## Output Format

```json
{
  "characters": 150,
  "characters_no_spaces": 120,
  "words": 25,
  "lines": 5,
  "sentences": 3,
  "paragraphs": 2,
  "reading_time_seconds": 12,
  "reading_time_formatted": "~12 seconds"
}
```

## Gotchas

- Empty input returns all zeros
- Sentences are detected by `.` `!` `?` followed by space or end of string
- Reading time is estimated at 200 words per minute
