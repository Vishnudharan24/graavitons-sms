import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './AddExam.css';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';
import ManageExamMarks from './ManageExamMarks';

const MOCK_SUBJECTS = [
  { key: 'maths', label: 'Maths', aliases: ['maths', 'mathematics', 'math'], marksField: 'mathsMarks', unitField: 'mathsUnitNames', totalField: 'mathsTotalMarks' },
  { key: 'physics', label: 'Physics', aliases: ['physics'], marksField: 'physicsMarks', unitField: 'physicsUnitNames', totalField: 'physicsTotalMarks' },
  { key: 'chemistry', label: 'Chemistry', aliases: ['chemistry'], marksField: 'chemistryMarks', unitField: 'chemistryUnitNames', totalField: 'chemistryTotalMarks' },
  { key: 'biology', label: 'Biology', aliases: ['biology'], marksField: 'biologyMarks', unitField: 'biologyUnitNames', totalField: 'biologyTotalMarks' }
];

const SUBJECT_LABEL_MAP = {
  maths: 'Mathematics',
  math: 'Mathematics',
  mathematics: 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology'
};

const normalizeSubjectLabel = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  return SUBJECT_LABEL_MAP[key] || key.replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const getDailySubjectOptions = (batchSubjects) => {
  const source = Array.isArray(batchSubjects) && batchSubjects.length > 0
    ? batchSubjects
    : ['Physics', 'Chemistry', 'Biology', 'Mathematics'];

  const seen = new Set();
  const options = [];
  source.forEach((subject) => {
    const label = normalizeSubjectLabel(subject);
    if (!label) return;
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      options.push(label);
    }
  });
  return options;
};

const getActiveMockSubjects = (batchSubjects) => {
  if (!Array.isArray(batchSubjects) || batchSubjects.length === 0) {
    return MOCK_SUBJECTS;
  }

  const normalized = new Set(
    batchSubjects
      .filter(Boolean)
      .map(subject => String(subject).trim().toLowerCase())
  );

  const selected = MOCK_SUBJECTS.filter(subject =>
    subject.aliases.some(alias => normalized.has(alias))
  );

  return selected.length > 0 ? selected : MOCK_SUBJECTS;
};

const normalizeHeaderKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const parseExcelDateToIso = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const y = String(parsed.y).padStart(4, '0');
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const raw = String(value).trim();

  // DD.MM.YYYY or DD.MM.YY
  const dotParts = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotParts) {
    const day = parseInt(dotParts[1], 10);
    const month = parseInt(dotParts[2], 10);
    let year = parseInt(dotParts[3], 10);
    if (year < 100) year += 2000;
    const y = String(year).padStart(4, '0');
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  const parts = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    let year = parseInt(parts[3], 10);
    if (year < 100) year += 2000;
    const y = String(year).padStart(4, '0');
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
};

const toIntOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = parseInt(String(value).trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeAdmissionValue = (value) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    const asString = String(value);
    return asString.endsWith('.0') ? asString.slice(0, -2) : asString;
  }

  let raw = String(value).trim();
  if (!raw) return '';

  if (raw.startsWith("'")) {
    raw = raw.slice(1).trim();
  }

  if (/^\d+\.0$/.test(raw)) {
    raw = raw.replace(/\.0$/, '');
  }

  return raw;
};

const normalizeStudentNameKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const getAllSheetRows = (worksheet) => {
  const ref = worksheet?.['!ref'];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const rows = [];

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[cellAddress];
      row.push(cell ? cell.v : '');
    }
    rows.push(row);
  }

  return rows;
};

const AddExam = ({ batch, students, onBack, onSave }) => {
  const activeMockSubjects = getActiveMockSubjects(batch?.subjects);
  const dailySubjectOptions = getDailySubjectOptions(batch?.subjects);
  const [isSaving, setIsSaving] = useState(false);

  const [examMode, setExamMode] = useState('manual'); // 'manual' | 'excel' | 'multi-excel' | 'manage'
  const [excelBulkUpload, setExcelBulkUpload] = useState(null);
  const [multiUploadCount, setMultiUploadCount] = useState('1');
  const [uploadLogs, setUploadLogs] = useState([]);
  const [examData, setExamData] = useState({
    examName: '',
    examDate: '',
    subject: '',
    unitName: '',
    dailySubjectTotalMarks: '',
    dailyTestTotalMarks: '',
    examType: '',
    // For monthly test
    mathsUnitNames: '',
    physicsUnitNames: '',
    biologyUnitNames: '',
    chemistryUnitNames: '',
    mathsTotalMarks: '',
    physicsTotalMarks: '',
    chemistryTotalMarks: '',
    biologyTotalMarks: '',
    mockTestTotalMarks: ''
  });

  // Initialize marks for all students
  const [studentMarks, setStudentMarks] = useState(
    students.map(student => ({
      id: student.id,
      name: student.name,
      rollNo: student.rollNo,
      // For unit test
      marks: '',
      // For monthly test
      mathsMarks: '',
      physicsMarks: '',
      biologyMarks: '',
      chemistryMarks: ''
    }))
  );

  const handleExamDataChange = (e) => {
    const { name, value } = e.target;
    setExamData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Reset fields when exam type changes
    if (name === 'examType') {
      setExcelBulkUpload(null);
      if (value === 'daily test') {
        setExamData(prev => ({
          ...prev,
          examType: value,
          dailySubjectTotalMarks: '',
          dailyTestTotalMarks: '',
          mathsUnitNames: '',
          physicsUnitNames: '',
          biologyUnitNames: '',
          chemistryUnitNames: '',
          mathsTotalMarks: '',
          physicsTotalMarks: '',
          chemistryTotalMarks: '',
          biologyTotalMarks: '',
          mockTestTotalMarks: ''
        }));
      } else if (value === 'mock test') {
        setExamData(prev => ({
          ...prev,
          examType: value,
          subject: '',
          unitName: '',
          dailySubjectTotalMarks: '',
          dailyTestTotalMarks: ''
        }));
      }
    }

    // Keep unit test total in sync by default for single-subject tests
    if (name === 'dailySubjectTotalMarks') {
      setExamData(prev => ({
        ...prev,
        dailySubjectTotalMarks: value,
        dailyTestTotalMarks: value
      }));
    }
  };

  const handleMarksChange = (studentId, field, value) => {
    setStudentMarks(prev =>
      prev.map(student =>
        student.id === studentId ? { ...student, [field]: value } : student
      )
    );
  };

  const handleDownloadFormat = async () => {
    // Use backend API to generate template with actual student data
    try {
      let apiUrl = '';
      
      if (examData.examType === 'daily test') {
        const totalMarks = examData.dailySubjectTotalMarks || 100;
        if (examMode === 'multi-excel') {
          const count = Math.max(1, parseInt(multiUploadCount, 10) || 1);
          apiUrl = `${API_BASE}/api/exam/template/daily-test/${batch.batch_id}?total_marks=${totalMarks}&multi_template=true&test_count=${count}`;
        } else {
          apiUrl = `${API_BASE}/api/exam/template/daily-test/${batch.batch_id}?total_marks=${totalMarks}`;
        }
      } else if (examData.examType === 'mock test') {
        if (examMode === 'multi-excel') {
          const count = Math.max(1, parseInt(multiUploadCount, 10) || 1);
          apiUrl = `${API_BASE}/api/exam/template/mock-test/${batch.batch_id}?multi_template=true&test_count=${count}`;
        } else {
          apiUrl = `${API_BASE}/api/exam/template/mock-test/${batch.batch_id}`;
        }
      } else {
        alert('Please select exam type first');
        return;
      }

      // Fetch the template file
      const response = await authFetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `${examData.examType}_template_${examData.examName || 'exam'}.xlsx`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error downloading template:', error);
      alert(`Failed to download template: ${error.message}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadLogs([]);
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          let data;
          const fileName = file.name.toLowerCase();

          if (fileName.endsWith('.csv')) {
            // Handle CSV files
            const text = event.target.result;
            const allRows = text
              .split('\n')
              .map(row => row.trim())
              .filter(Boolean)
              .map(row => row.split(',').map(cell => cell.trim()));

            const rows = allRows.slice(1); // Skip header

            if (examData.examType === 'daily test') {
              const updatedMarks = studentMarks.map(student => {
                const row = rows.find(r => r[0] === student.rollNo);
                if (row) {
                  const marks = row[2]?.trim();
                  return { ...student, marks: marks || '' };
                }
                return student;
              });
              setStudentMarks(updatedMarks);
              setExcelBulkUpload(null);
            } else if (examData.examType === 'mock test') {
              const updatedMarks = studentMarks.map(student => {
                const row = rows.find(r => r[0] === student.rollNo);
                if (row) {
                  const updatedStudent = { ...student };
                  activeMockSubjects.forEach((subject, index) => {
                    updatedStudent[subject.marksField] = row[2 + index]?.trim() || '';
                  });
                  return { 
                    ...updatedStudent
                  };
                }
                return student;
              });
              setStudentMarks(updatedMarks);
              setExcelBulkUpload(null);
            }
          } else {
            // Handle Excel files (.xlsx, .xls)
            const workbook = XLSX.read(event.target.result, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const sheetRows = getAllSheetRows(firstSheet);

              const nonEmptyRows = sheetRows.filter(row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim() !== ''));
              if (nonEmptyRows.length < 2) {
                throw new Error('No data rows found in file');
              }

              const header = (sheetRows[0] || []).map(normalizeHeaderKey);
              const rows = sheetRows.slice(1);

              const findIndex = (...aliases) => header.findIndex(h => aliases.includes(h));

              const admissionIndex = findIndex('admission number', 'admission no', 'student id', 'student_id', 'roll no', 'roll number');
              const studentNameIndex = findIndex('student name', 'name');
              const testNoIndex = findIndex('test no', 'test number', 'test_no');
              const studentIdLookup = new Map();
              const studentNameLookup = new Map();
              students.forEach((s) => {
                const normalized = normalizeAdmissionValue(s.rollNo);
                if (normalized) studentIdLookup.set(normalized, String(s.rollNo || '').trim());
                const normalizedName = normalizeStudentNameKey(s.name);
                if (normalizedName && !studentNameLookup.has(normalizedName)) {
                  studentNameLookup.set(normalizedName, String(s.rollNo || '').trim());
                }
              });

              const resolveStudentId = (row) => {
                if (admissionIndex >= 0) {
                  const parsedAdmission = normalizeAdmissionValue(row?.[admissionIndex]);
                  const byAdmission = studentIdLookup.get(parsedAdmission);
                  if (byAdmission) return byAdmission;
                }

                if (studentNameIndex >= 0) {
                  const parsedName = normalizeStudentNameKey(row?.[studentNameIndex]);
                  const byName = studentNameLookup.get(parsedName);
                  if (byName) return byName;
                }

                return '';
              };

              if (admissionIndex < 0 && studentNameIndex < 0) {
                throw new Error('Uploaded file must contain either Admission Number or Student Name column');
              }

            if (examData.examType === 'daily test') {
                const dateIndex = findIndex('exam date (yyyy-mm-dd)', 'exam date', 'date');
                const subjectIndex = findIndex('subject');
                const topicIndex = findIndex('topic / unit name', 'topic/unit', 'topic', 'unit name', 'unit');
                const marksIndex = findIndex('marks', 'marks (out of 100)', 'score');
                const subjectTotalIndex = findIndex('subject total marks', 'subject total');
                const testTotalIndex = findIndex('test total marks', 'test total');

                const hasBulkColumns = dateIndex >= 0 && subjectIndex >= 0 && topicIndex >= 0;

                if (hasBulkColumns) {
                  const groupMap = new Map();
                  let skippedRows = 0;
                  const rowErrors = [];

                  rows.forEach((row, rowIndex) => {
                    const excelRowNo = rowIndex + 2;
                    if (!Array.isArray(row) || row.every(cell => String(cell ?? '').trim() === '')) {
                      return;
                    }
                    const studentId = resolveStudentId(row);
                    if (!studentId) {
                      skippedRows += 1;
                      rowErrors.push(`Row ${excelRowNo}: Student not found in selected batch`);
                      return;
                    }

                    const marks = String(row?.[marksIndex] ?? '').trim();

                    const examDate = parseExcelDateToIso(row?.[dateIndex]);
                    const subject = normalizeSubjectLabel(row?.[subjectIndex]);
                    const unitName = String(row?.[topicIndex] ?? '').trim();
                    const testNo = String(row?.[testNoIndex] ?? '').trim();

                    if (!examDate || !subject || !unitName) {
                      skippedRows += 1;
                      rowErrors.push(`Row ${excelRowNo}: Missing/invalid Exam Date, Subject, or Topic / Unit Name`);
                      return;
                    }

                    const fallbackSubjectTotal = toIntOrNull(examData.dailySubjectTotalMarks);
                    const fallbackTestTotal = toIntOrNull(examData.dailyTestTotalMarks);
                    const subjectTotal = toIntOrNull(row?.[subjectTotalIndex]) ?? fallbackSubjectTotal;
                    const testTotal = toIntOrNull(row?.[testTotalIndex]) ?? fallbackTestTotal ?? subjectTotal;

                    const key = `${testNo || 'NA'}||${examDate}||${subject}||${unitName}||${subjectTotal ?? ''}||${testTotal ?? ''}`;
                    if (!groupMap.has(key)) {
                      groupMap.set(key, {
                        examName: `${examData.examName || 'Unit Test'} - ${examDate} - ${subject}`,
                        examDate,
                        subject,
                        unitName,
                        totalMarks: subjectTotal ?? 100,
                        subjectTotalMarks: subjectTotal,
                        testTotalMarks: testTotal,
                        examType: 'daily test',
                        studentMarkMap: new Map()
                      });
                    }

                    groupMap.get(key).studentMarkMap.set(studentId, marks || null);
                  });

                  const exams = Array.from(groupMap.values()).map(group => ({
                    examName: group.examName,
                    examDate: group.examDate,
                    subject: group.subject,
                    unitName: group.unitName,
                    totalMarks: group.totalMarks,
                    subjectTotalMarks: group.subjectTotalMarks,
                    testTotalMarks: group.testTotalMarks,
                    examType: group.examType,
                    studentMarks: Array.from(group.studentMarkMap.entries()).map(([id, markValue]) => ({
                      id,
                      marks: markValue
                    }))
                  })).filter(group => group.studentMarks.length > 0);

                  if (exams.length > 0) {
                    setExcelBulkUpload({ examType: 'daily test', exams });
                    setUploadLogs(rowErrors.slice(0, 200));
                    alert(`Loaded ${exams.length} unit tests from Excel. Skipped rows: ${skippedRows}. Click Save Exam Marks to upload all.`);
                  } else {
                    setExcelBulkUpload(null);
                    setUploadLogs(rowErrors.slice(0, 200));
                    alert('No valid unit test rows found. Please ensure Exam Date, Subject, Topic, and Marks are filled.');
                  }
                } else {
                  const updatedMarks = studentMarks.map(student => {
                    const row = rows.find((r) => {
                      const rowStudentId = resolveStudentId(r);
                      return rowStudentId && rowStudentId === student.rollNo;
                    });
                    if (row) {
                      const marksIndex = findIndex('marks', 'marks (out of 100)', 'score');
                      const fallbackIndex = studentNameIndex >= 0 ? studentNameIndex + 1 : (admissionIndex >= 0 ? admissionIndex + 2 : 1);
                      const marks = row?.[marksIndex >= 0 ? marksIndex : fallbackIndex]?.toString().trim();
                      return { ...student, marks: marks || '' };
                    }
                    return student;
                  });
                  setStudentMarks(updatedMarks);
                  setExcelBulkUpload(null);
                  setUploadLogs([]);
                }
            } else if (examData.examType === 'mock test') {
                const dateIndex = findIndex('exam date (yyyy-mm-dd)', 'exam date', 'date');
                const testTotalIndex = findIndex('test total marks', 'test total');
              const simpleMarksIndex = findIndex('marks', 'score');
                const subjectIndexes = activeMockSubjects.reduce((acc, subject) => {
                  const headerAliasesBySubject = {
                    maths: ['maths', 'mathematics', 'math'],
                    physics: ['physics'],
                    chemistry: ['chemistry'],
                    biology: ['biology']
                  };

                  const aliases = headerAliasesBySubject[subject.key] || [normalizeHeaderKey(subject.label)];
                  const idx = header.findIndex((h) =>
                    aliases.some(alias => h === normalizeHeaderKey(`${alias} marks`) || h === alias)
                  );
                  acc[subject.key] = idx;
                  acc[`${subject.key}_unit`] = header.findIndex((h) =>
                    aliases.some(alias => h === normalizeHeaderKey(`${alias} unit names`))
                  );
                  acc[`${subject.key}_total`] = header.findIndex((h) =>
                    aliases.some(alias => h === normalizeHeaderKey(`${alias} total marks`))
                  );
                  return acc;
                }, {});

                const hasDateColumn = dateIndex >= 0;
                const hasSubjectColumns = activeMockSubjects.some(subject => subjectIndexes[subject.key] >= 0);

                if (hasDateColumn) {
                  const groupMap = new Map();
                  let skippedRows = 0;
                  const rowErrors = [];

                  rows.forEach((row, rowIndex) => {
                    const excelRowNo = rowIndex + 2;
                    if (!Array.isArray(row) || row.every(cell => String(cell ?? '').trim() === '')) {
                      return;
                    }
                    const studentId = resolveStudentId(row);
                    if (!studentId) {
                      skippedRows += 1;
                      rowErrors.push(`Row ${excelRowNo}: Student not found in selected batch`);
                      return;
                    }

                    const examDate = parseExcelDateToIso(row?.[dateIndex]);
                    if (!examDate) {
                      skippedRows += 1;
                      rowErrors.push(`Row ${excelRowNo}: Invalid Exam Date`);
                      return;
                    }
                    const testNo = String(row?.[testNoIndex] ?? '').trim();

                    const marksPayload = {};
                    activeMockSubjects.forEach((subject) => {
                      const idx = subjectIndexes[subject.key];
                      const markValue = idx >= 0 ? String(row?.[idx] ?? '').trim() : '';
                      marksPayload[subject.marksField] = markValue;
                    });

                    const unitPayload = {};
                    const totalPayload = {};
                    activeMockSubjects.forEach((subject) => {
                      const unitIdx = subjectIndexes[`${subject.key}_unit`];
                      const totalIdx = subjectIndexes[`${subject.key}_total`];
                      unitPayload[subject.unitField] = unitIdx >= 0 ? String(row?.[unitIdx] ?? '').trim() : '';
                      totalPayload[subject.totalField] = totalIdx >= 0 ? toIntOrNull(row?.[totalIdx]) : null;
                    });

                    const testTotal = toIntOrNull(row?.[testTotalIndex]);
                    const groupKeyParts = [testNo || 'NA', examDate];
                    activeMockSubjects.forEach((subject) => {
                      groupKeyParts.push(unitPayload[subject.unitField] || '');
                      groupKeyParts.push(String(totalPayload[subject.totalField] ?? ''));
                    });
                    groupKeyParts.push(String(testTotal ?? ''));
                    const groupKey = groupKeyParts.join('||');

                    if (!groupMap.has(groupKey)) {
                      groupMap.set(groupKey, {
                        examName: `${examData.examName || 'Monthly Test'} - ${examDate}`,
                        examDate,
                        examType: 'mock test',
                        mathsUnitNames: unitPayload.mathsUnitNames ?? examData.mathsUnitNames,
                        physicsUnitNames: unitPayload.physicsUnitNames ?? examData.physicsUnitNames,
                        chemistryUnitNames: unitPayload.chemistryUnitNames ?? examData.chemistryUnitNames,
                        biologyUnitNames: unitPayload.biologyUnitNames ?? examData.biologyUnitNames,
                        mathsTotalMarks: totalPayload.mathsTotalMarks ?? toIntOrNull(examData.mathsTotalMarks),
                        physicsTotalMarks: totalPayload.physicsTotalMarks ?? toIntOrNull(examData.physicsTotalMarks),
                        chemistryTotalMarks: totalPayload.chemistryTotalMarks ?? toIntOrNull(examData.chemistryTotalMarks),
                        biologyTotalMarks: totalPayload.biologyTotalMarks ?? toIntOrNull(examData.biologyTotalMarks),
                        testTotalMarks: testTotal ?? toIntOrNull(examData.mockTestTotalMarks),
                        studentMarkMap: new Map()
                      });
                    }

                    groupMap.get(groupKey).studentMarkMap.set(studentId, {
                      id: studentId,
                      mathsMarks: marksPayload.mathsMarks || null,
                      physicsMarks: marksPayload.physicsMarks || null,
                      chemistryMarks: marksPayload.chemistryMarks || null,
                      biologyMarks: marksPayload.biologyMarks || null
                    });
                  });

                  const exams = Array.from(groupMap.values()).map(group => ({
                    examName: group.examName,
                    examDate: group.examDate,
                    examType: group.examType,
                    mathsUnitNames: group.mathsUnitNames,
                    physicsUnitNames: group.physicsUnitNames,
                    chemistryUnitNames: group.chemistryUnitNames,
                    biologyUnitNames: group.biologyUnitNames,
                    mathsTotalMarks: group.mathsTotalMarks,
                    physicsTotalMarks: group.physicsTotalMarks,
                    chemistryTotalMarks: group.chemistryTotalMarks,
                    biologyTotalMarks: group.biologyTotalMarks,
                    testTotalMarks: group.testTotalMarks,
                    studentMarks: Array.from(group.studentMarkMap.values())
                  })).filter(group => group.studentMarks.length > 0);

                  if (exams.length > 0) {
                    setExcelBulkUpload({ examType: 'mock test', exams });
                    setUploadLogs(rowErrors.slice(0, 200));
                    alert(`Loaded ${exams.length} monthly tests from Excel by date. Skipped rows: ${skippedRows}. Click Save Exam Marks to upload all.`);
                  } else {
                    setExcelBulkUpload(null);
                    setUploadLogs(rowErrors.slice(0, 200));
                    alert('No valid monthly test rows found. Please ensure Exam Date and marks are filled.');
                  }
                } else {
                  const updatedMarks = studentMarks.map(student => {
                    const row = rows.find((r) => {
                      const rowStudentId = resolveStudentId(r);
                      return rowStudentId && rowStudentId === student.rollNo;
                    });
                    if (row) {
                      const updatedStudent = { ...student };

                      if (hasSubjectColumns) {
                        activeMockSubjects.forEach((subject, index) => {
                          const idx = subjectIndexes[subject.key];
                          if (idx >= 0) {
                            updatedStudent[subject.marksField] = String(row?.[idx] ?? '').trim();
                          } else {
                            updatedStudent[subject.marksField] = row[2 + index]?.toString().trim() || '';
                          }
                        });
                      } else if (simpleMarksIndex >= 0 && activeMockSubjects.length > 0) {
                        const firstField = activeMockSubjects[0].marksField;
                        updatedStudent[firstField] = String(row?.[simpleMarksIndex] ?? '').trim();
                        activeMockSubjects.slice(1).forEach((subject) => {
                          updatedStudent[subject.marksField] = '';
                        });
                      } else {
                        activeMockSubjects.forEach((subject, index) => {
                          updatedStudent[subject.marksField] = row[2 + index]?.toString().trim() || '';
                        });
                      }

                      return updatedStudent;
                    }
                    return student;
                  });
                  setStudentMarks(updatedMarks);
                  setExcelBulkUpload(null);
                  setUploadLogs([]);
                }
            }
          }

          alert('Marks uploaded successfully!');
        } catch (error) {
          setUploadLogs([error.message || 'Error reading file. Please check the format and try again.']);
          alert('Error reading file. Please check the format and try again.');
          console.error('File upload error:', error);
        }
      };

      // Read file based on type
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSaving) return;

    const hasBulkExcelData = (examMode === 'excel' || examMode === 'multi-excel')
      && excelBulkUpload
      && excelBulkUpload.examType === examData.examType
      && Array.isArray(excelBulkUpload.exams)
      && excelBulkUpload.exams.length > 0;

    if (examMode === 'multi-excel') {
      if (!examData.examType) {
        alert('Please select exam type for multiple upload');
        return;
      }
      if (!hasBulkExcelData) {
        alert('Please upload the multiple-upload Excel file before submitting');
        return;
      }
    } else {
      // Validate
      if (!examData.examName || !examData.examType || (!hasBulkExcelData && !examData.examDate)) {
        alert('Please fill all required exam details');
        return;
      }
    }

    // Validate based on exam type
    if (examData.examType === 'daily test' && !hasBulkExcelData && examMode !== 'multi-excel') {
      if (!examData.subject || !examData.unitName || !examData.dailySubjectTotalMarks || !examData.dailyTestTotalMarks) {
        alert('Please fill subject, unit name, and total marks for unit test');
        return;
      }

      if (parseInt(examData.dailySubjectTotalMarks, 10) <= 0 || parseInt(examData.dailyTestTotalMarks, 10) <= 0) {
        alert('Total marks must be greater than 0');
        return;
      }
      
      const hasEmptyMarks = studentMarks.some(student => student.marks === '');
      if (hasEmptyMarks) {
        if (!window.confirm('Some students have no marks entered. Continue anyway?')) {
          return;
        }
      }
    } else if (examData.examType === 'mock test' && !hasBulkExcelData && examMode !== 'multi-excel') {
      const hasMissingUnitNames = activeMockSubjects.some(subject => !examData[subject.unitField]);
      if (hasMissingUnitNames) {
        alert('Please fill unit names for all subjects in this batch');
        return;
      }

      const hasMissingSubjectTotals = activeMockSubjects.some(subject => !examData[subject.totalField]);
      if (hasMissingSubjectTotals || !examData.mockTestTotalMarks) {
        alert('Please fill subject total marks and overall test total marks for monthly test');
        return;
      }

      const hasInvalidTotals = activeMockSubjects.some(subject => parseInt(examData[subject.totalField], 10) <= 0)
        || parseInt(examData.mockTestTotalMarks, 10) <= 0;
      if (hasInvalidTotals) {
        alert('All total marks must be greater than 0');
        return;
      }
      
      const hasEmptyMarks = studentMarks.some(student => 
        activeMockSubjects.some(subject => student[subject.marksField] === '')
      );
      if (hasEmptyMarks) {
        if (!window.confirm('Some students have incomplete marks. Continue anyway?')) {
          return;
        }
      }
    }

    // Prepare data for API call
    try {
      setIsSaving(true);
      let apiUrl = '';
      let requestData = {};

      if (hasBulkExcelData) {
        apiUrl = examData.examType === 'daily test'
          ? `${API_BASE}/api/exam/daily-test/bulk`
          : `${API_BASE}/api/exam/mock-test/bulk`;

        requestData = {
          batch_id: batch.batch_id,
          exams: excelBulkUpload.exams
        };

        const response = await authFetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          setUploadLogs([errorData.detail || 'Failed to upload multiple exams']);
          throw new Error(errorData.detail || 'Failed to upload multiple exams');
        }

        const result = await response.json();
        const serverLogs = [];
        (result.failed_exams || []).forEach((entry) => {
          serverLogs.push(`Exam ${entry.index || '-'} (${entry.exam_date || '-'}) failed: ${entry.reason || 'Unknown reason'}`);
        });
        (result.results || []).forEach((entry) => {
          (entry.failed_students || []).forEach((s) => {
            serverLogs.push(`Exam ${entry.index || '-'} student ${s.student_id || '-'}: ${s.reason || 'Unknown reason'}`);
          });
        });
        setUploadLogs(serverLogs.slice(0, 300));

        alert(
          `${result.message}\n\n` +
          `Total Exams: ${result.total_exams}\n` +
          `Successful: ${result.successful_exams}\n` +
          `Failed: ${result.failed_exams_count}\n` +
          `Inserted Records: ${result.total_inserted_records}`
        );

        onSave({ ...examData, bulk: true, bulk_count: excelBulkUpload.exams.length });
        onBack();
        return;
      }

      if (examData.examType === 'daily test') {
        apiUrl = `${API_BASE}/api/exam/daily-test`;
        requestData = {
          batch_id: batch.batch_id,
          examName: examData.examName,
          examDate: examData.examDate,
          subject: examData.subject,
          unitName: examData.unitName,
          totalMarks: parseInt(examData.dailySubjectTotalMarks, 10),
          subjectTotalMarks: parseInt(examData.dailySubjectTotalMarks, 10),
          testTotalMarks: parseInt(examData.dailyTestTotalMarks, 10),
          examType: examData.examType,
          studentMarks: studentMarks.map(s => ({
            id: s.rollNo,
            marks: s.marks
          }))
        };
      } else if (examData.examType === 'mock test') {
        apiUrl = `${API_BASE}/api/exam/mock-test`;
        requestData = {
          batch_id: batch.batch_id,
          examName: examData.examName,
          examDate: examData.examDate,
          examType: examData.examType,
          mathsUnitNames: activeMockSubjects.some(subject => subject.key === 'maths') ? examData.mathsUnitNames : '',
          physicsUnitNames: activeMockSubjects.some(subject => subject.key === 'physics') ? examData.physicsUnitNames : '',
          chemistryUnitNames: activeMockSubjects.some(subject => subject.key === 'chemistry') ? examData.chemistryUnitNames : '',
          biologyUnitNames: activeMockSubjects.some(subject => subject.key === 'biology') ? examData.biologyUnitNames : '',
          mathsTotalMarks: activeMockSubjects.some(subject => subject.key === 'maths') ? parseInt(examData.mathsTotalMarks, 10) : null,
          physicsTotalMarks: activeMockSubjects.some(subject => subject.key === 'physics') ? parseInt(examData.physicsTotalMarks, 10) : null,
          chemistryTotalMarks: activeMockSubjects.some(subject => subject.key === 'chemistry') ? parseInt(examData.chemistryTotalMarks, 10) : null,
          biologyTotalMarks: activeMockSubjects.some(subject => subject.key === 'biology') ? parseInt(examData.biologyTotalMarks, 10) : null,
          testTotalMarks: parseInt(examData.mockTestTotalMarks, 10),
          studentMarks: studentMarks.map(s => ({
            id: s.rollNo,
            mathsMarks: s.mathsMarks,
            physicsMarks: s.physicsMarks,
            chemistryMarks: s.chemistryMarks,
            biologyMarks: s.biologyMarks
          }))
        };
      }

      // Make API call
      const response = await authFetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save exam marks');
      }

      const result = await response.json();
      
      // Show success message with details
      let successMessage = `${result.message}\n\n`;
      successMessage += `Inserted: ${result.inserted_count}/${result.total_students} students\n`;
      
      if (result.failed_students && result.failed_students.length > 0) {
        successMessage += `\nFailed students:\n`;
        result.failed_students.forEach(f => {
          successMessage += `- ${f.student_id}: ${f.reason}\n`;
        });
      }
      
      alert(successMessage);
      
      // Call onSave callback
      const examResult = {
        ...examData,
        studentMarks: studentMarks
      };
      onSave(examResult);
      
      // Go back
      onBack();

    } catch (error) {
      console.error('Error saving exam marks:', error);
      alert(`Failed to save exam marks: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isMultiExcelMode = examMode === 'multi-excel';

  const hasBulkExcelData = (examMode === 'excel' || examMode === 'multi-excel')
    && excelBulkUpload
    && excelBulkUpload.examType === examData.examType
    && Array.isArray(excelBulkUpload.exams)
    && excelBulkUpload.exams.length > 0;

  return (
    <div className="add-exam">
      {isSaving && (
        <div className="save-overlay" role="status" aria-live="assertive" aria-busy="true">
          <div className="save-overlay-card">
            <div className="save-overlay-spinner" />
            <p>Saving marks to database...</p>
          </div>
        </div>
      )}

      <div className="add-exam-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Add New Exam - {batch.name}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Exam Details Section */}
        {examMode !== 'multi-excel' && (
        <div className="form-section">
          <h3>Exam Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Exam Name *</label>
              <input
                type="text"
                name="examName"
                value={examData.examName}
                onChange={handleExamDataChange}
                placeholder="e.g., Mid Term 1"
                required
              />
            </div>

            <div className="form-group">
              <label>Exam Date *</label>
              <input
                type="date"
                name="examDate"
                value={examData.examDate}
                onChange={handleExamDataChange}
                required={!hasBulkExcelData}
              />
              {hasBulkExcelData && <small className="note">Using dates from uploaded Excel rows.</small>}
            </div>

            <div className="form-group">
              <label>Exam Type *</label>
              <select
                name="examType"
                value={examData.examType}
                onChange={handleExamDataChange}
                required
              >
                <option value="">Select Type</option>
                <option value="daily test">Unit Test</option>
                <option value="mock test">Monthly Test</option>
              </select>
            </div>

            {/* Unit Test Fields */}
            {examData.examType === 'daily test' && (
              <>
                <div className="form-group">
                  <label>Subject *</label>
                  <select
                    name="subject"
                    value={examData.subject}
                    onChange={handleExamDataChange}
                    required={!hasBulkExcelData && !isMultiExcelMode}
                  >
                    <option value="">Select Subject</option>
                    {dailySubjectOptions.map((subjectOption) => (
                      <option key={subjectOption} value={subjectOption}>{subjectOption}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Unit Name *</label>
                  <input
                    type="text"
                    name="unitName"
                    value={examData.unitName}
                    onChange={handleExamDataChange}
                    placeholder="e.g., Unit 1 - Mechanics"
                    required={!hasBulkExcelData && !isMultiExcelMode}
                  />
                </div>

                <div className="form-group">
                  <label>Subject Total Marks *</label>
                  <input
                    type="number"
                    name="dailySubjectTotalMarks"
                    value={examData.dailySubjectTotalMarks}
                    onChange={handleExamDataChange}
                    placeholder="e.g., 100"
                    min="1"
                    required={!hasBulkExcelData && !isMultiExcelMode}
                  />
                </div>

                <div className="form-group">
                  <label>Test Total Marks *</label>
                  <input
                    type="number"
                    name="dailyTestTotalMarks"
                    value={examData.dailyTestTotalMarks}
                    onChange={handleExamDataChange}
                    placeholder="e.g., 100"
                    min="1"
                    required={!hasBulkExcelData && !isMultiExcelMode}
                  />
                </div>
              </>
            )}

            {/* Monthly Test Fields */}
            {examData.examType === 'mock test' && (
              <>
                {activeMockSubjects.map(subject => (
                  <div className="form-group" key={subject.key}>
                    <label>{subject.label} Unit Names *</label>
                    <input
                      type="text"
                      name={subject.unitField}
                      value={examData[subject.unitField]}
                      onChange={handleExamDataChange}
                      placeholder="e.g., Unit 1, Unit 2"
                      required={!hasBulkExcelData && !isMultiExcelMode}
                    />
                  </div>
                ))}
                {activeMockSubjects.map(subject => (
                  <div className="form-group" key={`${subject.key}-total`}>
                    <label>{subject.label} Total Marks *</label>
                    <input
                      type="number"
                      name={subject.totalField}
                      value={examData[subject.totalField]}
                      onChange={handleExamDataChange}
                      placeholder={`e.g., ${subject.key === 'maths' ? '100' : '75'}`}
                      min="1"
                      required={!hasBulkExcelData && !isMultiExcelMode}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label>Overall Test Total Marks *</label>
                  <input
                    type="number"
                    name="mockTestTotalMarks"
                    value={examData.mockTestTotalMarks}
                    onChange={handleExamDataChange}
                    placeholder="e.g., 400"
                    min="1"
                    required={!hasBulkExcelData && !isMultiExcelMode}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {/* Entry Mode Selection */}
        <div className="form-section">
          <h3>Marks Entry Mode</h3>
          <div className="mode-selector">
            <button
              type="button"
              className={`mode-btn ${examMode === 'manual' ? 'active' : ''}`}
              onClick={() => setExamMode('manual')}
            >
              ✏️ Manual Entry
            </button>
            <button
              type="button"
              className={`mode-btn ${examMode === 'excel' ? 'active' : ''}`}
              onClick={() => setExamMode('excel')}
            >
              📊 Excel Upload
            </button>
            <button
              type="button"
              className={`mode-btn ${examMode === 'multi-excel' ? 'active' : ''}`}
              onClick={() => setExamMode('multi-excel')}
            >
              📚 Multiple Upload
            </button>
            <button
              type="button"
              className={`mode-btn ${examMode === 'manage' ? 'active' : ''}`}
              onClick={() => setExamMode('manage')}
            >
              🛠 Modify / Delete
            </button>
          </div>
        </div>

        {examMode === 'manage' && (
          <div className="form-section">
            <h3>Modify or Delete Entered Marks</h3>
            <ManageExamMarks batchId={batch.batch_id} />
          </div>
        )}

        {/* Manual Entry Mode */}
        {examMode === 'manual' && examData.examType && (
          <div className="form-section">
            <h3>Enter Marks for Students</h3>
            <div className="marks-entry-table">
              {examData.examType === 'daily test' ? (
                <table>
                  <thead>
                    <tr>
                      <th>Admission Number</th>
                      <th>Student Name</th>
                      <th>Marks (out of {examData.dailySubjectTotalMarks || '___'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentMarks.map(student => (
                      <tr key={student.id}>
                        <td>{student.rollNo}</td>
                        <td>{student.name}</td>
                        <td>
                          <input
                            type="text"
                            value={student.marks}
                            onChange={(e) => handleMarksChange(student.id, 'marks', e.target.value)}
                            placeholder="e.g. 85, A, -"
                            className="marks-input"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Admission Number</th>
                      <th>Student Name</th>
                      {activeMockSubjects.map(subject => (
                        <th key={subject.key}>{subject.label} (out of {examData[subject.totalField] || '___'})</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentMarks.map(student => (
                      <tr key={student.id}>
                        <td>{student.rollNo}</td>
                        <td>{student.name}</td>
                        {activeMockSubjects.map(subject => (
                          <td key={`${student.id}-${subject.key}`}>
                            <input
                              type="text"
                              value={student[subject.marksField]}
                              onChange={(e) => handleMarksChange(student.id, subject.marksField, e.target.value)}
                              placeholder={subject.label}
                              className="marks-input"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Excel Upload Mode */}
        {examMode === 'excel' && examData.examType && (
          <div className="form-section">
            <h3>Excel Upload</h3>
            <div className="excel-upload-section">
              <p className="instruction">
                Download the Excel format, fill in the marks, and upload the completed file.
              </p>

              <div className="upload-steps">
                <div className="step">
                  <span className="step-number">1</span>
                  <button
                    type="button"
                    className="btn-download"
                    onClick={handleDownloadFormat}
                    disabled={!examData.examName || (examData.examType === 'daily test' && !examData.dailySubjectTotalMarks)}
                  >
                    📥 Download Excel Format
                  </button>
                  {(!examData.examName || (examData.examType === 'daily test' && !examData.dailySubjectTotalMarks)) && (
                    <small className="note">Fill exam details first</small>
                  )}
                </div>

                <div className="step">
                  <span className="step-number">2</span>
                  <div className="file-upload">
                    <input
                      type="file"
                      id="excelFile"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="excelFile" className="upload-label">
                      📤 Upload Completed Excel
                    </label>
                  </div>
                </div>
              </div>

              {/* Preview uploaded data */}
              <div className="preview-section">
                <h4>Preview Data</h4>
                {hasBulkExcelData ? (
                  <div className="instruction" style={{ marginBottom: '10px' }}>
                    Loaded <strong>{excelBulkUpload.exams.length}</strong> {examData.examType} entries from Excel.
                    Dates{examData.examType === 'daily test' ? ', subjects, and topics' : ''} are taken directly from the sheet.
                  </div>
                ) : (
                  <div className="marks-entry-table">
                    {examData.examType === 'daily test' ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Admission Number</th>
                          <th>Student Name</th>
                          <th>Marks (out of {examData.dailySubjectTotalMarks || '___'})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentMarks.map(student => (
                          <tr key={student.id}>
                            <td>{student.rollNo}</td>
                            <td>{student.name}</td>
                            <td>
                              {student.marks
                                ? `${student.marks}/${examData.dailySubjectTotalMarks || '___'}`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Admission Number</th>
                          <th>Student Name</th>
                          {activeMockSubjects.map(subject => (
                            <th key={subject.key}>{subject.label} (out of {examData[subject.totalField] || '___'})</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {studentMarks.map(student => (
                          <tr key={student.id}>
                            <td>{student.rollNo}</td>
                            <td>{student.name}</td>
                            {activeMockSubjects.map(subject => (
                              <td key={`${student.id}-${subject.key}`}>
                                {student[subject.marksField]
                                  ? `${student[subject.marksField]}/${examData[subject.totalField] || '___'}`
                                  : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Multiple Excel Upload Mode */}
        {examMode === 'multi-excel' && (
          <div className="form-section">
            <h3>Multiple Upload (Excel)</h3>
            <div className="excel-upload-section">
              <div className="form-grid">
                <div className="form-group">
                  <label>Exam Type *</label>
                  <select
                    name="examType"
                    value={examData.examType}
                    onChange={handleExamDataChange}
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="daily test">Unit Test</option>
                    <option value="mock test">Monthly Test</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>How many tests to upload? *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={multiUploadCount}
                    onChange={(e) => setMultiUploadCount(e.target.value)}
                    placeholder="e.g., 5"
                    required
                  />
                </div>
              </div>

              <p className="instruction">
                Use this section to upload multiple exams in one file.
                For Unit Test, fill <strong>Exam Date + Subject + Topic / Unit Name</strong> in each row.
                For Monthly Test, fill <strong>Exam Date</strong> in each row.
              </p>

              <div className="upload-steps">
                <div className="step">
                  <span className="step-number">1</span>
                  <button
                    type="button"
                    className="btn-download"
                    onClick={handleDownloadFormat}
                    disabled={!examData.examType || !multiUploadCount || Number(multiUploadCount) < 1}
                  >
                    📥 Download Multi Upload Template
                  </button>
                </div>

                <div className="step">
                  <span className="step-number">2</span>
                  <div className="file-upload">
                    <input
                      type="file"
                      id="multiExcelFile"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="multiExcelFile" className="upload-label">
                      📤 Upload Multiple Exams Excel
                    </label>
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <h4>Multiple Upload Preview</h4>
                {hasBulkExcelData ? (
                  <div className="instruction" style={{ marginBottom: '10px' }}>
                    Loaded <strong>{excelBulkUpload.exams.length}</strong> {examData.examType} entries.
                    Click <strong>Save Exam Marks</strong> to upload all entries in one request.
                  </div>
                ) : (
                  <div className="instruction" style={{ marginBottom: '10px' }}>
                    Upload a prepared Excel file to preview grouped exams.
                  </div>
                )}

                {uploadLogs.length > 0 && (
                  <div className="upload-error-logs">
                    <h5>Upload Error Logs</h5>
                    <ul>
                      {uploadLogs.map((log, idx) => (
                        <li key={`multi-upload-log-${idx}`}>{log}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        {examMode !== 'manage' && (
          <>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={onBack} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={isSaving}>
                {isSaving ? 'Saving Marks...' : (examMode === 'multi-excel' ? 'Upload Multiple Exams' : 'Save Exam Marks')}
              </button>
            </div>
 
            {isSaving && (
              <div className="save-progress-container" role="status" aria-live="polite">
                <div className="save-progress-label">Saving marks to database, please wait...</div>
                <div className="save-progress-track">
                  <div className="save-progress-bar" />
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
};

export default AddExam;
