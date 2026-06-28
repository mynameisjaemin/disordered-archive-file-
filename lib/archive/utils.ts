export function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}
