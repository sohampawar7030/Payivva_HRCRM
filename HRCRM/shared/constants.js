export const ROLES = {
  WORKER: 'worker',
  IT: 'it',
  DIRECTOR: 'director',
};

export const ROLE_LABELS = {
  worker: 'Worker',
  it: 'IT Department',
  director: 'Director / Admin',
};

export const LEAVE_TYPES = ['casual', 'privilege', 'half_day', 'wfh'];

export const LEAVE_TYPE_LABELS = {
  casual: 'Casual Leave',
  privilege: 'Privilege Leave',
  half_day: 'Half Day Leave',
  wfh: 'Work From Home',
};

export const LEAVE_STATUSES = [
  'draft',
  'pending_it',
  'it_approved',
  'it_rejected',
  'pending_director',
  'director_approved',
  'director_rejected',
  'cancelled',
];

export const PROFILE_STATUSES = [
  'not_started',
  'incomplete',
  'submitted',
  'it_approved',
  'it_rejected',
  'director_approved',
  'director_rejected',
  'fully_verified',
];

export const DOCUMENT_TYPES = {
  resume: { label: 'Resume', category: 'employment', required: true },
  aadhaar: { label: 'Aadhaar', category: 'identity', required: true },
  pan: { label: 'PAN Card', category: 'identity', required: true },
  photo: { label: 'Photos', category: 'personal', required: true },
  bank_proof: { label: 'Bank Proof', category: 'bank', required: true },
  educational_certificates: { label: 'Educational Certificates', category: 'educational', required: true },
  experience_certificates: { label: 'Experience Certificates', category: 'employment', required: false },
  offer_letter: { label: 'Offer Letter', category: 'company_letters', required: true },
  employment_agreement: { label: 'Employment Agreement', category: 'company_letters', required: true },
  nda: { label: 'NDA', category: 'compliance', required: false },
  ip_assignment: { label: 'IP Assignment', category: 'compliance', required: false },
  police_verification: { label: 'Police Verification', category: 'compliance', required: false },
  medical_certificate: { label: 'Medical Certificate', category: 'compliance', required: false },
  joining_letter: { label: 'Joining Letter', category: 'company_letters', required: false },
  bond_papers: { label: 'Bond Papers', category: 'compliance', required: false },
  payivva_info_form: { label: 'Payivva Employee Information Form', category: 'company_letters', required: false },
  cyber_security_policy: { label: 'Cyber Security Policies Letter', category: 'compliance', required: false },
  other: { label: 'Other', category: 'other', required: false },
};

export const ASSET_OPTIONS = [
  'Laptop',
  'Charger',
  'Mouse',
  'Bag',
  'SIM',
  'ID Card',
  'Email ID',
  'GitHub Access',
  'Office Keys',
  'Tool Kit',
  'Uniform',
  'Helmet',
  'Safety Shoes',
  'Other',
];

export const IT_SKILLS = [
  'Python',
  'AI/ML',
  'LLMs',
  'JavaScript',
  'React',
  'Node.js',
  'SQL',
  'Cloud',
  'Linux',
  'Git/GitHub',
  'Other',
];

export const NON_IT_SKILLS = [
  'Networking',
  'ELV',
  'Fire Alarm',
  'Access Control',
  'Electrician',
  'Computer Hardware Work',
  'CCTV Installation',
  'Product Alignment',
  'Commissioning',
  'Interior Design',
  'Electrical and Lighting Works',
  'MEP Work',
  'Others',
];

export const LETTER_TYPES = ['offer', 'joining', 'appointment', 'increment', 'promotion'];

export const LETTER_TYPE_LABELS = {
  offer: 'Offer Letter',
  joining: 'Joining Letter',
  appointment: 'Appointment Letter',
  increment: 'Increment Letter',
  promotion: 'Promotion Letter',
};

export const EMAIL_CATEGORIES = [
  'offer_letter',
  'joining_letter',
  'appointment_letter',
  'increment_letter',
  'promotion_letter',
  'leave_notification',
  'salary_delay',
  'salary_slip',
  'meeting',
  'document_verification',
  'profile_rejection',
  'profile_approval',
  'credentials',
];

export const NOTIFICATION_TYPES = [
  'info',
  'success',
  'warning',
  'error',
  'email',
  'leave',
  'payroll',
  'document',
  'verification',
  'letter',
];

export const PAYROLL_STATUSES = ['draft', 'finalized', 'paid'];