import 'regenerator-runtime/runtime.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';

async function generateEnglishJobApp() {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  
  // Page 1
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  
  // Header
  page.drawRectangle({
    x: 40,
    y: height - 80,
    width: width - 80,
    height: 48,
    color: rgb(0.94, 0.96, 0.98),
    borderColor: rgb(0.2, 0.4, 0.7),
    borderWidth: 1.5,
  });
  
  page.drawText('APPLICATION FOR EMPLOYMENT', {
    x: 60,
    y: height - 58,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.4),
  });
  page.drawText('Fillora Global Technologies Ltd. — Confidential Form', {
    x: 60,
    y: height - 74,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Section 1: Personal Info
  let y = height - 120;
  page.drawText('1. PERSONAL INFORMATION', {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  
  y -= 25;
  // Full Name
  page.drawText('Full Name:', { x: 40, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 120,
    y: y,
    width: 250,
    height: 24,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  // Date of Birth
  page.drawText('Date of Birth:', { x: 390, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 460,
    y: y,
    width: 95,
    height: 24,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  y -= 35;
  // Email
  page.drawText('Email Address:', { x: 40, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 120,
    y: y,
    width: 250,
    height: 24,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  // Phone
  page.drawText('Phone Number:', { x: 390, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 460,
    y: y,
    width: 95,
    height: 24,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  y -= 35;
  // Street Address
  page.drawText('Address:', { x: 40, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 120,
    y: y,
    width: 435,
    height: 24,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  // Section 2: Position & Preferences
  y -= 45;
  page.drawText('2. POSITION PREFERENCES & ELIGIBILITY', {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  y -= 25;
  page.drawText('Applied Position:', { x: 40, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 140,
    y: y,
    width: 230,
    height: 24,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  page.drawText('Expected Salary ($):', { x: 390, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 490,
    y: y,
    width: 65,
    height: 24,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  y -= 35;
  page.drawText('Work Availability:', { x: 40, y: y + 4, size: 10, font: fontRegular });
  
  // Checkboxes
  const drawCheckbox = (label, xPos) => {
    page.drawRectangle({
      x: xPos,
      y: y + 2,
      width: 14,
      height: 14,
      borderColor: rgb(0.3, 0.3, 0.3),
      borderWidth: 1.2,
      color: rgb(1, 1, 1),
    });
    page.drawText(label, { x: xPos + 20, y: y + 5, size: 9, font: fontRegular });
  };

  drawCheckbox('Full-Time', 140);
  drawCheckbox('Part-Time', 230);
  drawCheckbox('Remote', 320);
  drawCheckbox('Willing to Relocate', 410);

  // Section 3: Professional Background
  y -= 45;
  page.drawText('3. PROFESSIONAL BACKGROUND & SKILLS', {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  y -= 25;
  page.drawText('Key Skills & Qualifications (Multiline Summary):', { x: 40, y, size: 10, font: fontRegular });
  y -= 85;
  page.drawRectangle({
    x: 40,
    y,
    width: 515,
    height: 75,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1),
  });

  // Section 4: Declaration & Signature
  y -= 45;
  page.drawText('4. DECLARATION & SIGNATURE', {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  y -= 25;
  page.drawText('I certify that the information provided in this application is true and complete.', {
    x: 40,
    y,
    size: 9,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 35;
  page.drawText('Applicant Signature:', { x: 40, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 160,
    y,
    width: 210,
    height: 30,
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText('Date:', { x: 400, y: y + 8, size: 10, font: fontRegular });
  page.drawRectangle({
    x: 440,
    y: y,
    width: 115,
    height: 26,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  const pdfBytes = await doc.save();
  fs.writeFileSync('public/sample-forms/english_job_application.pdf', pdfBytes);
  console.log('Created english_job_application.pdf');
}

async function generateBanglaCitizenApp() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  
  const fontBytes = fs.readFileSync('public/fonts/Kalpurush.ttf');
  const bengaliFont = await doc.embedFont(fontBytes);
  const bengaliBold = bengaliFont;
  
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Header Banner
  page.drawRectangle({
    x: 40,
    y: height - 85,
    width: width - 80,
    height: 55,
    color: rgb(0.94, 0.98, 0.94),
    borderColor: rgb(0.1, 0.5, 0.25),
    borderWidth: 1.5,
  });

  page.drawText('গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', {
    x: 180,
    y: height - 52,
    size: 14,
    font: bengaliBold,
    color: rgb(0.08, 0.4, 0.2),
  });
  page.drawText('নাগরিক সেবা ও তথ্য নিবন্ধন ফরম', {
    x: 185,
    y: height - 72,
    size: 13,
    font: bengaliBold,
    color: rgb(0.1, 0.2, 0.1),
  });

  let y = height - 120;
  page.drawText('১. ব্যক্তিগত তথ্যাবলি (Personal Details)', {
    x: 40,
    y,
    size: 12,
    font: bengaliBold,
    color: rgb(0.1, 0.3, 0.2),
  });

  y -= 30;
  // Field 1: Applicant Name
  page.drawText('আবেদনকারীর পূর্ণ নাম:', { x: 40, y: y + 6, size: 10, font: bengaliFont });
  page.drawRectangle({
    x: 180,
    y,
    width: 375,
    height: 24,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  y -= 35;
  // Field 2: Father Name
  page.drawText('পিতার নাম:', { x: 40, y: y + 6, size: 10, font: bengaliFont });
  page.drawRectangle({
    x: 180,
    y,
    width: 375,
    height: 24,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  y -= 35;
  // Field 3: Mother Name
  page.drawText('মাতার নাম:', { x: 40, y: y + 6, size: 10, font: bengaliFont });
  page.drawRectangle({
    x: 180,
    y,
    width: 375,
    height: 24,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  y -= 35;
  // Field 4: NID
  page.drawText('জাতীয় পরিচয়পত্র (NID) নম্বর:', { x: 40, y: y + 6, size: 10, font: bengaliFont });
  page.drawRectangle({
    x: 180,
    y,
    width: 200,
    height: 24,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  page.drawText('জন্ম তারিখ:', { x: 395, y: y + 6, size: 10, font: bengaliFont });
  page.drawRectangle({
    x: 460,
    y,
    width: 95,
    height: 24,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  y -= 35;
  // Gender Checkboxes
  page.drawText('লিঙ্গ নির্ধারণ:', { x: 40, y: y + 4, size: 10, font: bengaliFont });
  
  const drawCheckbox = (label, xPos) => {
    page.drawRectangle({
      x: xPos,
      y: y + 2,
      width: 14,
      height: 14,
      borderColor: rgb(0.2, 0.4, 0.2),
      borderWidth: 1.2,
      color: rgb(1, 1, 1),
    });
    page.drawText(label, { x: xPos + 20, y: y + 4, size: 10, font: bengaliFont });
  };

  drawCheckbox('পুরুষ', 160);
  drawCheckbox('মহিলা', 250);
  drawCheckbox('অন্যান্য', 340);

  y -= 45;
  page.drawText('২. ঠিকানা সংক্রান্ত বিবরণ (Address Details)', {
    x: 40,
    y,
    size: 12,
    font: bengaliBold,
    color: rgb(0.1, 0.3, 0.2),
  });

  y -= 25;
  page.drawText('বর্তমান ঠিকানা (গ্রাম / বাড়ি, সড়ক, ডাকঘর, থানা ও জেলা):', { x: 40, y, size: 10, font: bengaliFont });
  y -= 65;
  page.drawRectangle({
    x: 40,
    y,
    width: 515,
    height: 55,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  y -= 25;
  page.drawText('স্থায়ী ঠিকানা:', { x: 40, y, size: 10, font: bengaliFont });
  y -= 65;
  page.drawRectangle({
    x: 40,
    y,
    width: 515,
    height: 55,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  y -= 45;
  page.drawText('৩. অঙ্গীকারনামা ও স্বাক্ষর (Declaration & Signature)', {
    x: 40,
    y,
    size: 12,
    font: bengaliBold,
    color: rgb(0.1, 0.3, 0.2),
  });

  y -= 20;
  page.drawText('আমি অঙ্গীকার করিতেছি যে বর্ণিত সকল তথ্য সম্পূর্ণ সত্য ও সঠিক।', {
    x: 40,
    y,
    size: 9.5,
    font: bengaliFont,
  });

  y -= 35;
  page.drawText('আবেদনকারীর স্বাক্ষর:', { x: 40, y: y + 8, size: 10, font: bengaliFont });
  page.drawRectangle({
    x: 170,
    y,
    width: 210,
    height: 30,
    borderColor: rgb(0.4, 0.4, 0.4),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText('তারিখ:', { x: 400, y: y + 8, size: 10, font: bengaliFont });
  page.drawRectangle({
    x: 450,
    y,
    width: 105,
    height: 26,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
    color: rgb(0.99, 1, 0.99),
  });

  const pdfBytes = await doc.save();
  fs.writeFileSync('public/sample-forms/bangla_citizen_application.pdf', pdfBytes);
  console.log('Created bangla_citizen_application.pdf');
}

async function generateAcroFormSample() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();

  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  page.drawText('INTERACTIVE ACROFORM TEST DOCUMENT', {
    x: 40,
    y: height - 50,
    size: 14,
    font: fontBold,
  });
  page.drawText('This PDF contains native interactive AcroForm fields to test field detection.', {
    x: 40,
    y: height - 70,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  let y = height - 120;
  page.drawText('Full Name:', { x: 40, y: y + 5, size: 10, font });
  const nameField = form.createTextField('fullName');
  nameField.addToPage(page, { x: 140, y, width: 250, height: 24 });

  y -= 40;
  page.drawText('Email Address:', { x: 40, y: y + 5, size: 10, font });
  const emailField = form.createTextField('email');
  emailField.addToPage(page, { x: 140, y, width: 250, height: 24 });

  y -= 40;
  page.drawText('Subscribe to newsletter:', { x: 40, y: y + 5, size: 10, font });
  const checkField = form.createCheckBox('subscribe');
  checkField.addToPage(page, { x: 200, y: y + 2, width: 16, height: 16 });

  y -= 40;
  page.drawText('Comments:', { x: 40, y: y + 45, size: 10, font });
  const commentsField = form.createTextField('comments');
  commentsField.enableMultiline();
  commentsField.addToPage(page, { x: 140, y, width: 350, height: 60 });

  const pdfBytes = await doc.save();
  fs.writeFileSync('public/sample-forms/interactive_acroform.pdf', pdfBytes);
  console.log('Created interactive_acroform.pdf');
}

async function run() {
  await generateEnglishJobApp();
  await generateBanglaCitizenApp();
  await generateAcroFormSample();
}

run().catch(console.error);
