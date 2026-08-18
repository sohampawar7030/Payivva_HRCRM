import PDFDocument from 'pdfkit';
import { queryOne } from '../config/db.js';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function getCompany() {
  return (
    (await queryOne('SELECT * FROM hrms_company_settings ORDER BY id LIMIT 1')) || {}
  );
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const pdfService = {
  async generateLetter({ employee, letterType, title, bodyHtml }) {
    const company = await getCompany();
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

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a5f').text(title, { align: 'center' });
    doc.moveDown(1.2);

    doc.font('Helvetica').fontSize(10.5).fillColor('#222');
    const lines = bodyHtml
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .split('\n');
    for (const line of lines) {
      doc.text(line.replace(/\s+/g, ' ').trim(), { align: 'justify', lineGap: 4 });
    }

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(10.5).text('For ' + (company.companyName || 'Payivva Technologies'), { align: 'right' });
    doc.moveDown(1.5);
    doc.text('Authorized Signatory', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#777').text('This is a system-generated document from Payivva HRCRM.', { align: 'center' });

    doc.end();
    return done;
  },

  async generateSalarySlip({ employee, company, p, config, currency }) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      doc.on('error', reject);
    });

    const cur = currency || '₹';
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a5f').text(company.companyName || 'Payivva Technologies', { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555').text('SALARY SLIP', { align: 'center' });
    doc.text(`${monthNames[p.month - 1]} ${p.year}`, { align: 'center' });
    doc.moveDown(0.6);
    doc.strokeColor('#1e3a5f').lineWidth(1.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#222').text('Employee Details');
    doc.moveDown(0.3);
    const details = [
      ['Employee Name', employee.name || employee.employeeName],
      ['Employee ID', employee.employee_id || employee.employeeCode],
      ['Department', employee.department || '-'],
      ['Designation', employee.designation || '-'],
      ['Joining Date', employee.joining_date ? new Date(employee.joining_date).toLocaleDateString('en-IN') : '-'],
    ];
    for (const [k, v] of details) {
      doc.font('Helvetica').fontSize(10).fillColor('#333').text(`${k}:`, 50, doc.y, { continued: true });
      doc.font('Helvetica-Bold').text(` ${escapeXml(v || '-')}`);
    }

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#222').text('Attendance Summary');
    doc.moveDown(0.3);
    const att = [
      ['Present Days', p.presentDays],
      ['Absent Days', p.absentDays],
      ['Leave Days', p.leaveDays],
      ['Half Days', p.halfDays],
      ['WFH Days', p.wfhDays],
      ['Late Days', p.lateDays],
      ['Overtime (min)', p.overtimeMinutes],
      ['Total Hours', p.totalHours],
    ];
    for (const [k, v] of att) {
      doc.font('Helvetica').fontSize(10).fillColor('#333').text(`${k}:`, 50, doc.y, { continued: true });
      doc.font('Helvetica-Bold').text(` ${v}`);
    }

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#222').text('Earnings');
    doc.moveDown(0.2);
    const earnings = [
      ['Basic Salary', p.basicSalary],
      ['HRA', p.hra],
      ['DA', p.da],
      ['Allowances', p.allowances],
      ['Overtime Amount', p.overtimeAmount],
    ];
    for (const [k, v] of earnings) {
      doc.font('Helvetica').fontSize(10).fillColor('#333').text(`${k}:`, 50, doc.y, { continued: true });
      doc.font('Helvetica-Bold').text(` ${cur} ${money(v)}`);
    }
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fillColor('#1e3a5f').text(`Gross Salary: ${cur} ${money(p.grossSalary)}`);

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#222').text('Deductions');
    doc.moveDown(0.2);
    const deductions = [
      ['Absent Deduction', p.absentDeduction],
      ['Late Deduction', p.lateDeduction],
      ['PF', p.pf],
      ['ESIC', p.esic],
      ['Professional Tax', p.professionalTax],
      ['Other Deductions', p.otherDeductions],
    ];
    for (const [k, v] of deductions) {
      doc.font('Helvetica').fontSize(10).fillColor('#333').text(`${k}:`, 50, doc.y, { continued: true });
      doc.font('Helvetica-Bold').text(` ${cur} ${money(v)}`);
    }
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fillColor('#1e3a5f').text(`Total Deductions: ${cur} ${money(p.totalDeductions)}`);

    doc.moveDown(0.8);
    doc.strokeColor('#1e3a5f').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a5f').text(`NET PAYABLE: ${cur} ${money(p.netSalary)}`, { align: 'center' });
    doc.moveDown(0.4);

    if (employee.bankName || employee.accountNumber) {
      doc.font('Helvetica').fontSize(9).fillColor('#444').text(
        `Payment details: Bank: ${employee.bankName || '-'} | Branch: ${employee.branch || '-'} | A/c: ${employee.accountNumber || '-'} | IFSC: ${employee.ifscCode || '-'}`,
        { align: 'center' }
      );
    }
    doc.moveDown(0.4);
    doc.fontSize(8).fillColor('#777').text('This is a computer-generated salary slip from Payivva HRCRM and does not require a signature.', { align: 'center' });

    doc.end();
    return done;
  },
};