import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { queryOne } from '../config/db.js';

async function getCompany() {
  return (
    (await queryOne('SELECT * FROM hrms_company_settings ORDER BY id LIMIT 1')) || {}
  );
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(d) {
  if (!d) return new Date().toLocaleDateString('en-GB');
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

function resolveAssetPath(fileRelPath) {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'public', fileRelPath),
    path.join(cwd, 'frontend', 'public', fileRelPath),
    path.join(cwd, 'dist', fileRelPath),
    path.join(cwd, fileRelPath),
    path.resolve(cwd, '..', 'public', fileRelPath),
    path.resolve(cwd, '..', fileRelPath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export const pdfService = {
  async generateMasterLetter({ employee, company, letterType = 'offer', title, extra = {} }) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      doc.on('error', reject);
    });

    const fontMap = {
      'Times New Roman': { regular: 'Times-Roman', bold: 'Times-Bold' },
      'Times': { regular: 'Times-Roman', bold: 'Times-Bold' },
      'Arial': { regular: 'Helvetica', bold: 'Helvetica-Bold' },
      'Helvetica': { regular: 'Helvetica', bold: 'Helvetica-Bold' },
      'Courier New': { regular: 'Courier', bold: 'Courier-Bold' },
    };

    const chosenFont = fontMap[extra.fontFamily] || fontMap['Times New Roman'];
    const fontRegular = chosenFont.regular;
    const fontBold = chosenFont.bold;

    const logoPath = resolveAssetPath('imp_doc/company_logo.png');
    const signPath = resolveAssetPath('imp_doc/digital_sign.png');

    const leftMargin = 40;
    const rightMargin = 555;
    const contentWidth = rightMargin - leftMargin;

    // 1. Prominent Company Logo Header (Dynamic Positioning, Sizing & Gap)
    if (logoPath) {
      try {
        const logoWidth = Number(extra.logoWidth) || 300;
        const logoHeight = Number(extra.logoHeight) || 110;
        const logoOffsetX = extra.logoOffsetX != null ? Number(extra.logoOffsetX) : 16;
        const logoOffsetY = extra.logoOffsetY != null ? Number(extra.logoOffsetY) : 15;
        const logoGap = extra.logoGap != null ? Number(extra.logoGap) : 10;
        const logoX = (595.28 - logoWidth) / 2 + logoOffsetX;
        doc.image(logoPath, logoX, logoOffsetY, { fit: [logoWidth, logoHeight] });
        doc.y = logoOffsetY + logoHeight + logoGap;
      } catch (err) {
        doc.y = 35;
      }
    } else {
      doc.y = 35;
    }

    // 2. Document Main Title
    const titleText = title || (
      letterType === 'joining' ? 'JOINING LETTER' :
      letterType === 'appointment' ? 'LETTER OF APPOINTMENT' :
      letterType === 'increment' ? 'SALARY INCREMENT LETTER' :
      letterType === 'promotion' ? 'PROMOTION LETTER' :
      'OFFER OF APPOINTMENT'
    );

    doc.font(fontBold).fontSize(18).fillColor('#b8860b').text(titleText, { align: 'center' });
    doc.moveDown(0.4);

    doc.font(fontBold).fontSize(12).fillColor('#000000').text('PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED', { align: 'center' });
    doc.font(fontRegular).fontSize(9.5).fillColor('#333333').text('House No. 105, Green Park, Venkatesh Properties, Undri, Pune - 411060', { align: 'center' });
    doc.text('www.payivvatechnologies.in  |  +91 8380009994 / +91 8380009995', { align: 'center' });
    doc.moveDown(1.2);

    // 3. Date & Salutation
    const dateStr = formatDateDisplay(extra.date || extra.effectiveDate || new Date());
    const empName = extra.employeeName || employee.name || 'Candidate';
    const empCode = extra.employeeCode || employee.employee_id || 'PAYIVVA_EMP';
    const designation = extra.designation || employee.designation || 'Technician';
    const prevDesignation = extra.prevDesignation || employee.designation || 'Technician';
    const workLocation = extra.workLocation || 'Pune & PAN INDIA As per project requirement';
    const department = extra.department || employee.department || 'Operations';
    const joiningDateStr = formatDateDisplay(extra.joiningDate || employee.joining_date);
    const effectiveDateStr = formatDateDisplay(extra.effectiveDate || extra.joiningDate || new Date());
    const salaryVal = extra.salary != null ? extra.salary : (employee.salary || 27000);
    const prevSalaryVal = extra.prevSalary != null ? extra.prevSalary : 24000;
    const salaryFormatted = typeof salaryVal === 'number' ? `Rs. ${salaryVal.toLocaleString('en-IN')}/-` : `Rs. ${salaryVal}/-`;
    const prevSalaryFormatted = typeof prevSalaryVal === 'number' ? `Rs. ${prevSalaryVal.toLocaleString('en-IN')}/-` : `Rs. ${prevSalaryVal}/-`;

    doc.font(fontRegular).fontSize(11).fillColor('#000000').text(`Date: ${dateStr}`, leftMargin, doc.y);
    doc.moveDown(0.8);
    doc.text(`Dear Mr./Ms. ${empName},`, leftMargin, doc.y);
    doc.moveDown(0.8);

    // Opening Paragraph & Table Grid according to Letter Type
    let openingPara = '';
    let tableRows = [];
    let defaultTerms = [];

    if (letterType === 'joining') {
      openingPara = `We are pleased to confirm your joining as “${designation}” with PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED effective from ${joiningDateStr}. We welcome you aboard and look forward to a rewarding professional career together.`;
      tableRows = [
        ['Employee ID', empCode],
        ['Employee Name', empName],
        ['Designation', designation],
        ['Department', department],
        ['Work Location', workLocation],
        ['Date of Joining', joiningDateStr],
        ['Monthly CTC Salary', salaryFormatted],
      ];
      defaultTerms = [
        'You have successfully completed the initial document verification process.',
        'You will adhere to company attendance, reporting timings, and safety standards.',
        'You are required to maintain complete confidentiality regarding client data and projects.',
        'Your performance will be reviewed as per standard company appraisal procedures.',
      ];
    } else if (letterType === 'appointment') {
      openingPara = `Following your acceptance of our offer, PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED is pleased to appoint you as “${designation}” with effect from ${joiningDateStr}.`;
      tableRows = [
        ['Employee ID', empCode],
        ['Employee Name', empName],
        ['Designation', designation],
        ['Department', department],
        ['Work Location', workLocation],
        ['Effective Appointment Date', joiningDateStr],
        ['Monthly Salary', salaryFormatted],
      ];
      defaultTerms = [
        'Employment is governed by company service rules and professional standards.',
        'You will be under probation for a period of six months from the appointment date.',
        'Confidentiality of company proprietary code and client contracts must be preserved.',
        'Standard notice period rules will apply as outlined in company employment policies.',
      ];
    } else if (letterType === 'increment') {
      openingPara = `In recognition of your performance, dedication, and valuable contributions to PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED, we are pleased to inform you that your monthly salary has been revised effective from ${effectiveDateStr}.`;
      tableRows = [
        ['Employee ID', empCode],
        ['Employee Name', empName],
        ['Designation', designation],
        ['Department', department],
        ['Effective Date of Hike', effectiveDateStr],
        ['Previous Monthly Salary', prevSalaryFormatted],
        ['Revised Monthly Salary', salaryFormatted],
      ];
      defaultTerms = [
        'The terms of your compensation structure remain strictly confidential.',
        'All other terms and conditions of your employment remain unchanged.',
        'We look forward to your continued dedication and excellence in upcoming projects.',
      ];
    } else if (letterType === 'promotion') {
      openingPara = `We are delighted to inform you that in recognition of your outstanding performance, technical leadership, and commitment, you are being promoted to the position of “${designation}” effective from ${effectiveDateStr}.`;
      tableRows = [
        ['Employee ID', empCode],
        ['Employee Name', empName],
        ['Previous Designation', prevDesignation],
        ['New Promoted Designation', designation],
        ['Department', department],
        ['Effective Date of Promotion', effectiveDateStr],
        ['Revised Monthly Salary', salaryFormatted],
      ];
      defaultTerms = [
        'You will be responsible for leading project execution and team guidance in your new role.',
        'The compensation details remain confidential between you and the company management.',
        'All other standard employment policies and professional guidelines continue to apply.',
      ];
    } else {
      // Default: Offer Letter
      openingPara = `We are pleased to offer you the position of “${designation}” with PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED. We are confident that your skills and dedication will contribute to the continued success of our organization.`;
      tableRows = [
        ['Employee ID', empCode],
        ['Employee Name', empName],
        ['Designation', designation],
        ['Work Location', workLocation],
        ['Department', department],
        ['Joining Date', joiningDateStr],
        ['Monthly Salary', salaryFormatted],
      ];
      defaultTerms = [
        'Employment is full-time.',
        'You are expected to maintain confidentiality of all company and client information.',
        'You may be assigned to projects at different client locations as required.',
        'You must comply with all company policies and professional standards.',
        'This offer is subject to verification of the documents submitted.',
      ];
    }

    doc.font(fontRegular).fontSize(11).fillColor('#000000')
      .text(openingPara, leftMargin, doc.y, { align: 'justify', lineGap: 4 });

    doc.moveDown(1.2);

    // 4. Details Table Grid
    const col1Width = 160;
    const col2Width = contentWidth - col1Width;
    let currentY = doc.y;
    const rowHeight = 24;

    for (let i = 0; i < tableRows.length; i++) {
      const [label, val] = tableRows[i];

      doc.rect(leftMargin, currentY, col1Width, rowHeight).strokeColor('#000000').lineWidth(0.75).stroke();
      doc.rect(leftMargin + col1Width, currentY, col2Width, rowHeight).strokeColor('#000000').lineWidth(0.75).stroke();

      doc.font(fontBold).fontSize(10.5).fillColor('#000000')
        .text(label, leftMargin + 10, currentY + 6, { width: col1Width - 20, height: rowHeight - 6 });

      doc.font(fontRegular).fontSize(10.5).fillColor('#000000')
        .text(val, leftMargin + col1Width + 10, currentY + 6, { width: col2Width - 20, height: rowHeight - 6 });

      currentY += rowHeight;
    }

    doc.y = currentY + 16;

    // 5. Terms of Employment / Guidelines (Left-Aligned Header)
    const termsHeader = letterType === 'joining' ? 'Joining Guidelines & Terms' :
      letterType === 'appointment' ? 'Appointment Terms & Conditions' :
      letterType === 'increment' ? 'Terms & Guidelines' :
      letterType === 'promotion' ? 'Promotion Guidelines & Responsibilities' :
      'Terms of Employment';

    doc.font(fontBold).fontSize(12).fillColor('#2b6cb0').text(termsHeader, leftMargin, doc.y);
    doc.moveDown(0.6);

    const terms = Array.isArray(extra.termsOfEmployment) && extra.termsOfEmployment.length > 0
      ? extra.termsOfEmployment
      : defaultTerms;

    doc.font(fontRegular).fontSize(10.5).fillColor('#000000');
    for (const term of terms) {
      doc.text(`•  ${term}`, leftMargin, doc.y, { width: contentWidth, align: 'left', lineGap: 4 });
      doc.moveDown(0.3);
    }

    doc.moveDown(1);

    // 6. Closing text
    doc.font(fontRegular).fontSize(11).fillColor('#000000').text('Please sign below as your acceptance of this document.', leftMargin, doc.y);
    doc.moveDown(0.9);

    // 7. Acceptance & Prominent Stamp Signature Table
    const sigTableTop = doc.y;
    const sigTableHeight = 92;
    const halfWidth = contentWidth / 2;

    doc.rect(leftMargin, sigTableTop, contentWidth, sigTableHeight).strokeColor('#000000').lineWidth(0.75).stroke();
    doc.moveTo(leftMargin + halfWidth, sigTableTop).lineTo(leftMargin + halfWidth, sigTableTop + sigTableHeight).strokeColor('#000000').lineWidth(0.75).stroke();
    doc.moveTo(leftMargin, sigTableTop + 22).lineTo(rightMargin, sigTableTop + 22).strokeColor('#000000').lineWidth(0.75).stroke();

    doc.font(fontBold).fontSize(10.5).fillColor('#000000')
      .text('For PAYIVVA TECHNOLOGIES', leftMargin + 10, sigTableTop + 6);
    doc.text('Accepted By', leftMargin + halfWidth + 10, sigTableTop + 6);

    if (signPath) {
      try {
        doc.image(signPath, leftMargin + 10, sigTableTop + 25, { fit: [120, 58] });
      } catch (err) {
        // fallback
      }
    }
    doc.font(fontBold).fontSize(10.5).fillColor('#000000')
      .text('Authorized Signatory', leftMargin + 10, sigTableTop + 72);

    doc.font(fontBold).fontSize(10.5).fillColor('#000000')
      .text(empName, leftMargin + halfWidth + 10, sigTableTop + 68);

    doc.end();
    return done;
  },

  // Offer letter alias
  async generateOfferLetter(opts) {
    return this.generateMasterLetter({ ...opts, letterType: 'offer' });
  },

  async generateLetter({ employee, letterType = 'offer', title, bodyHtml, extra = {} }) {
    const company = await getCompany();
    return this.generateMasterLetter({ employee, company, letterType, title, extra });
  },

  async generateSalarySlip({ employee, company, p, config, currency }) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      doc.on('error', reject);
    });

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a5f').text(company.companyName || 'Payivva Technologies', { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555').text(company.address || '', { align: 'center' });
    doc.text(
      [company.city, company.state].filter(Boolean).join(', ') + (company.pincode ? ` - ${company.pincode}` : ''),
      { align: 'center' }
    );
    if (company.contactPhone || company.contactEmail) {
      doc.text([company.contactPhone, company.contactEmail, company.website].filter(Boolean).join('  |  '), { align: 'center' });
    }
    doc.moveDown(0.5);
    doc.strokeColor('#1e3a5f').lineWidth(1.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1.2);

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a5f').text('SALARY SLIP', { align: 'center' });
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(10).fillColor('#333');
    doc.text(`Employee: ${employee.name} (${employee.employee_id || ''})`);
    doc.text(`Designation: ${employee.designation || '-'}`);
    doc.text(`Department: ${employee.department || '-'}`);
    doc.text(`Month/Year: ${p.month}/${p.year}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Earnings:');
    doc.font('Helvetica');
    doc.text(`Basic Salary: ${currency} ${money(p.basicPay)}`);
    if (p.overtimePay > 0) doc.text(`Overtime Pay: ${currency} ${money(p.overtimePay)}`);
    if (p.allowances > 0) doc.text(`Allowances: ${currency} ${money(p.allowances)}`);
    doc.text(`Gross Earnings: ${currency} ${money(p.grossSalary)}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Deductions:');
    doc.font('Helvetica');
    doc.text(`Absence Deduction: ${currency} ${money(p.absenceDeduction)}`);
    if (p.penaltyDeduction > 0) doc.text(`Penalty: ${currency} ${money(p.penaltyDeduction)}`);
    if (p.advanceDeduction > 0) doc.text(`Advance Repayment: ${currency} ${money(p.advanceDeduction)}`);
    doc.text(`Total Deductions: ${currency} ${money(p.totalDeductions)}`);
    doc.moveDown(1);

    doc.strokeColor('#ccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#166534').text(`NET SALARY PAID: ${currency} ${money(p.netSalary)}`);
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(9).fillColor('#777').text('This is a computer generated salary slip and does not require signature.', { align: 'center' });

    doc.end();
    return done;
  },
};