/**
 * Text Statistics Script
 * Reads JSON { text: "..." } from stdin, outputs statistics as JSON to stdout.
 */

const input = JSON.parse(params.text || '{}');
const text = typeof input.text === 'string' ? input.text : String(input.text || '');

const characters = text.length;
const charactersNoSpaces = text.replace(/\s/g, '').length;
const words = text.trim() ? text.trim().split(/\s+/).length : 0;
const lines = text ? text.split('\n').length : 0;
const sentences = (text.match(/[.!?]+(\s|$)/g) || []).length;
const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;

// Reading time: 200 words per minute
const readingTimeSeconds = Math.ceil((words / 200) * 60);
const minutes = Math.floor(readingTimeSeconds / 60);
const seconds = readingTimeSeconds % 60;
const readingTimeFormatted = minutes > 0
  ? `~${minutes}m ${seconds}s`
  : `~${seconds} seconds`;

return {
  characters,
  characters_no_spaces: charactersNoSpaces,
  words,
  lines,
  sentences,
  paragraphs,
  reading_time_seconds: readingTimeSeconds,
  reading_time_formatted: readingTimeFormatted,
};
