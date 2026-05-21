---
name: file-info
description: Extract metadata and summary information from file paths or file content. Use when the user asks about file type, size, extension, MIME type detection, or wants quick file analysis.
license: MIT
metadata:
  author: muu-agent
  version: "1.0.0"
  tags: ["file", "metadata", "analysis"]
allowed-tools: "javascript"
---

# File Info

Extract metadata and provide summary analysis for files.

## Steps

1. Receive a file path or file name from the user
2. Execute `scripts/info.js` with the path as input
3. Present the analysis results to the user

## Parameters

The script accepts a JSON object via stdin:
```json
{
  "path": "/path/to/file.txt"
}
```

## Output Format

```json
{
  "file_name": "document.pdf",
  "extension": ".pdf",
  "mime_type": "application/pdf",
  "category": "document",
  "is_hidden": false,
  "name_without_ext": "document"
}
```

## Supported Categories

| Extensions | Category |
|---|---|
| .js .ts .py .go .java .rs .c .cpp | code |
| .md .txt .log .csv .json .xml .yaml | text |
| .pdf .doc .docx .xls .xlsx .ppt .pptx | document |
| .png .jpg .jpeg .gif .svg .webp .ico | image |
| .mp3 .wav .flac .aac .ogg | audio |
| .mp4 .avi .mov .mkv .webm | video |
| .zip .tar .gz .rar .7z | archive |

## Gotchas

- This skill only analyzes the file path/name — it does NOT read file contents
- MIME types are inferred from extension only
- Hidden files (starting with `.`) are flagged
