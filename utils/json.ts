export const parseJsonObject = <T>(text: string): T => {
  const withoutFences = text.replace(/```json\s*|```/gi, '').trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('The AI response did not contain a JSON object.');
  }
  return JSON.parse(withoutFences.slice(start, end + 1)) as T;
};