// utils/resumeUtils.ts
// Lightweight resume cleanup/section tagging used before sending resume context to Gemini.

export interface ResumeSection {
  title: string;
  content: string;
}

const SECTION_PATTERNS: Array<{ title: string; pattern: RegExp }> = [
  { title: 'Experience', pattern: /^(work\s+)?experience|employment|internship/i },
  { title: 'Projects', pattern: /^projects?|academic projects?/i },
  { title: 'Education', pattern: /^education|academics|qualification/i },
  { title: 'Skills', pattern: /^technical skills|skills|technologies|tools/i },
  { title: 'Achievements', pattern: /^achievements|awards|certifications/i },
  { title: 'Summary', pattern: /^summary|profile|objective/i },
];

export const splitResumeIntoSections = (raw: string): ResumeSection[] => {
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const sections: ResumeSection[] = [];
  let current: ResumeSection = { title: 'Header', content: '' };

  for (const line of lines) {
    const match = SECTION_PATTERNS.find(item => item.pattern.test(line.replace(/[:\-]+$/, '')));
    const looksLikeHeading = match || (/^[A-Z][A-Z\s/&-]{2,}$/.test(line) && line.length < 40);

    if (looksLikeHeading) {
      if (current.content.trim()) sections.push({ ...current, content: current.content.trim() });
      current = { title: match?.title || titleCase(line), content: '' };
    } else {
      current.content += `${line}\n`;
    }
  }

  if (current.content.trim()) sections.push({ ...current, content: current.content.trim() });
  return sections.length ? sections : [{ title: 'Resume', content: raw.trim() }];
};

export const formatResumeWithSections = (raw: string): string => {
  const sections = splitResumeIntoSections(raw);
  return sections.map(section => `## ${section.title}\n${section.content}`).join('\n\n');
};

const titleCase = (text: string) => text
  .toLowerCase()
  .replace(/\b\w/g, char => char.toUpperCase())
  .replace(/[:\-]+$/, '');
