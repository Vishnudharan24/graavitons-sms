import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import StudentProfile from './StudentProfile';
import AddStudent from './AddStudent';
import AddExam from './AddExam';
import BatchPerformance from './BatchPerformance';
import './BatchDetail.css';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';

const BatchDetail = ({ batch, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedCommunity, setSelectedCommunity] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditFile, setBulkEditFile] = useState(null);
  const [bulkEditResult, setBulkEditResult] = useState(null);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  const [students, setStudents] = useState([]);

  // Fetch students when component mounts or when batch changes
  useEffect(() => {
    if (batch && batch.batch_id) {
      fetchStudents();
    }
  }, [batch?.batch_id]);

  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await authFetch(`${API_BASE}/api/student/batch/${batch.batch_id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch students: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform API data to match component's expected format
      const transformedStudents = data.students.map((student, index) => ({
        id: index + 1,
        rollNo: student.student_id,
        name: student.student_name,
        gender: student.gender || 'N/A',
        dob: student.dob,
        community: student.community,
        grade: student.grade,
        enrollment_year: student.enrollment_year,
        course: student.course,
        branch: student.branch,
        student_mobile: student.student_mobile,
        email: student.email
      }));
      
      setStudents(transformedStudents);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique communities for the filter dropdown
  const uniqueCommunities = [...new Set(students.map(s => s.community).filter(Boolean))];

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'all' ||
      (selectedFilter === 'male' && student.gender === 'Male') ||
      (selectedFilter === 'female' && student.gender === 'Female');
    const matchesCommunity = selectedCommunity === 'all' || student.community === selectedCommunity;
    return matchesSearch && matchesFilter && matchesCommunity;
  });

  const handleDownloadFormat = () => {
    alert('Downloading exam format template...');
  };

  const handleUploadMarks = () => {
    alert('Upload exam marks feature');
  };

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
  };

  const handleBackToStudents = () => {
    setSelectedStudent(null);
  };

  const handleAddStudent = () => {
    setShowAddStudent(true);
  };

  const handleBackFromAddStudent = () => {
    setShowAddStudent(false);
  };

  const handleSaveStudent = (studentData) => {
    console.log('Student data saved:', studentData);
    // Refresh student list from API after adding/editing student
    fetchStudents();
    setShowAddStudent(false);
    setShowEditStudent(false);
  };
  
  const handleEditStudent = (student) => {
    setShowEditStudent(student);
  };

  // ── Bulk Edit via Excel ──
  const handleDownloadEditTemplate = async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/student/edit-template/${batch.batch_id}`);
      if (!response.ok) throw new Error('Failed to download template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(batch.batch_name || 'Batch').replace(/\s+/g, '_')}_Edit_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template error:', err);
      alert('Failed to download edit template. Please try again.');
    }
  };

  const handleBulkEditFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setBulkEditFile(file);
    } else if (file) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      e.target.value = '';
    }
  };

  const handleBulkEditUpload = async () => {
    if (!bulkEditFile) return;
    setBulkEditLoading(true);
    setBulkEditResult(null);
    try {
      const formData = new FormData();
      formData.append('file', bulkEditFile);
      formData.append('batch_id', batch.batch_id);

      const response = await authFetch(`${API_BASE}/api/student/upload-update`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Upload failed');
      }

      const result = await response.json();
      setBulkEditResult(result);

      if (result.success_count > 0) {
        fetchStudents(); // refresh list
      }
    } catch (err) {
      console.error('Bulk edit error:', err);
      setBulkEditResult({ error: err.message });
    } finally {
      setBulkEditLoading(false);
    }
  };

  const handleAddExam = () => {
    setShowAddExam(true);
  };

  const handleBackFromAddExam = () => {
    setShowAddExam(false);
  };

  const handleSaveExam = (examData) => {
    console.log('New exam data:', examData);
    // Here you would typically send the data to your backend API
  };

  const [reportLoading, setReportLoading] = useState(false);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/api/exam/batch-report/${batch.batch_id}`);
      if (!response.ok) throw new Error('Failed to fetch batch report data');
      const data = await response.json();

      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Batch Summary ──
      const batchSummary = [
        ['BATCH REPORT'],
        [''],
        ['Batch Name', data.batch.batch_name],
        ['Batch Type', data.batch.type || 'N/A'],
        ['Academic Year', `${data.batch.start_year} - ${data.batch.end_year}`],
        [''],
        ['Total Students', data.total_students],
        ['Boys', data.students.filter(s => s.gender === 'Male').length],
        ['Girls', data.students.filter(s => s.gender === 'Female').length],
        [''],
        ['Total Daily Tests Conducted', data.total_daily_tests_conducted],
        ['Total Mock Tests Conducted', data.total_mock_tests_conducted],
        [''],
        ['Report Generated On', new Date().toLocaleString()],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(batchSummary);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Batch Summary');

      // ── Sheet 2: Student Details ──
      const studentHeaders = [
        'S.No', 'Admission No', 'Student Name', 'Gender', 'Date of Birth',
        'Community', 'Grade', 'Enrollment Year', 'Course', 'Branch',
        'Mobile', 'Email', 'Daily Tests Attended', 'Mock Tests Attended'
      ];
      const studentRows = data.students.map((s, i) => [
        i + 1,
        s.student_id,
        s.student_name,
        s.gender || 'N/A',
        s.dob || 'N/A',
        s.community || 'N/A',
        s.grade || 'N/A',
        s.enrollment_year || 'N/A',
        s.course || 'N/A',
        s.branch || 'N/A',
        s.student_mobile || 'N/A',
        s.email || 'N/A',
        s.daily_test_count,
        s.mock_test_count,
      ]);
      const wsStudents = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
      wsStudents['!cols'] = studentHeaders.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsStudents, 'Student Details');

      // ── Sheet 3: Daily Tests ──
      const dailyHeaders = [
        'S.No', 'Admission No', 'Student Name', 'Test Date',
        'Subject', 'Unit Name', 'Marks Obtained'
      ];
      const dailyRows = (data.daily_tests || []).map((t, i) => [
        i + 1,
        t.student_id,
        t.student_name,
        t.test_date || 'N/A',
        t.subject || 'N/A',
        t.unit_name || 'N/A',
        t.total_marks != null ? t.total_marks : 'N/A',
      ]);
      const wsDaily = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
      wsDaily['!cols'] = dailyHeaders.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Tests');

      // ── Sheet 4: Mock Tests ──
      const mockHeaders = [
        'S.No', 'Admission No', 'Student Name', 'Test Date',
        'Maths', 'Physics', 'Chemistry', 'Biology', 'Total Marks'
      ];
      const mockRows = (data.mock_tests || []).map((t, i) => [
        i + 1,
        t.student_id,
        t.student_name,
        t.test_date || 'N/A',
        t.maths_marks != null ? t.maths_marks : 'N/A',
        t.physics_marks != null ? t.physics_marks : 'N/A',
        t.chemistry_marks != null ? t.chemistry_marks : 'N/A',
        t.biology_marks != null ? t.biology_marks : 'N/A',
        t.total_marks != null ? t.total_marks : 'N/A',
      ]);
      const wsMock = XLSX.utils.aoa_to_sheet([mockHeaders, ...mockRows]);
      wsMock['!cols'] = mockHeaders.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, wsMock, 'Mock Tests');

      // ── Download ──
      const dateStr = new Date().toISOString().split('T')[0];
      const batchName = (data.batch.batch_name || 'Batch').replace(/\s+/g, '_');
      XLSX.writeFile(wb, `${batchName}_Report_${dateStr}.xlsx`);

    } catch (err) {
      console.error('Report generation failed:', err);
      alert('Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  if (showAddExam) {
    return <AddExam batch={batch} students={students} onBack={handleBackFromAddExam} onSave={handleSaveExam} />;
  }

  if (showEditStudent) {
    return (
      <AddStudent 
        batch={batch} 
        onBack={() => setShowEditStudent(false)} 
        onSave={handleSaveStudent}
        editMode={true}
        studentId={showEditStudent.rollNo}
      />
    );
  }

  if (showAddStudent) {
    return <AddStudent batch={batch} onBack={handleBackFromAddStudent} onSave={handleSaveStudent} />;
  }

  if (showBulkEdit) {
    return (
      <div className="batch-detail">
        <div className="batch-header">
          <button className="back-button" onClick={() => { setShowBulkEdit(false); setBulkEditFile(null); setBulkEditResult(null); }}>← Back</button>
          <h2>✏️ Bulk Edit Students — {batch.batch_name}</h2>
        </div>

        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
          {/* Step 1: Download */}
          <div style={{ background: '#f0f4ff', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px' }}>Step 1: Download Current Data</h3>
            <p style={{ color: '#4a5568', margin: '0 0 15px' }}>
              Download an Excel file pre-filled with all existing student data for this batch. Edit the cells you want to update.
            </p>
            <button
              onClick={handleDownloadEditTemplate}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                boxShadow: '0 2px 6px rgba(56,161,105,0.3)',
              }}
            >
              📥 Download Edit Template
            </button>
          </div>

          {/* Step 2: Upload */}
          <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px' }}>Step 2: Upload Edited File</h3>
            <p style={{ color: '#4a5568', margin: '0 0 15px' }}>
              Upload the edited Excel file. Only non-empty cells will be updated — blank cells are skipped so existing data is preserved.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleBulkEditFileChange}
              disabled={bulkEditLoading}
              style={{
                padding: '10px', border: '2px dashed #cbd5e0',
                borderRadius: '8px', width: '100%', cursor: 'pointer', marginBottom: '10px',
              }}
            />
            {bulkEditFile && (
              <p style={{ color: '#5b5fc7', fontWeight: '600', margin: '5px 0 15px' }}>
                Selected: {bulkEditFile.name} ({(bulkEditFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <button
              onClick={handleBulkEditUpload}
              disabled={bulkEditLoading || !bulkEditFile}
              style={{
                padding: '10px 20px',
                background: bulkEditLoading || !bulkEditFile
                  ? '#cbd5e0'
                  : 'linear-gradient(135deg, #5b5fc7 0%, #4347a0 100%)',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: bulkEditLoading || !bulkEditFile ? 'not-allowed' : 'pointer',
                fontWeight: '600', fontSize: '14px',
              }}
            >
              {bulkEditLoading ? '⏳ Updating...' : '📤 Upload & Update Students'}
            </button>
          </div>

          {/* Results */}
          {bulkEditResult && (
            <div style={{
              borderRadius: '12px', padding: '20px',
              background: bulkEditResult.error
                ? '#fee'
                : bulkEditResult.error_count === 0 ? '#d4edda' : '#fff3cd',
              color: bulkEditResult.error
                ? '#c00'
                : bulkEditResult.error_count === 0 ? '#155724' : '#856404',
              border: `1px solid ${bulkEditResult.error ? '#fcc' : bulkEditResult.error_count === 0 ? '#c3e6cb' : '#ffeaa7'}`,
            }}>
              {bulkEditResult.error ? (
                <p><strong>Error:</strong> {bulkEditResult.error}</p>
              ) : (
                <>
                  <h4 style={{ margin: '0 0 10px' }}>Update Results</h4>
                  <p style={{ margin: '5px 0' }}>✅ Successfully updated: <strong>{bulkEditResult.success_count}</strong> students</p>
                  {bulkEditResult.skipped_count > 0 && (
                    <p style={{ margin: '5px 0' }}>⏭️ Skipped: <strong>{bulkEditResult.skipped_count}</strong> rows</p>
                  )}
                  {bulkEditResult.error_count > 0 && (
                    <>
                      <p style={{ margin: '5px 0' }}>❌ Errors: <strong>{bulkEditResult.error_count}</strong></p>
                      {bulkEditResult.errors && bulkEditResult.errors.length > 0 && (
                        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                          {bulkEditResult.errors.map((err, idx) => (
                            <li key={idx}>Row {err.row} — {err.student_id}: {err.error}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Instructions */}
          <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 10px' }}>📋 How it works</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#4a5568', lineHeight: '1.8' }}>
              <li>The <strong>student_id</strong> column identifies each student — do not change it.</li>
              <li>Edit any other cell to update that field.</li>
              <li>Leave a cell <strong>blank</strong> to keep the existing value — it will not be erased.</li>
              <li>You can delete columns you don't want to edit.</li>
              <li>The file is accepted even if some data is missing.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (selectedStudent) {
    return <StudentProfile student={selectedStudent} onBack={handleBackToStudents} />;
  }

  return (
    <div className="batch-detail">
      <div className="batch-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>{batch.batch_name || batch.name}</h2>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '8px',
          margin: '20px 0',
          border: '1px solid #fcc'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Batch Topics */}
      {batch.subjects && batch.subjects.length > 0 && (
        <div className="batch-topics">
          <h3>Batch Subjects</h3>
          <div className="topics-list">
            {batch.subjects.map((subject, index) => (
              <span key={index} className="topic-tag">{subject}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="batch-tabs">
        <button
          className={`batch-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👥 Students
        </button>
        <button
          className={`batch-tab ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          📊 Performance
        </button>
      </div>

      {/* Students Tab */}
      {activeTab === 'students' && (
        <>
          {/* Student Management Buttons */}
          <div className="management-buttons">
            <button className="btn btn-primary" onClick={handleAddStudent}>+ Add New Student</button>
            <button className="btn btn-secondary" onClick={() => setShowBulkEdit(true)} style={{ backgroundColor: '#f59e0b', color: 'white' }}>✏️ Bulk Edit via Excel</button>
            <button className="btn btn-secondary" onClick={handleAddExam}>+ New Exam</button>
            <button className="btn btn-report" onClick={handleGenerateReport} disabled={reportLoading}>
              {reportLoading ? '⏳ Generating...' : '📊 Generate Batch Report'}
            </button>
          </div>

          {/* Student List */}
          <div className="student-list-section">
            <div className="section-header">
              <h3>Student List</h3>
              <div className="list-controls">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Students</option>
                  <option value="male">Boys</option>
                  <option value="female">Girls</option>
                </select>
                <select
                  value={selectedCommunity}
                  onChange={(e) => setSelectedCommunity(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Communities</option>
                  {uniqueCommunities.map((community, index) => (
                    <option key={index} value={community}>{community}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="student-table">
              <table>
                <thead>
                  <tr>
                    <th>Admission Number</th>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                        Loading students...
                      </td>
                    </tr>
                  ) : filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                      <tr key={student.id}>
                        <td>{student.rollNo}</td>
                        <td>{student.name}</td>
                        <td>{student.gender}</td>
                        <td>
                          <button className="btn-action" onClick={() => handleViewStudent(student)} style={{ marginRight: '5px' }}>View</button>
                          <button className="btn-action" onClick={() => handleEditStudent(student)} style={{ backgroundColor: '#f59e0b' }}>Edit</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#718096' }}>
                        No students found. Click "Add New Student" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <BatchPerformance batch={batch} />
      )}
    </div>
  );
};

export default BatchDetail;
