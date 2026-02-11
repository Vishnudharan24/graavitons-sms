import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './AddExam.css';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';

const AddExam = ({ batch, students, onBack, onSave }) => {
  const [examMode, setExamMode] = useState('manual'); // 'manual' or 'excel'
  const [examData, setExamData] = useState({
    examName: '',
    examDate: '',
    subject: '',
    unitName: '',
    totalMarks: '',
    examType: '',
    // For mock test
    mathsUnitNames: '',
    physicsUnitNames: '',
    biologyUnitNames: '',
    chemistryUnitNames: ''
  });

  // Initialize marks for all students
  const [studentMarks, setStudentMarks] = useState(
    students.map(student => ({
      id: student.id,
      name: student.name,
      rollNo: student.rollNo,
      // For daily test
      marks: '',
      // For mock test
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
      if (value === 'daily test') {
        setExamData(prev => ({
          ...prev,
          examType: value,
          mathsUnitNames: '',
          physicsUnitNames: '',
          biologyUnitNames: '',
          chemistryUnitNames: ''
        }));
      } else if (value === 'mock test') {
        setExamData(prev => ({
          ...prev,
          examType: value,
          subject: '',
          unitName: ''
        }));
      }
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
        const totalMarks = examData.totalMarks || 100;
        apiUrl = `${API_BASE}/api/exam/template/daily-test/${batch.batch_id}?total_marks=${totalMarks}`;
      } else if (examData.examType === 'mock test') {
        apiUrl = `${API_BASE}/api/exam/template/mock-test/${batch.batch_id}`;
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
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          let data;
          const fileName = file.name.toLowerCase();

          if (fileName.endsWith('.csv')) {
            // Handle CSV files
            const text = event.target.result;
            const rows = text.split('\n').slice(1); // Skip header

            if (examData.examType === 'daily test') {
              const updatedMarks = studentMarks.map(student => {
                const row = rows.find(r => r.startsWith(student.rollNo));
                if (row) {
                  const marks = row.split(',')[2]?.trim();
                  return { ...student, marks: marks || '' };
                }
                return student;
              });
              setStudentMarks(updatedMarks);
            } else if (examData.examType === 'mock test') {
              const updatedMarks = studentMarks.map(student => {
                const row = rows.find(r => r.startsWith(student.rollNo));
                if (row) {
                  const parts = row.split(',');
                  return { 
                    ...student, 
                    mathsMarks: parts[2]?.trim() || '',
                    physicsMarks: parts[3]?.trim() || '',
                    biologyMarks: parts[4]?.trim() || '',
                    chemistryMarks: parts[5]?.trim() || ''
                  };
                }
                return student;
              });
              setStudentMarks(updatedMarks);
            }
          } else {
            // Handle Excel files (.xlsx, .xls)
            const workbook = XLSX.read(event.target.result, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            // Skip header row
            const rows = jsonData.slice(1);

            if (examData.examType === 'daily test') {
              const updatedMarks = studentMarks.map(student => {
                const row = rows.find(r => r[0] === student.rollNo);
                if (row) {
                  const marks = row[2]?.toString().trim();
                  return { ...student, marks: marks || '' };
                }
                return student;
              });
              setStudentMarks(updatedMarks);
            } else if (examData.examType === 'mock test') {
              const updatedMarks = studentMarks.map(student => {
                const row = rows.find(r => r[0] === student.rollNo);
                if (row) {
                  return { 
                    ...student, 
                    mathsMarks: row[2]?.toString().trim() || '',
                    physicsMarks: row[3]?.toString().trim() || '',
                    biologyMarks: row[4]?.toString().trim() || '',
                    chemistryMarks: row[5]?.toString().trim() || ''
                  };
                }
                return student;
              });
              setStudentMarks(updatedMarks);
            }
          }

          alert('Marks uploaded successfully!');
        } catch (error) {
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

    // Validate
    if (!examData.examName || !examData.examDate || !examData.examType) {
      alert('Please fill all required exam details');
      return;
    }

    // Validate based on exam type
    if (examData.examType === 'daily test') {
      if (!examData.subject || !examData.unitName || !examData.totalMarks) {
        alert('Please fill subject, unit name, and total marks for daily test');
        return;
      }
      
      const hasEmptyMarks = studentMarks.some(student => student.marks === '');
      if (hasEmptyMarks) {
        if (!window.confirm('Some students have no marks entered. Continue anyway?')) {
          return;
        }
      }
    } else if (examData.examType === 'mock test') {
      if (!examData.mathsUnitNames || !examData.physicsUnitNames || 
          !examData.biologyUnitNames || !examData.chemistryUnitNames) {
        alert('Please fill unit names for all subjects in mock test');
        return;
      }
      
      const hasEmptyMarks = studentMarks.some(student => 
        student.mathsMarks === '' || student.physicsMarks === '' || 
        student.biologyMarks === '' || student.chemistryMarks === ''
      );
      if (hasEmptyMarks) {
        if (!window.confirm('Some students have incomplete marks. Continue anyway?')) {
          return;
        }
      }
    }

    // Prepare data for API call
    try {
      let apiUrl = '';
      let requestData = {};

      if (examData.examType === 'daily test') {
        apiUrl = `${API_BASE}/api/exam/daily-test`;
        requestData = {
          batch_id: batch.batch_id,
          examName: examData.examName,
          examDate: examData.examDate,
          subject: examData.subject,
          unitName: examData.unitName,
          totalMarks: parseInt(examData.totalMarks),
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
          mathsUnitNames: examData.mathsUnitNames,
          physicsUnitNames: examData.physicsUnitNames,
          chemistryUnitNames: examData.chemistryUnitNames,
          biologyUnitNames: examData.biologyUnitNames,
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
    }
  };

  return (
    <div className="add-exam">
      <div className="add-exam-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Add New Exam - {batch.name}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Exam Details Section */}
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
                required
              />
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
                <option value="daily test">Daily Test</option>
                <option value="mock test">Mock Test</option>
              </select>
            </div>

            {/* Daily Test Fields */}
            {examData.examType === 'daily test' && (
              <>
                <div className="form-group">
                  <label>Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={examData.subject}
                    onChange={handleExamDataChange}
                    placeholder="e.g., Physics"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Unit Name *</label>
                  <input
                    type="text"
                    name="unitName"
                    value={examData.unitName}
                    onChange={handleExamDataChange}
                    placeholder="e.g., Unit 1 - Mechanics"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Total Marks *</label>
                  <input
                    type="number"
                    name="totalMarks"
                    value={examData.totalMarks}
                    onChange={handleExamDataChange}
                    placeholder="e.g., 100"
                    required
                  />
                </div>
              </>
            )}

            {/* Mock Test Fields */}
            {examData.examType === 'mock test' && (
              <>
                <div className="form-group">
                  <label>Maths Unit Names *</label>
                  <input
                    type="text"
                    name="mathsUnitNames"
                    value={examData.mathsUnitNames}
                    onChange={handleExamDataChange}
                    placeholder="e.g., Unit 1, Unit 2"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Physics Unit Names *</label>
                  <input
                    type="text"
                    name="physicsUnitNames"
                    value={examData.physicsUnitNames}
                    onChange={handleExamDataChange}
                    placeholder="e.g., Unit 1, Unit 2"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Chemistry Unit Names *</label>
                  <input
                    type="text"
                    name="chemistryUnitNames"
                    value={examData.chemistryUnitNames}
                    onChange={handleExamDataChange}
                    placeholder="e.g., Unit 1, Unit 2"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Biology Unit Names *</label>
                  <input
                    type="text"
                    name="biologyUnitNames"
                    value={examData.biologyUnitNames}
                    onChange={handleExamDataChange}
                    placeholder="e.g., Unit 1, Unit 2"
                    required
                  />
                </div>
              </>
            )}
          </div>
        </div>

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
          </div>
        </div>

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
                      <th>Marks (out of {examData.totalMarks || '___'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentMarks.map(student => (
                      <tr key={student.id}>
                        <td>{student.rollNo}</td>
                        <td>{student.name}</td>
                        <td>
                          <input
                            type="number"
                            value={student.marks}
                            onChange={(e) => handleMarksChange(student.id, 'marks', e.target.value)}
                            min="0"
                            max={examData.totalMarks || 100}
                            placeholder="Enter marks"
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
                      <th>Maths</th>
                      <th>Physics</th>
                      <th>Chemistry</th>
                      <th>Biology</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentMarks.map(student => (
                      <tr key={student.id}>
                        <td>{student.rollNo}</td>
                        <td>{student.name}</td>
                        <td>
                          <input
                            type="number"
                            value={student.mathsMarks}
                            onChange={(e) => handleMarksChange(student.id, 'mathsMarks', e.target.value)}
                            min="0"
                            placeholder="Maths"
                            className="marks-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={student.physicsMarks}
                            onChange={(e) => handleMarksChange(student.id, 'physicsMarks', e.target.value)}
                            min="0"
                            placeholder="Physics"
                            className="marks-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={student.chemistryMarks}
                            onChange={(e) => handleMarksChange(student.id, 'chemistryMarks', e.target.value)}
                            min="0"
                            placeholder="Chemistry"
                            className="marks-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={student.biologyMarks}
                            onChange={(e) => handleMarksChange(student.id, 'biologyMarks', e.target.value)}
                            min="0"
                            placeholder="Biology"
                            className="marks-input"
                          />
                        </td>
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
                    disabled={!examData.examName || (examData.examType === 'daily test' && !examData.totalMarks)}
                  >
                    📥 Download Excel Format
                  </button>
                  {(!examData.examName || (examData.examType === 'daily test' && !examData.totalMarks)) && (
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
                <div className="marks-entry-table">
                  {examData.examType === 'daily test' ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Admission Number</th>
                          <th>Student Name</th>
                          <th>Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentMarks.map(student => (
                          <tr key={student.id}>
                            <td>{student.rollNo}</td>
                            <td>{student.name}</td>
                            <td>{student.marks || '-'}</td>
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
                          <th>Maths</th>
                          <th>Physics</th>
                          <th>Biology</th>
                          <th>Chemistry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentMarks.map(student => (
                          <tr key={student.id}>
                            <td>{student.rollNo}</td>
                            <td>{student.name}</td>
                            <td>{student.mathsMarks || '-'}</td>
                            <td>{student.physicsMarks || '-'}</td>
                            <td>{student.biologyMarks || '-'}</td>
                            <td>{student.chemistryMarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onBack}>
            Cancel
          </button>
          <button type="submit" className="btn-submit">
            Save Exam Marks
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddExam;
