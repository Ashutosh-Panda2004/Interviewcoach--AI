import fs from 'node:fs';
import path from 'node:path';

const clientDirectory = path.resolve('dist/client');
if (!fs.existsSync(clientDirectory)) {
  throw new Error('Client build is missing. Run `npm run build` first.');
}

const files = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else files.push(target);
  }
};
visit(clientDirectory);

const textFiles = files.filter(file => /\.(?:html|js|css|map|json|txt)$/i.test(file));
const forbiddenPatterns = [
  { label: 'Gemini API key', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { label: 'server source signature', pattern: /InterviewCoach server running on http:\/\/localhost/g },
];

const configuredSecrets = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY]
  .filter(value => typeof value === 'string' && value.length >= 20);

const findings = [];
for (const file of textFiles) {
  const contents = fs.readFileSync(file, 'utf8');
  for (const check of forbiddenPatterns) {
    if (check.pattern.test(contents)) findings.push(`${check.label} in ${path.relative(process.cwd(), file)}`);
    check.pattern.lastIndex = 0;
  }
  for (const secret of configuredSecrets) {
    if (contents.includes(secret)) findings.push(`configured Gemini secret in ${path.relative(process.cwd(), file)}`);
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(`Bundle security scan passed (${textFiles.length} text assets checked).`);
