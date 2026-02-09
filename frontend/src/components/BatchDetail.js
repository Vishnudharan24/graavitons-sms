import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import StudentProfile from './StudentProfile';
import AddStudent from './AddStudent';
import AddExam from './AddExam';
import './BatchDetail.css';

const BatchDetail = ({ batch, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data states - to be fetched from API
  const [analyticsData, setAnalyticsData] = useState({
    totalStudents: 0,
    boys: 0,
    girls: 0,
    batchTopics: [],
    totalExams: 0
  });

  const [examPerformanceData, setExamPerformanceData] = useState([]);
  const [subjectAnalysisData, setSubjectAnalysisData] = useState([]);
  const [students, setStudents] = useState([]);

  // Fetch students when component mounts or when batch changes
  useEffect(() => {
    if (batch && batch.batch_id) {
      fetchStudents();
    }
  }, [batch?.batch_id]);

  // Update analytics when students data changes
  useEffect(() => {
    if (students.length > 0) {
      const boys = students.filter(s => s.gender === 'Male').length;
      const girls = students.filter(s => s.gender === 'Female').length;
      
      setAnalyticsData(prev => ({
        ...prev,
        totalStudents: students.length,
        boys: boys,
        girls: girls
      }));
    }
  }, [students]);

  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/student/batch/${batch.batch_id}`);
      
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
        marks: 0, // TODO: Fetch from exam results when available
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

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'all' ||
      (selectedFilter === 'male' && student.gender === 'Male') ||
      (selectedFilter === 'female' && student.gender === 'Female');
    return matchesSearch && matchesFilter;
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
      const response = await fetch(`http://localhost:8000/api/exam/batch-report/${batch.batch_id}`);
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

  if (selectedStudent) {
    // Calculate batch statistics for the graph
    const marks = students.map(s => s.marks);
    const topMark = Math.max(...marks);
    const averageMark = marks.reduce((a, b) => a + b, 0) / marks.length;

    const batchStats = {
      topMark,
      averageMark,
      studentMark: selectedStudent.marks
    };

    return <StudentProfile student={selectedStudent} batchStats={batchStats} onBack={handleBackToStudents} />;
  }

  return (
    <div className="batch-detail">
      <div className="batch-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>{batch.batch_name || batch.name}</h2>
      </div>

      {/* Analytics Box */}
      <div className="analytics-box">
        <div className="analytics-card">
          <h3>Total Students</h3>
          <p className="analytics-value">{loading ? '...' : analyticsData.totalStudents}</p>
        </div>
        <div className="analytics-card">
          <h3>Boys</h3>
          <p className="analytics-value">{loading ? '...' : analyticsData.boys}</p>
        </div>
        <div className="analytics-card">
          <h3>Girls</h3>
          <p className="analytics-value">{loading ? '...' : analyticsData.girls}</p>
        </div>
        <div className="analytics-card">
          <h3>Total Exams</h3>
          <p className="analytics-value">{analyticsData.totalExams}</p>
        </div>
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

      {/* Student Management Buttons */}
      <div className="management-buttons">
        <button className="btn btn-primary" onClick={handleAddStudent}>+ Add New Student</button>
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
          </div>
        </div>

        <div className="student-table">
          <table>
            <thead>
              <tr>
                <th>Admission Number</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Latest Marks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    Loading students...
                  </td>
                </tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map(student => (
                  <tr key={student.id}>
                    <td>{student.rollNo}</td>
                    <td>{student.name}</td>
                    <td>{student.gender}</td>
                    <td>{student.marks}%</td>
                    <td>
                      <button className="btn-action" onClick={() => handleViewStudent(student)} style={{ marginRight: '5px' }}>View</button>
                      <button className="btn-action" onClick={() => handleEditStudent(student)} style={{ backgroundColor: '#f59e0b' }}>Edit</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#718096' }}>
                    No students found. Click "Add New Student" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="analytics-section">
        <h3>Analytics & Performance</h3>
        <div className="analytics-charts">
          <div className="chart-container">
            <h4>Exam-wise Performance (Average)</h4>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={examPerformanceData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="average" stroke="#8884d8" name="Batch Average" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="chart-container">
            <h4>Subject-wise Last Exam Analysis</h4>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={subjectAnalysisData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="average" name="Subject Average" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchDetail;
