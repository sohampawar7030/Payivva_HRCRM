import fs from 'fs';
import path from 'path';

const logoPath = path.join(process.cwd(), 'public', 'imp_doc', 'company_logo.png');
const signPath = path.join(process.cwd(), 'public', 'imp_doc', 'digital_sign.png');

const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const signBase64 = fs.readFileSync(signPath).toString('base64');

const content = `// Auto-generated asset fallback for Vercel Serverless Function
export const LOGO_BASE64 = "${logoBase64}";
export const SIGN_BASE64 = "${signBase64}";
`;

fs.writeFileSync(path.join(process.cwd(), 'backend', 'services', 'assets.js'), content);
console.log('Successfully generated backend/services/assets.js with embedded Base64 images.');
