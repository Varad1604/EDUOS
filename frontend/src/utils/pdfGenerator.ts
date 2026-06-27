import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to format date cleanly
const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Helper to format currency
const formatCurrency = (amt: string | number) => {
  const num = typeof amt === 'string' ? parseFloat(amt) : amt;
  return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const generateInvoicePDF = (student: any, allocation: any) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height; // A4 = 297mm
  
  // ── 1. Color Palette (Slate Blue / Corporate) ──
  const primaryColor = [30, 41, 59]; // #1e293b (Slate 800)
  const secondaryColor = [71, 85, 105]; // #475569 (Slate 600)
  const accentColor = [220, 38, 38]; // #dc2626 (Red 600 for outstanding)
  const borderLight = [226, 232, 240]; // #e2e8f0

  // ── 2. Top Banner / Header ──
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EDUOS ENGINEERING COLLEGE', 14, 11);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Campus Road, Tech Zone, Bangalore, KA - 560001 | finance@eduos.org', 14, 16);
  doc.text('PAN: AABCE1234F | GSTIN: 29AABCE1234F1Z5', 14, 21);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('INVOICE / BILL OF SUPPLY', pageWidth - 14, 13, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Original for Recipient', pageWidth - 14, 19, { align: 'right' });

  // ── 3. Billing & Student Details grid ──
  let currentY = 36;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  // Left Column: Billed To
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILLED TO (STUDENT):', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  
  const name = `${student.person.first_name} ${student.person.last_name || ''}`.trim();
  doc.setFont('helvetica', 'bold');
  doc.text(name, 14, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const enrollmentNo = student.enrollment_number ?? 'N/A';
  doc.text(`Roll No: ${enrollmentNo}`, 14, currentY + 10);
  doc.text(`Program: B.Tech (Computer Science & Eng.)`, 14, currentY + 14.5);
  doc.text(`Quota: ${student.quota || 'Merit'} | Category: ${student.category || 'General'}`, 14, currentY + 19);

  // Right Column: Invoice Metadata
  const enrollmentSlug = (student.enrollment_number ?? 'UNKNOWN').replace(/\s+/g, '');
  const invoiceNo = `INV/2026/SEM-${allocation.semester}/${enrollmentSlug}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INVOICE DETAILS:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Invoice No:  ${invoiceNo}`, pageWidth / 2 + 10, currentY + 5.5);
  doc.text(`Invoice Date: ${formatDate(allocation.created_at || new Date().toISOString())}`, pageWidth / 2 + 10, currentY + 10);
  doc.text(`Due Date:     ${formatDate(allocation.due_date)}`, pageWidth / 2 + 10, currentY + 14.5);
  
  // Status tag background
  const outstanding = parseFloat(allocation.total_amount) - parseFloat(allocation.paid_amount);
  const statusColor = allocation.status === 'Paid' ? [16, 185, 129] : outstanding > 0 ? [239, 68, 68] : [245, 158, 11];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(pageWidth / 2 + 10, currentY + 17, 30, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(allocation.status.toUpperCase(), pageWidth / 2 + 25, currentY + 20.5, { align: 'center' });

  // ── 4. Main Particulars Table ──
  currentY = 66;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  autoTable(doc, {
    startY: currentY,
    head: [['Sl No.', 'Description of Services', 'SAC Code', 'Semester', 'Taxable Value', 'Total (INR)']],
    body: [
      [
        '1',
        'Academic Tuition & Facility Fees\n(B.Tech CS Engineering program)',
        '999293',
        `Sem ${allocation.semester}`,
        formatCurrency(allocation.total_amount),
        formatCurrency(allocation.total_amount)
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor as any,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: primaryColor as any,
      cellPadding: 6,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 75 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 27, halign: 'right' },
      5: { cellWidth: 27, halign: 'right' },
    },
    margin: { left: 14, right: 14 }
  });

  // ── 5. Total Calculations & Summary ──
  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // Draw separator line
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.line(14, finalY, pageWidth - 14, finalY);
  finalY += 6;

  // Left Section: Notes
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Notes & Declarations:', 14, finalY);
  doc.text('1. SAC 999293 represents Higher Educational services which are currently exempt from', 14, finalY + 4);
  doc.text('   GST under Notification No. 12/2017 - Central Tax (Rate).', 14, finalY + 7.5);
  doc.text('2. Please retain this invoice statement for tax benefits under Section 80C of the IT Act.', 14, finalY + 11);

  // Right Section: Calculations
  const calcX = pageWidth - 65;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(8.5);

  doc.text('Subtotal:', calcX, finalY);
  doc.text(formatCurrency(allocation.total_amount), pageWidth - 14, finalY, { align: 'right' });

  doc.text('Waiver / Discounts:', calcX, finalY + 4.5);
  doc.text(formatCurrency(allocation.waiver_amount || 0), pageWidth - 14, finalY + 4.5, { align: 'right' });

  doc.text('Total Paid to Date:', calcX, finalY + 9);
  doc.text(formatCurrency(allocation.paid_amount), pageWidth - 14, finalY + 9, { align: 'right' });

  // Outstanding Dues Box
  finalY += 13;
  doc.setFillColor(248, 250, 252); // Very light grey
  doc.rect(calcX - 3, finalY - 3, 54, 8, 'F');
  
  if (outstanding > 0) {
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFont('helvetica', 'bold');
  } else {
    doc.setTextColor(16, 185, 129); // green
    doc.setFont('helvetica', 'bold');
  }
  doc.text('Balance Due:', calcX, finalY + 2.5);
  doc.text(formatCurrency(outstanding), pageWidth - 14, finalY + 2.5, { align: 'right' });

  // ── 6. Bottom Signatory Section & Stamp ──
  finalY += 28;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Stamp Outline
  doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(14, finalY - 4, 32, 16);
  doc.setFontSize(7);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('EDUOS ACCOUNTS', 17, finalY + 2);
  doc.setFont('helvetica', 'bold');
  doc.text('DIGITAL STAMP', 18, finalY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('Verified online', 21, finalY + 10.5);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(8.5);
  doc.text('For EduOS Engineering College', pageWidth - 14, finalY, { align: 'right' });
  doc.line(pageWidth - 65, finalY + 12, pageWidth - 14, finalY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('Authorised Signatory (Accounts Department)', pageWidth - 14, finalY + 15.5, { align: 'right' });

  // Footer compliance note
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  const footerY = pageHeight - 12;
  doc.line(14, footerY, pageWidth - 14, footerY);
  doc.setFontSize(7);
  doc.text('This is a computer-generated invoice statement under Section 65B of the Indian Evidence Act, 1872.', pageWidth / 2, footerY + 4, { align: 'center' });
  doc.text('No physical signature or rubber seal is legally required.', pageWidth / 2, footerY + 7.5, { align: 'center' });

  // Save the PDF
  doc.save(`${invoiceNo.replace(/\//g, '_')}.pdf`);
};

export const generateReceiptPDF = (student: any, payment: any, allocation: any) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height; // A4 = 297mm
  
  // ── 1. Color Palette (Teal / Emerald Green for Receipt Success) ──
  const primaryColor = [6, 78, 59]; // #064e3b (Emerald 900)
  const secondaryColor = [30, 41, 59]; // #1e293b (Slate 800)
  const mutedColor = [100, 116, 139]; // #64748b (Slate 500)
  const borderLight = [226, 232, 240];

  // ── 2. Header Block ──
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EDUOS ENGINEERING COLLEGE', 14, 11);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Campus Road, Tech Zone, Bangalore, KA - 560001 | finance@eduos.org', 14, 16);
  doc.text('PAN: AABCE1234F | GSTIN: 29AABCE1234F1Z5', 14, 21);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FEE PAYMENT RECEIPT', pageWidth - 14, 13, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Receipt for Student Records', pageWidth - 14, 19, { align: 'right' });

  // ── 3. Billing & Student Details grid ──
  let currentY = 36;
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  // Left Column: Received From
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RECEIVED FROM (STUDENT):', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  
  const name = `${student.person.first_name} ${student.person.last_name || ''}`.trim();
  doc.setFont('helvetica', 'bold');
  doc.text(name, 14, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const enrollmentNo2 = student.enrollment_number ?? 'N/A';
  doc.text(`Roll No: ${enrollmentNo2}`, 14, currentY + 10);
  doc.text(`Program: B.Tech (Computer Science & Eng.)`, 14, currentY + 14.5);
  doc.text(`Category: ${student.category || 'General'} | Quota: ${student.quota || 'Merit'}`, 14, currentY + 19);

  // Right Column: Receipt Metadata
  const receiptNo = `REC/2026/${payment.receipt_number || payment.payment_id.substring(0, 8).toUpperCase()}`;
  const enrollmentSlug2 = (student.enrollment_number ?? 'UNKNOWN').replace(/\s+/g, '');
  const invoiceNo = `INV/2026/SEM-${allocation.semester}/${enrollmentSlug2}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RECEIPT DETAILS:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Receipt No:   ${receiptNo}`, pageWidth / 2 + 10, currentY + 5.5);
  doc.text(`Payment Date: ${formatDate(payment.payment_date || payment.created_at)}`, pageWidth / 2 + 10, currentY + 10);
  doc.text(`Reference Inv: ${invoiceNo}`, pageWidth / 2 + 10, currentY + 14.5);
  
  // Success tag background
  doc.setFillColor(16, 185, 129); // green
  doc.rect(pageWidth / 2 + 10, currentY + 17, 30, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SUCCESS / PAID', pageWidth / 2 + 25, currentY + 20.5, { align: 'center' });

  // ── 4. Main Particulars Table ──
  currentY = 66;
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  autoTable(doc, {
    startY: currentY,
    head: [['Particulars', 'Transaction ID', 'Mode', 'Gateway', 'Amount Paid']],
    body: [
      [
        `Tuition Fee Payment (Semester ${allocation.semester})`,
        payment.transaction_id || 'N/A',
        payment.payment_mode,
        payment.payment_gateway || 'Internal',
        formatCurrency(payment.amount)
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor as any,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: secondaryColor as any,
      cellPadding: 6,
    },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 45, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 27, halign: 'right' },
    },
    margin: { left: 14, right: 14 }
  });

  // ── 5. Summary & Remaining Dues ──
  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // Draw separator line
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.line(14, finalY, pageWidth - 14, finalY);
  finalY += 6;

  // Left Section: Notes
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Notes & Declarations:', 14, finalY);
  doc.text('1. Fees once allocated are strictly non-refundable and subject to college guidelines.', 14, finalY + 4);
  doc.text('2. Payments are reconciled electronically in ledger balance journals.', 14, finalY + 7.5);

  // Right Section: Billing Summary
  const calcX = pageWidth - 65;
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(8.5);

  doc.text('Total Invoice Bill:', calcX, finalY);
  doc.text(formatCurrency(allocation.total_amount), pageWidth - 14, finalY, { align: 'right' });

  doc.text('Total Paid to Date:', calcX, finalY + 4.5);
  doc.text(formatCurrency(allocation.paid_amount), pageWidth - 14, finalY + 4.5, { align: 'right' });

  // Outstanding Dues Box
  finalY += 8.5;
  const outstanding = parseFloat(allocation.total_amount) - parseFloat(allocation.paid_amount);
  doc.setFillColor(248, 250, 252);
  doc.rect(calcX - 3, finalY - 3, 54, 8, 'F');
  
  if (outstanding > 0) {
    doc.setTextColor(220, 38, 38); // red
  } else {
    doc.setTextColor(16, 185, 129); // green
  }
  doc.setFont('helvetica', 'bold');
  doc.text('Remaining Balance:', calcX, finalY + 2.5);
  doc.text(formatCurrency(outstanding), pageWidth - 14, finalY + 2.5, { align: 'right' });

  // ── 6. Bottom Signatory Section & Stamp ──
  finalY += 28;
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Stamp Outline (Green/Teal theme)
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(14, finalY - 4, 32, 16);
  doc.setFontSize(7);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('EDUOS ACCOUNTS', 17, finalY + 2);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID / RECEIPT', 18, finalY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('Verified online', 21, finalY + 10.5);

  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(8.5);
  doc.text('For EduOS Engineering College', pageWidth - 14, finalY, { align: 'right' });
  doc.line(pageWidth - 65, finalY + 12, pageWidth - 14, finalY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('Authorised Signatory (Accounts Department)', pageWidth - 14, finalY + 15.5, { align: 'right' });

  // Footer compliance note
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  const footerY2 = pageHeight - 12;
  doc.line(14, footerY2, pageWidth - 14, footerY2);
  doc.setFontSize(7);
  doc.text('This is a computer-generated transaction receipt under Section 65B of the Indian Evidence Act, 1872.', pageWidth / 2, footerY2 + 4, { align: 'center' });
  doc.text('No physical signature or rubber seal is legally required.', pageWidth / 2, footerY2 + 7.5, { align: 'center' });

  // Save the PDF
  doc.save(`${receiptNo.replace(/\//g, '_')}.pdf`);
};

// Helper to determine Grade and Point from Marks Percentage
const getGradeDetails = (obtainedStr: string | number, max: number) => {
  const obtained = typeof obtainedStr === 'string' ? parseFloat(obtainedStr) : obtainedStr;
  const pct = (obtained / max) * 100;
  if (pct >= 90) return { grade: 'O', point: 10, description: 'Outstanding' };
  if (pct >= 80) return { grade: 'A+', point: 9, description: 'Excellent' };
  if (pct >= 70) return { grade: 'A', point: 8, description: 'Very Good' };
  if (pct >= 60) return { grade: 'B+', point: 7, description: 'Good' };
  if (pct >= 50) return { grade: 'B', point: 6, description: 'Above Average' };
  if (pct >= 40) return { grade: 'C', point: 5, description: 'Pass' };
  return { grade: 'F', point: 0, description: 'Fail' };
};

export const generateSemesterGradeCardPDF = (student: any, semester: number, marks: any[], resultRecord: any) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const primaryColor = [30, 41, 59]; // Slate 800
  const secondaryColor = [71, 85, 105]; // Slate 600
  const borderLight = [226, 232, 240];

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EDUOS ENGINEERING COLLEGE', 14, 11);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Campus Road, Tech Zone, Bangalore, KA - 560001 | examinations@eduos.org', 14, 16);
  doc.text('Affiliated to Technological University | ISO 9001:2015 Certified', 14, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SEMESTER GRADE SHEET', pageWidth - 14, 13, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Academic Record`, pageWidth - 14, 19, { align: 'right' });

  // Student Details
  let currentY = 36;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('STUDENT INFORMATION:', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const name = `${student.person.first_name} ${student.person.last_name || ''}`.trim();
  doc.setFont('helvetica', 'bold');
  doc.text(name, 14, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Roll No: ${student.enrollment_number || 'N/A'}`, 14, currentY + 9.5);
  doc.text(`Program: B.Tech (Computer Science & Engineering)`, 14, currentY + 14);

  // Exam Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ACADEMIC SHEET DETAILS:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Semester:     Semester ${semester}`, pageWidth / 2 + 10, currentY + 5);
  doc.text(`Academic Year: ${resultRecord?.academic_year || 2026}`, pageWidth / 2 + 10, currentY + 9.5);
  doc.text(`Date of Issue: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth / 2 + 10, currentY + 14);

  // Table of Course Marks
  currentY = 58;
  const semMarks = marks.filter(m => m.semester === semester);
  const tableBody = semMarks.map((m, idx) => {
    const marksVal = m.revaluation_status === 'Approved' ? (m.revaluation_marks || m.obtained_marks) : m.obtained_marks;
    const gradeDetails = getGradeDetails(marksVal, m.max_marks);
    const credits = parseFloat(m.credits || '4');
    const creditPoints = credits * gradeDetails.point;

    return [
      (idx + 1).toString(),
      m.course_code,
      m.course_name,
      m.exam_type,
      credits.toFixed(1),
      `${parseFloat(marksVal).toFixed(0)} / ${m.max_marks}`,
      gradeDetails.grade,
      gradeDetails.point.toString(),
      creditPoints.toFixed(1)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Sl No.', 'Course Code', 'Course Title', 'Exam Type', 'Credits', 'Obtained Marks', 'Grade', 'Grade Point', 'Credit Point']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor as any,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: primaryColor as any,
      cellPadding: 4.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22, halign: 'left' },
      2: { cellWidth: 55 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 18, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // Draw separator line
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.line(14, finalY, pageWidth - 14, finalY);
  finalY += 6;

  // Grade Legend
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Grading System Legend:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('O: Outstanding (10)  |  A+: Excellent (9)  |  A: Very Good (8)  |  B+: Good (7)  |  B: Above Average (6)  |  C: Pass (5)  |  F: Fail (0)', 14, finalY + 4);
  doc.text('SGPA = Sum(Credit * Grade Point) / Sum(Credits) for the current semester.', 14, finalY + 8);

  // Performance Scorebox
  const calcX = pageWidth - 65;
  doc.setFillColor(248, 250, 252);
  doc.rect(calcX - 3, finalY - 2, 54, 18, 'F');

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Semester Result:', calcX, finalY + 2.5);
  doc.setFont('helvetica', 'bold');
  const status = resultRecord?.status || 'Pass';
  if (status === 'Pass') {
    doc.setTextColor(16, 185, 129); // green
  } else {
    doc.setTextColor(220, 38, 38); // red
  }
  doc.text(status.toUpperCase(), pageWidth - 14, finalY + 2.5, { align: 'right' });

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Semester SGPA:', calcX, finalY + 8);
  doc.setFont('helvetica', 'bold');
  doc.text(resultRecord?.sgpa || 'N/A', pageWidth - 14, finalY + 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Cumulative CGPA:', calcX, finalY + 13.5);
  doc.setFont('helvetica', 'bold');
  doc.text(resultRecord?.cgpa || 'N/A', pageWidth - 14, finalY + 13.5, { align: 'right' });

  // Signatory & Stamp
  finalY += 32;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(14, finalY - 4, 32, 16);
  doc.setFontSize(7);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('EDUOS EXAMS', 18, finalY + 2);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL RECORD', 16, finalY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('Verified online', 21, finalY + 11.5);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(8.5);
  doc.text('For EduOS Examination Branch', pageWidth - 14, finalY, { align: 'right' });
  doc.line(pageWidth - 65, finalY + 12, pageWidth - 14, finalY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('Controller of Examinations (Registrar Office)', pageWidth - 14, finalY + 15.5, { align: 'right' });

  // Footer compliance note
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  const footerY = pageHeight - 12;
  doc.line(14, footerY, pageWidth - 14, footerY);
  doc.setFontSize(7);
  doc.text('This is an official computer-generated Semester Grade Report issued by EduOS Engineering College.', pageWidth / 2, footerY + 4, { align: 'center' });
  doc.text('Any alteration/erasure makes this document completely invalid. Secure online verification active.', pageWidth / 2, footerY + 7.5, { align: 'center' });

  // Save the PDF
  const filename = `GradeCard_Sem${semester}_${(student.enrollment_number || 'UNKNOWN').replace(/\s+/g, '')}.pdf`;
  doc.save(filename);
};

export const generateTranscriptPDF = (student: any, marks: any[], results: any[]) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const primaryColor = [30, 41, 59]; // Slate 800
  const secondaryColor = [71, 85, 105]; // Slate 600
  const borderLight = [226, 232, 240];

  // Title block on every page logic or just first page header
  const renderHeader = () => {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('EDUOS ENGINEERING COLLEGE', 14, 11);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Campus Road, Tech Zone, Bangalore, KA - 560001 | registrar@eduos.org', 14, 16);
    doc.text('Affiliated to Technological University | ISO 9001:2015 Certified', 14, 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('OFFICIAL ACADEMIC TRANSCRIPT', pageWidth - 14, 13, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cumulative Coursework Record`, pageWidth - 14, 19, { align: 'right' });
  };

  renderHeader();

  // Student details
  let currentY = 36;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('STUDENT CUMULATIVE DOSSIER:', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const name = `${student.person.first_name} ${student.person.last_name || ''}`.trim();
  doc.setFont('helvetica', 'bold');
  doc.text(name, 14, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Enrollment Roll No: ${student.enrollment_number || 'N/A'}`, 14, currentY + 9.5);
  doc.text(`Program & Major:   B.Tech (Computer Science & Engineering)`, 14, currentY + 14);

  // Transcript Metadata
  const hash = Math.random().toString(36).substring(2, 10).toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TRANSCRIPT METADATA:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Document Reference: OTS/2026/CS-${hash}`, pageWidth / 2 + 10, currentY + 5);
  doc.text(`Overall cgpa:       ${results[0]?.cgpa || student.cgpa || 'N/A'}`, pageWidth / 2 + 10, currentY + 9.5);
  doc.text(`Verification Code:  ${hash}`, pageWidth / 2 + 10, currentY + 14);

  currentY = 58;

  // Group marks by semester
  const semesters = Array.from(new Set(marks.map(m => m.semester))).sort((a, b) => a - b);
  
  semesters.forEach((sem) => {
    const semMarks = marks.filter(m => m.semester === sem);
    const resultRecord = results.find(r => r.semester === sem);

    // If starting a new page (e.g. index > 0 and position is low)
    if (currentY > pageHeight - 75) {
      doc.addPage();
      renderHeader();
      currentY = 36;
    }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`ACADEMIC TERM: SEMESTER ${sem}`, 14, currentY);
    currentY += 3;

    const tableBody = semMarks.map((m, idx) => {
      const marksVal = m.revaluation_status === 'Approved' ? (m.revaluation_marks || m.obtained_marks) : m.obtained_marks;
      const gradeDetails = getGradeDetails(marksVal, m.max_marks);
      const credits = parseFloat(m.credits || '4');
      return [
        (idx + 1).toString(),
        m.course_code,
        m.course_name,
        credits.toFixed(1),
        gradeDetails.grade,
        gradeDetails.point.toString()
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Sl No.', 'Course Code', 'Course Title', 'Credits', 'Grade', 'Grade Point']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: secondaryColor as any,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: primaryColor as any,
        cellPadding: 3.5,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25, halign: 'left' },
        2: { cellWidth: 90 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Semester SGPA: ${resultRecord?.sgpa || 'N/A'}    |    Status: ${resultRecord?.status || 'Pass'}`, 14, currentY);
    currentY += 8;
  });

  // Check if summary and signoff fit on the page
  if (currentY > pageHeight - 65) {
    doc.addPage();
    renderHeader();
    currentY = 36;
  }

  // Summary box
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 5;

  doc.setFillColor(248, 250, 252);
  doc.rect(14, currentY, pageWidth - 28, 12, 'F');
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CUMULATIVE PERFORMANCE SUMMARY', 18, currentY + 7.5);

  const finalCGPA = results[0]?.cgpa || student.cgpa || 'N/A';
  let division = 'Second Class';
  if (parseFloat(finalCGPA) >= 8.5) division = 'First Class with Distinction';
  else if (parseFloat(finalCGPA) >= 6.5) division = 'First Class';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Final CGPA: ${finalCGPA}   |   Division Awarded: ${division}`, pageWidth - 18, currentY + 7.5, { align: 'right' });
  currentY += 22;

  // Signatures
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(14, currentY - 4, 32, 16);
  doc.setFontSize(7);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('EDUOS REGISTRAR', 16, currentY + 2);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL SEAL', 18, currentY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('Verified online', 21, currentY + 11.5);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(8.5);
  doc.text('For EduOS Institute of Technology', pageWidth - 14, currentY, { align: 'right' });
  doc.line(pageWidth - 65, currentY + 12, pageWidth - 14, currentY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('Registrar & Controller of Examinations', pageWidth - 14, currentY + 15.5, { align: 'right' });

  // Footer compliance note
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  const footerY = pageHeight - 12;
  doc.line(14, footerY, pageWidth - 14, footerY);
  doc.setFontSize(7);
  doc.text('This is an official computer-generated Transcript Dossier issued by EduOS Engineering College under Section 65B of the Indian Evidence Act, 1872.', pageWidth / 2, footerY + 4, { align: 'center' });
  doc.text('No physical signature is legally required. Secure online verification active.', pageWidth / 2, footerY + 7.5, { align: 'center' });

  // Save the PDF
  const filename = `Transcript_${(student.enrollment_number || 'UNKNOWN').replace(/\s+/g, '')}.pdf`;
  doc.save(filename);
};

export const generateAttendanceWarningPDF = (student: any, course: any, summary: any) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const primaryColor = [30, 41, 59]; // Slate 800
  const secondaryColor = [71, 85, 105]; // Slate 600
  const accentColor = [220, 38, 38]; // Red 600
  const borderLight = [226, 232, 240];

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EDUOS ENGINEERING COLLEGE', 14, 11);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Campus Road, Tech Zone, Bangalore, KA - 560001 | registrar@eduos.org', 14, 16);
  doc.text('Affiliated to Technological University | ISO 9001:2015 Certified', 14, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('OFFICIAL WARNING NOTICE', pageWidth - 14, 13, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Shortage of Attendance', pageWidth - 14, 18, { align: 'right' });
  doc.text('Ref: EduOS/COE/2026/ATT-WARN', pageWidth - 14, 23, { align: 'right' });

  // Document body details
  let currentY = 38;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('To the Parent / Guardian of:', 14, currentY);
  
  doc.setFont('helvetica', 'bold');
  const name = `${student.person.first_name} ${student.person.last_name || ''}`.trim();
  doc.text(name, 14, currentY + 5.5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Roll No / Enrollment No: ${student.enrollment_number || 'N/A'}`, 14, currentY + 10.5);
  doc.text(`Program: B.Tech (Computer Science & Engineering)`, 14, currentY + 15);
  
  // Date of Issue
  doc.setFont('helvetica', 'bold');
  doc.text('Date of Issue:', pageWidth - 65, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), pageWidth - 14, currentY, { align: 'right' });

  currentY = 62;
  
  // Subject Block
  doc.setFillColor(254, 242, 242); // very light red
  doc.setDrawColor(252, 165, 165); // light red border
  doc.setLineWidth(0.3);
  doc.rect(14, currentY, pageWidth - 28, 14, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('SUBJECT: NOTICE OF ATTENDANCE SHORTAGE AND ELIGIBILITY WARNING', 18, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('Action required: Counselor meetings must be completed to avoid exam detainment.', 18, currentY + 9.5);

  currentY = 84;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  doc.text('Dear Parent/Guardian,', 14, currentY);
  
  const textBody = [
    `This is to officially inform you that your ward, ${name}, has failed to maintain the mandatory 75% attendance threshold prescribed by the Technological University for the current academic session.`,
    `As of today, the student's attendance records in the subject listed below are critically low. Please review the specific subject shortage report below:`
  ];

  doc.text(textBody[0], 14, currentY + 6, { maxWidth: pageWidth - 28 });
  doc.text(textBody[1], 14, currentY + 18, { maxWidth: pageWidth - 28 });

  currentY = 110;

  // Table
  const tableBody = [
    [
      course.course_code,
      course.course_name,
      summary.total_classes.toString(),
      summary.present_count.toString(),
      `${summary.percentage.toFixed(1)}%`,
      '75.0%',
      'AT DETENTION RISK'
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Course Code', 'Course Title', 'Conducted', 'Attended', 'Attendance %', 'Required %', 'Status']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: accentColor as any,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: primaryColor as any,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 62 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 28, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Consequences section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REGULATORY CONSEQUENCES & ACTION PLAN:', 14, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  const rules = [
    "1. University Regulation Section 12-A states that students with less than 75% attendance are strictly barred from participating in Semester End Examinations.",
    "2. If the attendance shortage is not regularized immediately, the student will be Detained and must repeat the term in the next academic year.",
    "3. You are requested to contact the Head of the Department (HOD) or Academic Counselor within 3 working days of receiving this notice to schedule a review.",
  ];

  doc.text(rules[0], 14, currentY + 5.5, { maxWidth: pageWidth - 28 });
  doc.text(rules[1], 14, currentY + 11.5, { maxWidth: pageWidth - 28 });
  doc.text(rules[2], 14, currentY + 17.5, { maxWidth: pageWidth - 28 });

  currentY += 32;

  // Signatures
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  doc.line(14, currentY + 12, 60, currentY + 12);
  doc.text('Head of Department (CSE)', 14, currentY + 16);

  doc.line(pageWidth - 60, currentY + 12, pageWidth - 14, currentY + 12);
  doc.text('Controller of Examinations / Registrar', pageWidth - 14, currentY + 16, { align: 'right' });

  // Footer compliance note
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  const footerY2 = pageHeight - 12;
  doc.line(14, footerY2, pageWidth - 14, footerY2);
  doc.setFontSize(7);
  doc.text('This is an official warning letter issued by the Academic Branch of EduOS Institute of Technology.', pageWidth / 2, footerY2 + 4, { align: 'center' });
  doc.text('Verification code: ATT-WARN-2026. Electronic records active.', pageWidth / 2, footerY2 + 7.5, { align: 'center' });

  // Save the PDF
  const filenameVal = `AttendanceWarning_${(student.enrollment_number || 'UNKNOWN').replace(/\s+/g, '')}.pdf`;
  doc.save(filenameVal);
};

