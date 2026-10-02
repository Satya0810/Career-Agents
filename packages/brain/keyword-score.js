// Lexical part of the knowledge base search: +1 when a query word appears in the
// content, +2 more when it appears as a whole word. Query words are matched as literal
// text, so terms like "c++" or "[2023]" are escaped before building the regex.
export function scoreKeywordMatches(contentLower, words) {
  let score = 0;
  words.forEach(word => {
    if (contentLower.includes(word)) {
      score += 1;
      const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`).test(contentLower)) {
        score += 2;
      }
    }
  });
  return score;
}
