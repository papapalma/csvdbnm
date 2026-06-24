import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface TraineeData {
  id: number;
  name: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  sex?: string;
  birthdate?: string;
  birthplace?: string;
  civilStatus?: string;
  province?: string;
  municipality?: string;
  barangay?: string;
  street?: string;
  contactNumber?: string;
  email?: string;
  educationalAttainment?: string;
  course?: string;
  yearGraduated?: string;
  program: string;
  classification?: string;
  disability?: string;
  employmentStatus?: string;
  entryDate?: string;
}

export function generateTraineePDF(trainee: TraineeData) {
  const pdf = new jsPDF('p', 'mm', 'letter');
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // Helper function to draw checkbox
  const drawCheckbox = (x: number, y: number, checked: boolean = false) => {
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, 3, 3);
    if (checked) {
      pdf.setFont('helvetica', 'normal');
      pdf.text('✓', x + 0.5, y + 2.3);
    }
  };

  // Helper function to draw text in a box
  const drawBox = (x: number, y: number, width: number, height: number, text: string = '') => {
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, width, height);
    if (text) {
      pdf.setFontSize(9);
      pdf.text(text, x + 1, y + height - 2);
    }
  };

  // ============ PAGE 1 ============
  
  // Header
  pdf.setFillColor(255, 255, 255);
  pdf.rect(15, 10, pageWidth - 30, 20, 'F');
  pdf.setLineWidth(0.5);
  pdf.rect(15, 10, pageWidth - 30, 20);
  
  // Logo placeholder (left)
  pdf.setLineWidth(0.3);
  pdf.rect(20, 12, 15, 15);
  pdf.setFontSize(8);
  pdf.text('TESDA', 23, 20);
  pdf.text('LOGO', 23.5, 23);
  
  // Title
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const titleText1 = 'Technical Education and Skills Development Authority';
  const titleText2 = 'Pagkakaroon ng Kasanayan Tungo sa Pagsusulong ng Kaunlaran';
  pdf.text(titleText1, pageWidth / 2, 16, { align: 'center' });
  pdf.text(titleText2, pageWidth / 2, 20, { align: 'center' });
  
  // Form reference
  pdf.setFontSize(7);
  pdf.text('BMDC 01 - 01', pageWidth - 30, 15);
  pdf.text('Rev. 2020', pageWidth - 30, 18);
  
  // Main Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Registration Form', pageWidth / 2, 38, { align: 'center' });
  
  // Subtitle
  pdf.setFontSize(11);
  pdf.text('LEARNERS PROFILE FORM', pageWidth / 2, 46, { align: 'center' });
  
  // Photo box
  pdf.setLineWidth(0.3);
  pdf.rect(pageWidth - 40, 42, 25, 30);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('1x1 Photo', pageWidth - 32, 58, { align: 'center' });
  
  let yPos = 55;
  
  // Section 1: TMIS Auto Generated
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('1. TMIS Auto Generated', 15, yPos);
  yPos += 5;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('1.1 Unique Learner Identifier', 20, yPos);
  pdf.text('1.2 Entry Date:', pageWidth - 60, yPos);
  
  // ULI boxes
  const uliBoxes = 15;
  let xPos = 60;
  for (let i = 0; i < uliBoxes; i++) {
    drawBox(xPos, yPos - 3, 4, 5);
    xPos += 4.5;
  }
  
  // Entry date
  const entryDate = trainee.entryDate || new Date().toLocaleDateString('en-PH');
  pdf.text(entryDate, pageWidth - 40, yPos);
  
  yPos += 10;
  
  // Section 2: Learner/Manpower Profile
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('2. Learner/Manpower Profile', 15, yPos);
  yPos += 5;
  
  // Name section
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('2.1 Name:', 20, yPos);
  yPos += 5;
  
  // Split name into parts
  const nameParts = trainee.name.split(' ');
  const lastName = trainee.lastName || nameParts[nameParts.length - 1] || '';
  const firstName = trainee.firstName || nameParts[0] || '';
  const middleName = trainee.middleName || (nameParts.length > 2 ? nameParts[1] : '');
  
  // Name boxes
  drawBox(20, yPos - 3, 60, 6, lastName);
  pdf.setFontSize(7);
  pdf.text('Last Name, Extension Name (Jr., Sr.)', 22, yPos + 5);
  
  drawBox(82, yPos - 3, 60, 6, firstName);
  pdf.text('First', 84, yPos + 5);
  
  drawBox(144, yPos - 3, 35, 6, middleName);
  pdf.text('Middle', 146, yPos + 5);
  
  yPos += 13;
  
  // Address section
  pdf.setFontSize(8);
  pdf.text('2.2 Complete', 20, yPos);
  pdf.text('     Permanent Mailing', 20, yPos + 3);
  pdf.text('     Address:', 20, yPos + 6);
  
  // Address fields
  drawBox(55, yPos - 3, 45, 6, trainee.street || '');
  pdf.setFontSize(7);
  pdf.text('Number, Street', 57, yPos + 5);
  
  drawBox(102, yPos - 3, 40, 6, trainee.barangay || '');
  pdf.text('Barangay', 104, yPos + 5);
  
  drawBox(144, yPos - 3, 35, 6, '');
  pdf.text('District', 146, yPos + 5);
  
  yPos += 10;
  
  drawBox(55, yPos - 3, 45, 6, trainee.municipality || '');
  pdf.setFontSize(7);
  pdf.text('City/Municipality', 57, yPos + 5);
  
  drawBox(102, yPos - 3, 40, 6, trainee.province || 'Oriental Mindoro');
  pdf.text('Province', 104, yPos + 5);
  
  drawBox(144, yPos - 3, 35, 6, 'Philippines');
  pdf.text('Region', 146, yPos + 5);
  
  yPos += 10;
  
  drawBox(55, yPos - 3, 55, 6, trainee.email || '');
  pdf.setFontSize(7);
  pdf.text('Email Address/Facebook Account', 57, yPos + 5);
  
  drawBox(112, yPos - 3, 67, 6, trainee.contactNumber || trainee.email || '');
  pdf.text('Contact No.', 114, yPos + 5);
  
  yPos += 13;
  
  // Section 3: Personal Information
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('3. Personal Information', 15, yPos);
  yPos += 5;
  
  // Sex and other fields
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('3.1 Sex', 20, yPos);
  
  drawCheckbox(35, yPos - 3, trainee.sex?.toLowerCase() === 'male');
  pdf.text('Male', 40, yPos);
  
  drawCheckbox(35, yPos + 2, trainee.sex?.toLowerCase() === 'female');
  pdf.text('Female', 40, yPos + 5);
  
  // Civil Status
  pdf.text('3.2 Civil Status', 80, yPos);
  const civilStatuses = ['Single', 'Married', 'Widow/er', 'Separated', 'Solo Parent'];
  civilStatuses.forEach((status, index) => {
    const yOffset = index * 3;
    drawCheckbox(115, yPos - 3 + yOffset, trainee.civilStatus === status);
    pdf.text(status, 120, yPos + yOffset);
  });
  
  // Employment Status
  pdf.text('3.3 Employment Status (Before the training)', 140, yPos);
  const empStatuses = ['Employed', 'Unemployed'];
  empStatuses.forEach((status, index) => {
    drawCheckbox(140, yPos + 2 + (index * 3), trainee.employmentStatus === status);
    pdf.text(status, 145, yPos + 5 + (index * 3));
  });
  
  yPos += 20;
  
  // Birthdate
  pdf.text('3.4 Birthdate', 20, yPos);
  
  drawBox(50, yPos - 3, 35, 6, trainee.birthdate ? new Date(trainee.birthdate).toLocaleDateString() : '');
  pdf.setFontSize(7);
  pdf.text('Month of Birth', 52, yPos + 5);
  
  drawBox(87, yPos - 3, 35, 6);
  pdf.text('Day of Birth', 89, yPos + 5);
  
  drawBox(124, yPos - 3, 35, 6);
  pdf.text('Year of Birth', 126, yPos + 5);
  
  drawBox(161, yPos - 3, 18, 6);
  pdf.text('Age', 163, yPos + 5);
  
  yPos += 10;
  
  // Birthplace
  pdf.setFontSize(8);
  pdf.text('3.5 Birthplace', 20, yPos);
  
  drawBox(50, yPos - 3, 55, 6, trainee.birthplace || '');
  pdf.setFontSize(7);
  pdf.text('City/Municipality', 52, yPos + 5);
  
  drawBox(107, yPos - 3, 40, 6, trainee.province || 'Oriental Mindoro');
  pdf.text('Province', 109, yPos + 5);
  
  drawBox(149, yPos - 3, 30, 6, 'Philippines');
  pdf.text('Region', 151, yPos + 5);
  
  yPos += 13;
  
  // Section 3.6: Educational Attainment
  pdf.setFontSize(8);
  pdf.text('3.6 Educational Attainment Before the Training (Trainee)', 20, yPos);
  yPos += 5;
  
  const eduLevels = [
    ['No Grade Completed', 'Pre-School (Nursery/Kinder/Prep)', 'High School Undergraduate', 'High School Graduate'],
    ['Elementary Undergraduate', 'Post Secondary Undergraduate', 'College Undergraduate', 'College Graduate or Higher'],
    ['Elementary Graduate', 'Post Secondary Graduate', 'Junior High Graduate', 'Senior High Graduate']
  ];
  
  eduLevels.forEach((row) => {
    row.forEach((level, colIndex) => {
      const xPosition = 20 + (colIndex * 45);
      drawCheckbox(xPosition, yPos, trainee.educationalAttainment === level);
      pdf.setFontSize(7);
      pdf.text(level, xPosition + 5, yPos + 2);
    });
    yPos += 5;
  });
  
  yPos += 3;
  
  // Parent/Guardian
  pdf.setFontSize(8);
  pdf.text('3.7 Parent/Guardian', 20, yPos);
  
  drawBox(55, yPos - 3, 65, 6);
  pdf.setFontSize(7);
  pdf.text('Name', 57, yPos + 5);
  
  drawBox(122, yPos - 3, 57, 6);
  pdf.text('Complete Permanent Mailing Address', 124, yPos + 5);
  
  // ============ PAGE 2 ============
  pdf.addPage();
  yPos = 15;
  
  // Section 4: Classification
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('4. Learner/Trainee/Student (Clients) Classification:', 15, yPos);
  yPos += 5;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  
  const classifications = [
    ['4Ps Beneficiary', 'Agribusiness Reform Beneficiary', 'Trade Practitioner'],
    ['Displaced Workers', 'Drug Dependent', 'Family Members of AFP and PNP Killed-in-Action'],
    ['Family Members of AFP and PNP and Injured-in-Action', 'Farmers and Fishermen', 'Indigenous Peoples & Cultural Communities'],
    ['MILF Beneficiary', 'Inmates and Detainees', 'TESDA Alumni'],
    ['Out-of-School Youth', 'Domestic Filipino Workers (OFW)', 'BLGF Beneficiary'],
    ['TESDA Alumni', 'Victim of Natural Disasters and Calamities', 'Uniformed Personnel'],
    ['Persons with Disability', 'PWD-T Trainee', 'Informal Workers (as applicable)'],
    ['Solo Parents', 'Rebel Returnees/Decommissioned Combatants', 'RCEF-RESP'],
    ['', 'Victims and Children in Conflict with the Law', 'Others (PWDS, STEP, others?)']
  ];
  
  const classColWidth = 63;
  classifications.forEach((row, rowIndex) => {
    const yOffset = Math.floor(rowIndex / 3) * 4;
    const xCol = (rowIndex % 3);
    row.forEach((item, index) => {
      if (item) {
        const xPosition = 15 + (xCol * classColWidth);
        const itemYPos = yPos + (index * 4) + yOffset;
        drawCheckbox(xPosition, itemYPos, trainee.classification === item);
        pdf.text(item, xPosition + 5, itemYPos + 2);
      }
    });
  });
  
  yPos += 48;
  
  // Section 5: Type of Disability
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('5. Type of Disability (for Persons with Disability Only): To be filled up by the TESDA personnel', 15, yPos);
  yPos += 5;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  
  const disabilities = [
    ['Mental/Intellectual', 'Visual Disability', 'Orthopedic (Musculoskeletal) Disability'],
    ['Hearing Disability', 'Speech Impairment', 'Multiple Disabilities (specify)'],
    ['Psychosocial Disability', 'Learning Disabilities', ''],
    ['Mental Illness', 'Chronic Illness (e.g., Cancer, Renal, Illness)', '']
  ];
  
  disabilities.forEach((row, rowIndex) => {
    row.forEach((item, colIndex) => {
      if (item) {
        const xPosition = 15 + (colIndex * 63);
        const itemYPos = yPos + (rowIndex * 4);
        drawCheckbox(xPosition, itemYPos);
        pdf.text(item, xPosition + 5, itemYPos + 2);
      }
    });
  });
  
  yPos += 20;
  
  // Section 6: Causes of Disability
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('6. Causes of Disability (for Persons with Disability Only): To be filled up by the TESDA personnel', 15, yPos);
  yPos += 5;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  
  const causes = ['Congenital/Inborn', 'Illness', 'Injury'];
  causes.forEach((cause, index) => {
    const xPosition = 15 + (index * 60);
    drawCheckbox(xPosition, yPos);
    pdf.text(cause, xPosition + 5, yPos + 2);
  });
  
  yPos += 8;
  
  // Section 7: Name of Course/Qualification
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('7. Name of Course/Qualification', 15, yPos);
  yPos += 5;
  
  drawBox(15, yPos - 3, pageWidth - 30, 6, trainee.program || '');
  yPos += 10;
  
  // Section 8: Scholarship
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('8. If Scholar, What Type of Scholarship Package (TWSP, PESFA, STEP, others)?', 15, yPos);
  yPos += 5;
  
  drawBox(15, yPos - 3, pageWidth - 30, 6);
  yPos += 10;
  
  // Section 9: Privacy Disclaimer
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('9. Privacy Disclaimer', 15, yPos);
  yPos += 5;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const privacyText = 'I hereby allow TESDA to collect and record my contact details, name, email, address/location and other information I provided for the purpose of my scholarship application, enrollment record/data keeping and for the training of TESDA programs.';
  const splitText = pdf.splitTextToSize(privacyText, pageWidth - 30);
  pdf.text(splitText, 15, yPos);
  
  yPos += 15;
  
  const agreeOptions = ['Agree', 'Disagree'];
  agreeOptions.forEach((option, index) => {
    const xPosition = 15 + (index * 40);
    drawCheckbox(xPosition, yPos);
    pdf.text(option, xPosition + 5, yPos + 2);
  });
  
  yPos += 10;
  
  // Section 10: Applicant's Signature
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text("10. Applicant's Signature", 15, yPos);
  yPos += 5;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('(This is to certify that the information stated above is true and correct)', 15, yPos);
  yPos += 5;
  
  // Signature boxes
  drawBox(15, yPos, 80, 30);
  pdf.text("APPLICANT'S SIGNATURE OVER PRINTED NAME", 20, yPos + 35);
  
  drawBox(100, yPos, 40, 30);
  pdf.text('DATE ACCOMPLISHED', 105, yPos + 35);
  
  drawBox(145, yPos, 35, 30);
  pdf.setFontSize(6);
  pdf.text('1x1 photo taken', 148, yPos + 12, { align: 'left' });
  pdf.text('within the last 6', 148, yPos + 16, { align: 'left' });
  pdf.text('months', 148, yPos + 20, { align: 'left' });
  
  yPos += 40;
  
  // Noted by section
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('Noted by:', 15, yPos);
  yPos += 5;
  
  drawBox(15, yPos, 80, 20);
  pdf.text('REGISTRAR/SCHOOL ADMINISTRATOR', 20, yPos + 25);
  pdf.text('(Signature Over Printed Name)', 20, yPos + 29);
  
  drawBox(100, yPos, 40, 20);
  pdf.text('DATE RECEIVED', 105, yPos + 25);
  
  drawBox(145, yPos, 35, 20);
  pdf.text('Right Thumbmark', 148, yPos + 12);
  
  // Save the PDF
  const fileName = `${trainee.lastName || trainee.name}_Registration_Form.pdf`;
  pdf.save(fileName);
}

// ============ ITEMS PDF ============

interface ItemData {
  id: number | string;
  name: string;
  category: string;
  quantity: number;
  available: number;
  location: string;
  condition?: string;
  description?: string;
  serialNumber?: string;
  dateAdded?: string;
}

export function generateItemsPDF(items: ItemData[], title: string = 'Items Inventory Report') {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // Header
  pdf.setFillColor(25, 118, 210); // BMDC Blue
  pdf.rect(0, 0, pageWidth, 35, 'F');
  
  // Logo/Title area
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BMDC', pageWidth / 2, 15, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Bongabong Manpower Development Center', pageWidth / 2, 22, { align: 'center' });
  pdf.text(title, pageWidth / 2, 28, { align: 'center' });
  
  // Date generated
  pdf.setFontSize(8);
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-PH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, pageWidth / 2, 33, { align: 'center' });
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
  
  // Table data
  const tableData = items.map((item, index) => [
    index + 1,
    item.name,
    item.category,
    item.quantity,
    item.available,
    item.location,
    item.condition || 'Good'
  ]);
  
  // Generate table using autoTable
  (pdf as any).autoTable({
    startY: 40,
    head: [['#', 'Item Name', 'Category', 'Total Qty', 'Available', 'Location', 'Condition']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [25, 118, 210],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 35 },
      6: { cellWidth: 25 }
    },
    margin: { left: 10, right: 10 },
    didDrawPage: function(_data: any) {
      // Footer
      const pageCount = (pdf as any).internal.getNumberOfPages();
      const currentPage = (pdf as any).internal.getCurrentPageInfo().pageNumber;
      
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  });
  
  // Summary at the bottom of last page
  const finalY = (pdf as any).lastAutoTable.finalY + 10;
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAvailable = items.reduce((sum, item) => sum + item.available, 0);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary:', 14, finalY);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Total Items: ${totalItems}`, 14, finalY + 6);
  pdf.text(`Total Quantity: ${totalQuantity}`, 14, finalY + 12);
  pdf.text(`Total Available: ${totalAvailable}`, 14, finalY + 18);
  pdf.text(`Total Borrowed: ${totalQuantity - totalAvailable}`, 14, finalY + 24);
  
  // Save
  const fileName = `BMDC_Items_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
}

// ============ LENDINGS PDF ============

interface LendingData {
  id: number | string;
  trainee: string;
  item: string;
  borrowedDate: string;
  dueDate: string;
  returnedDate?: string | null;
  status: 'active' | 'returned' | 'overdue';
}

export function generateLendingsPDF(lendings: LendingData[], title: string = 'Lending Records Report') {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // Header
  pdf.setFillColor(25, 118, 210); // BMDC Blue
  pdf.rect(0, 0, pageWidth, 35, 'F');
  
  // Logo/Title area
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BMDC', pageWidth / 2, 15, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Bongabong Manpower Development Center', pageWidth / 2, 22, { align: 'center' });
  pdf.text(title, pageWidth / 2, 28, { align: 'center' });
  
  // Date generated
  pdf.setFontSize(8);
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-PH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, pageWidth / 2, 33, { align: 'center' });
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
  
  // Table data
  const tableData = lendings.map((lending, index) => {
    const borrowed = new Date(lending.borrowedDate).toLocaleDateString('en-PH');
    const due = new Date(lending.dueDate).toLocaleDateString('en-PH');
    const returned = lending.returnedDate 
      ? new Date(lending.returnedDate).toLocaleDateString('en-PH')
      : '-';
    
    return [
      index + 1,
      lending.trainee,
      lending.item,
      borrowed,
      due,
      returned,
      lending.status.toUpperCase()
    ];
  });
  
  // Generate table using autoTable
  (pdf as any).autoTable({
    startY: 40,
    head: [['#', 'Trainee', 'Item', 'Borrowed', 'Due Date', 'Returned', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [25, 118, 210],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 45 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: 20, halign: 'center' }
    },
    didParseCell: function(data: any) {
      // Color code status
      if (data.section === 'body' && data.column.index === 6) {
        const status = data.cell.raw;
        if (status === 'OVERDUE') {
          data.cell.styles.textColor = [220, 38, 38]; // Red
          data.cell.styles.fontStyle = 'bold';
        } else if (status === 'RETURNED') {
          data.cell.styles.textColor = [34, 197, 94]; // Green
        } else if (status === 'ACTIVE') {
          data.cell.styles.textColor = [25, 118, 210]; // Blue
        }
      }
    },
    margin: { left: 10, right: 10 },
    didDrawPage: function(_data: any) {
      // Footer
      const pageCount = (pdf as any).internal.getNumberOfPages();
      const currentPage = (pdf as any).internal.getCurrentPageInfo().pageNumber;
      
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  });
  
  // Summary at the bottom of last page
  const finalY = (pdf as any).lastAutoTable.finalY + 10;
  const totalLendings = lendings.length;
  const activeLendings = lendings.filter(l => l.status === 'active').length;
  const returnedLendings = lendings.filter(l => l.status === 'returned').length;
  const overdueLendings = lendings.filter(l => l.status === 'overdue').length;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary:', 14, finalY);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Total Lendings: ${totalLendings}`, 14, finalY + 6);
  pdf.text(`Active: ${activeLendings}`, 14, finalY + 12);
  pdf.text(`Returned: ${returnedLendings}`, 14, finalY + 18);
  pdf.text(`Overdue: ${overdueLendings}`, 14, finalY + 24);
  
  // Save
  const fileName = `BMDC_Lendings_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
}
