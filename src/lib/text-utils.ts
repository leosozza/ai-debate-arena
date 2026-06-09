/** Remove markdown so TTS não leia "asterisco asterisco". */
export function stripMarkdownForTts(input: string): string {
  if (!input) return "";
  let t = input;
  // code fences and inline code
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
  // images ![alt](url) → alt
  t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // links [text](url) → text
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // bold/italic markers
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/(^|\s)_([^_]+)_/g, "$1$2");
  // headings, blockquotes, list bullets at line start
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  t = t.replace(/^\s{0,3}>\s?/gm, "");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/^\s*\d+\.\s+/gm, "");
  // stray asterisks/underscores
  t = t.replace(/[*_~`]+/g, "");
  // collapse whitespace
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  return t.trim();
}
