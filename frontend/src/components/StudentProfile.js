import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import './StudentProfile.css';
import { API_BASE, DEFAULT_AVATAR } from '../config';
import { authFetch } from '../utils/api';

const StudentProfile = ({ student, batchStats, onBack }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [dailyTests, setDailyTests] = useState([]);
  const [mockTests, setMockTests] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [dailyDateFrom, setDailyDateFrom] = useState('');
  const [dailyDateTo, setDailyDateTo] = useState('');
  const [mockDateFrom, setMockDateFrom] = useState('');
  const [mockDateTo, setMockDateTo] = useState('');
  const [currentFeedback, setCurrentFeedback] = useState({
    date: new Date().toISOString().split('T')[0],
    teacherFeedback: '',
    suggestions: '',
    academicDirectorSignature: '',
    studentSignature: '',
    parentSignature: ''
  });

  // Resolve student ID from various possible props (BatchDetail uses rollNo, AchieversSection uses admissionNo)
  const studentId = student?.rollNo || student?.admissionNo || student?.student_id || null;

  // Fetch complete student data from API
  useEffect(() => {
    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

  const fetchStudentData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await authFetch(`${API_BASE}/api/student/${studentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStudentData(data);
      
      // Fetch analysis data (includes daily tests, mock tests with class avg/top scores, and feedback)
      try {
        const analysisResponse = await authFetch(`${API_BASE}/api/analysis/individual/${studentId}`);
        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json();
          setAnalysisData(analysisResult);
          setDailyTests(analysisResult.daily_tests || []);
          setMockTests(analysisResult.mock_tests || []);
          setFeedbackList(analysisResult.feedback || []);
        } else {
          // Fallback: fetch feedback separately if analysis endpoint fails
          await fetchFeedback();
        }
      } catch (err) {
        console.error('Error fetching analysis data:', err);
        // Fallback: fetch feedback separately
        await fetchFeedback();
      }
      
    } catch (err) {
      console.error('Error fetching student data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedback = async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/analysis/feedback/${studentId}`);
      if (response.ok) {
        const data = await response.json();
        setFeedbackList(data.feedback || []);
      }
    } catch (err) {
      console.error('Error fetching feedback:', err);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="student-profile">
        <div className="profile-header">
          <button className="back-button" onClick={onBack}>← Back to Students</button>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px', color: '#5b5fc7' }}>
          Loading student data...
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !studentData) {
    return (
      <div className="student-profile">
        <div className="profile-header">
          <button className="back-button" onClick={onBack}>← Back to Students</button>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: '#c00', marginBottom: '20px' }}>
            <strong>Error:</strong> {error || 'Student data not found'}
          </div>
          <button onClick={fetchStudentData} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return dateString;
    }
  };

  // Prepare display data from fetched API data
  const displayData = {
    // Basic Information
    name: studentData.student_name || 'N/A',
    dob: formatDate(studentData.dob),
    grade: studentData.grade || 'N/A',
    community: studentData.community || 'N/A',
    academicYear: studentData.enrollment_year || 'N/A',
    course: studentData.course || 'N/A',
    branch: studentData.branch || 'N/A',
    rollNo: studentData.student_id || 'N/A',
    gender: studentData.gender || 'N/A',

    // Contact Information
    studentMobile: studentData.student_mobile || 'N/A',
    aadharNumber: studentData.aadhar_no || 'N/A',
    aasarId: studentData.apaar_id || 'N/A',
    emailId: studentData.email || 'N/A',

    // Personal Information
    schoolName: studentData.school_name || 'N/A',
    guardianName: studentData.guardian_name || 'N/A',
    guardianOccupation: studentData.guardian_occupation || 'N/A',
    guardianContact: studentData.guardian_mobile || 'N/A',
    guardianEmail: studentData.guardian_email || 'N/A',
    fatherName: studentData.father_name || 'N/A',
    fatherOccupation: studentData.father_occupation || 'N/A',
    fatherContact: studentData.father_mobile || 'N/A',
    fatherEmail: studentData.father_email || 'N/A',
    motherName: studentData.mother_name || 'N/A',
    motherOccupation: studentData.mother_occupation || 'N/A',
    motherContact: studentData.mother_mobile || 'N/A',
    motherEmail: studentData.mother_email || 'N/A',
    siblingName: studentData.sibling_name || 'N/A',
    siblingGrade: studentData.sibling_grade || 'N/A',
    siblingSchool: studentData.sibling_school || 'N/A',
    siblingCollege: studentData.sibling_college || 'N/A',

    // 10th Standard Marks
    std10Marks: {
      schoolName: studentData.tenth_school_name || 'N/A',
      yearOfPassing: studentData.tenth_year_of_passing || 'N/A',
      boardOfStudy: studentData.tenth_board_of_study || 'N/A',
      english: studentData.tenth_english || '-',
      tamil: studentData.tenth_tamil || '-',
      hindi: studentData.tenth_hindi || '-',
      maths: studentData.tenth_maths || '-',
      science: studentData.tenth_science || '-',
      socialScience: studentData.tenth_social_science || '-',
      total: studentData.tenth_total_marks || '-'
    },

    // 12th Standard Marks
    std12Marks: {
      schoolName: studentData.twelfth_school_name || 'N/A',
      yearOfPassing: studentData.twelfth_year_of_passing || 'N/A',
      boardOfStudy: studentData.twelfth_board_of_study || 'N/A',
      english: studentData.twelfth_english || '-',
      tamil: studentData.twelfth_tamil || '-',
      physics: studentData.twelfth_physics || '-',
      chemistry: studentData.twelfth_chemistry || '-',
      mathematics: studentData.twelfth_maths || '-',
      biology: studentData.twelfth_biology || '-',
      computerScience: studentData.twelfth_computer_science || '-',
      total: studentData.twelfth_total_marks || '-'
    },

    // Entrance Exam Marks
    entranceExams: studentData.entrance_exams || [],

    // Counselling Details
    counselling: {
      forum: studentData.counselling_forum || 'N/A',
      round: studentData.counselling_round || 'N/A',
      collegeAlloted: studentData.counselling_college_alloted || 'N/A',
      yearOfCompletion: studentData.counselling_year_of_completion || 'N/A'
    }
  };

  // Apply date filters to tests
  const filteredDailyTests = dailyTests.filter(test => {
    if (!test.test_date) return true;
    const d = test.test_date;
    if (dailyDateFrom && d < dailyDateFrom) return false;
    if (dailyDateTo && d > dailyDateTo) return false;
    return true;
  });

  const filteredMockTests = mockTests.filter(test => {
    if (!test.test_date) return true;
    const d = test.test_date;
    if (mockDateFrom && d < mockDateFrom) return false;
    if (mockDateTo && d > mockDateTo) return false;
    return true;
  });

  // Build performance trend from filtered daily tests
  const buildPerformanceTrend = () => {
    if (!filteredDailyTests || filteredDailyTests.length === 0) return [];
    const byDate = {};
    filteredDailyTests.forEach(test => {
      const d = test.test_date || 'Unknown';
      if (!byDate[d]) byDate[d] = { marks: [], classAvg: [] };
      byDate[d].marks.push(test.marks || 0);
      byDate[d].classAvg.push(test.class_avg || 0);
    });
    return Object.entries(byDate).sort().map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      score: Math.round(data.marks.reduce((a, b) => a + b, 0) / data.marks.length),
      classAvg: Math.round(data.classAvg.reduce((a, b) => a + b, 0) / data.classAvg.length)
    }));
  };

  // Build mock test chart data from filtered mock tests
  const buildMockTestChartData = () => {
    if (!filteredMockTests || filteredMockTests.length === 0) return [];
    return filteredMockTests.map((test, idx) => ({
      exam: `Mock ${idx + 1} (${test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''})`,
      physics: test.physics_marks || 0,
      chemistry: test.chemistry_marks || 0,
      biology: test.biology_marks || 0,
      maths: test.maths_marks || 0,
      total: test.total_marks || 0
    }));
  };

  const performanceTrend = buildPerformanceTrend();
  const mockTestChartData = buildMockTestChartData();

  // Save feedback to backend API
  const handleSaveFeedback = async () => {
    if (!studentId) return;
    if (!currentFeedback.teacherFeedback && !currentFeedback.suggestions) {
      alert('Please enter feedback or suggestions');
      return;
    }
    try {
      setSavingFeedback(true);
      const response = await authFetch(`${API_BASE}/api/analysis/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          feedback_date: currentFeedback.date,
          teacher_feedback: currentFeedback.teacherFeedback,
          suggestions: currentFeedback.suggestions,
          academic_director_signature: currentFeedback.academicDirectorSignature,
          student_signature: currentFeedback.studentSignature,
          parent_signature: currentFeedback.parentSignature
        })
      });
      if (response.ok) {
        alert('Feedback saved successfully!');
        setCurrentFeedback({
          date: new Date().toISOString().split('T')[0],
          teacherFeedback: '',
          suggestions: '',
          academicDirectorSignature: '',
          studentSignature: '',
          parentSignature: ''
        });
        // Refresh only feedback list from DB
        await fetchFeedback();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save feedback');
      }
    } catch (err) {
      alert('Error saving feedback: ' + err.message);
    } finally {
      setSavingFeedback(false);
    }
  };

  // Generate Excel report for the student
  const generateExcelReport = () => {
    const wb = XLSX.utils.book_new();

    // ===== Sheet 1: Personal Information =====
    const personalRows = [
      ['STUDENT REPORT'],
      ['Generated on', new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })],
      [],
      ['PERSONAL INFORMATION'],
      ['Admission Number', displayData.rollNo],
      ['Student Name', displayData.name],
      ['Date of Birth', displayData.dob],
      ['Gender', displayData.gender],
      ['Grade', displayData.grade],
      ['Community', displayData.community],
      ['Academic Year', displayData.academicYear],
      ['Course', displayData.course],
      ['Branch', displayData.branch],
      ['Student Mobile', displayData.studentMobile],
      ['Aadhar Number', displayData.aadharNumber],
      ['APAAR ID', displayData.aasarId],
      ['Email', displayData.emailId],
      ['School Name', displayData.schoolName],
      [],
      ['FAMILY DETAILS'],
      ['Guardian Name', displayData.guardianName],
      ['Guardian Occupation', displayData.guardianOccupation],
      ['Guardian Contact', displayData.guardianContact],
      ['Guardian Email', displayData.guardianEmail],
      ['Father Name', displayData.fatherName],
      ['Father Occupation', displayData.fatherOccupation],
      ['Father Contact', displayData.fatherContact],
      ['Father Email', displayData.fatherEmail],
      ['Mother Name', displayData.motherName],
      ['Mother Occupation', displayData.motherOccupation],
      ['Mother Contact', displayData.motherContact],
      ['Mother Email', displayData.motherEmail],
      ['Sibling Name', displayData.siblingName],
      ['Sibling Grade', displayData.siblingGrade],
      ['Sibling School', displayData.siblingSchool],
      ['Sibling College', displayData.siblingCollege],
      [],
      ['COUNSELLING DETAILS'],
      ['Forum', displayData.counselling.forum],
      ['Round', displayData.counselling.round],
      ['College Alloted', displayData.counselling.collegeAlloted],
      ['Year of Completion', displayData.counselling.yearOfCompletion],
    ];
    const wsPersonal = XLSX.utils.aoa_to_sheet(personalRows);
    wsPersonal['!cols'] = [{ wch: 22 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsPersonal, 'Personal Info');

    // ===== Sheet 2: Academic Marks (10th, 12th, Entrance) =====
    const academicRows = [
      ['ACADEMIC MARKS'],
      [],
      ['10TH STANDARD'],
      ['School Name', displayData.std10Marks.schoolName],
      ['Year of Passing', displayData.std10Marks.yearOfPassing],
      ['Board of Study', displayData.std10Marks.boardOfStudy],
      [],
      ['Subject', 'Marks'],
      ['English', displayData.std10Marks.english],
      ['Tamil', displayData.std10Marks.tamil],
      ['Hindi', displayData.std10Marks.hindi],
      ['Mathematics', displayData.std10Marks.maths],
      ['Science', displayData.std10Marks.science],
      ['Social Science', displayData.std10Marks.socialScience],
      ['Total', displayData.std10Marks.total],
      [],
      ['12TH STANDARD'],
      ['School Name', displayData.std12Marks.schoolName],
      ['Year of Passing', displayData.std12Marks.yearOfPassing],
      ['Board of Study', displayData.std12Marks.boardOfStudy],
      [],
      ['Subject', 'Marks'],
      ['English', displayData.std12Marks.english],
      ['Tamil', displayData.std12Marks.tamil],
      ['Physics', displayData.std12Marks.physics],
      ['Chemistry', displayData.std12Marks.chemistry],
      ['Mathematics', displayData.std12Marks.mathematics],
      ['Biology', displayData.std12Marks.biology],
      ['Computer Science', displayData.std12Marks.computerScience],
      ['Total', displayData.std12Marks.total],
    ];

    if (displayData.entranceExams.length > 0) {
      academicRows.push([], ['ENTRANCE EXAMS']);
      academicRows.push(['Exam Name', 'Physics', 'Chemistry', 'Maths', 'Biology', 'Total', 'Overall Rank', 'Community Rank']);
      displayData.entranceExams.forEach(exam => {
        academicRows.push([
          exam.exam_name || '-',
          exam.physics_marks || '-',
          exam.chemistry_marks || '-',
          exam.maths_marks || '-',
          exam.biology_marks || '-',
          exam.total_marks || '-',
          exam.overall_rank || '-',
          exam.community_rank || '-'
        ]);
      });
    }

    const wsAcademic = XLSX.utils.aoa_to_sheet(academicRows);
    wsAcademic['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsAcademic, 'Academic Marks');

    // ===== Sheet 3: Daily Test Performance =====
    if (dailyTests.length > 0) {
      const dailyHeader = ['Date', 'Subject', 'Unit Name', 'Marks', 'Class Avg', 'Top Score'];
      const dailyRows = dailyTests.map(test => [
        test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : '-',
        test.subject || '-',
        test.unit_name || '-',
        test.marks || 0,
        test.class_avg || 0,
        test.top_score || 0
      ]);
      const wsDaily = XLSX.utils.aoa_to_sheet([['DAILY TEST PERFORMANCE'], [], dailyHeader, ...dailyRows]);
      wsDaily['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Tests');
    }

    // ===== Sheet 4: Mock Test Performance =====
    if (mockTests.length > 0) {
      const mockHeader = ['Date', 'Maths', 'Physics', 'Chemistry', 'Biology', 'Total', 'Class Avg', 'Top Score'];
      const mockRows = mockTests.map(test => [
        test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : '-',
        test.maths_marks || 0,
        test.physics_marks || 0,
        test.chemistry_marks || 0,
        test.biology_marks || 0,
        test.total_marks || 0,
        test.class_avg_total || 0,
        test.top_score_total || 0
      ]);
      const wsMock = XLSX.utils.aoa_to_sheet([['MOCK TEST PERFORMANCE'], [], mockHeader, ...mockRows]);
      wsMock['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsMock, 'Mock Tests');
    }

    // ===== Sheet 5: Feedback History =====
    if (feedbackList.length > 0) {
      const fbHeader = ['Date', 'Teacher Feedback', 'Suggestions', 'Academic Director', 'Student', 'Parent'];
      const fbRows = feedbackList.map(fb => [
        (fb.feedback_date || fb.date) ? new Date(fb.feedback_date || fb.date).toLocaleDateString('en-IN') : '-',
        fb.teacher_feedback || '-',
        fb.suggestions || '-',
        fb.academic_director_signature || '-',
        fb.student_signature || '-',
        fb.parent_signature || '-'
      ]);
      const wsFeedback = XLSX.utils.aoa_to_sheet([['FEEDBACK HISTORY'], [], fbHeader, ...fbRows]);
      wsFeedback['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 40 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsFeedback, 'Feedback');
    }

    // Generate and download
    const fileName = `${displayData.name.replace(/\s+/g, '_')}_${displayData.rollNo}_Report.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="student-profile">
      <div className="profile-header">
        <div className="profile-header-actions">
          <button className="back-button" onClick={onBack}>← Back to Students</button>
          <button className="btn-download-report" onClick={generateExcelReport}>
            📊 Download Report
          </button>
        </div>
        <div className="profile-title-section">
          <h2>Student Profile - {displayData.name}</h2>
          <div className="student-photo">
            <img src={DEFAULT_AVATAR} alt={studentData.name} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          Personal Information
        </button>
        <button
          className={`tab-button ${activeTab === 'marks' ? 'active' : ''}`}
          onClick={() => setActiveTab('marks')}
        >
          Marks & Analysis
        </button>
        <button
          className={`tab-button ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback & Suggestions
        </button>
      </div>

      {/* Personal Information Tab */}
      {activeTab === 'personal' && (
        <div className="tab-content">
          {/* Basic Student Details Section */}
          <div className="profile-section">
            <h3>Personal Information</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>Admission Number:</label>
                <span>{displayData.rollNo}</span>
              </div>
              <div className="detail-item">
                <label>Student Name:</label>
                <span>{displayData.name}</span>
              </div>
              <div className="detail-item">
                <label>Date of Birth:</label>
                <span>{displayData.dob}</span>
              </div>
              <div className="detail-item">
                <label>Grade:</label>
                <span>{displayData.grade}</span>
              </div>
              <div className="detail-item">
                <label>Community:</label>
                <span>{displayData.community}</span>
              </div>
              <div className="detail-item">
                <label>Academic Year:</label>
                <span>{displayData.academicYear}</span>
              </div>
              <div className="detail-item">
                <label>Course:</label>
                <span>{displayData.course}</span>
              </div>
              <div className="detail-item">
                <label>Branch:</label>
                <span>{displayData.branch}</span>
              </div>
              <div className="detail-item">
                <label>Student Mobile:</label>
                <span>{displayData.studentMobile}</span>
              </div>
              <div className="detail-item">
                <label>Aadhar Number:</label>
                <span>{displayData.aadharNumber}</span>
              </div>
              <div className="detail-item">
                <label>APAAR ID:</label>
                <span>{displayData.aasarId}</span>
              </div>
              <div className="detail-item">
                <label>Email ID:</label>
                <span>{displayData.emailId}</span>
              </div>
            </div>
          </div>

          {/* School and Family Details */}
          <div className="profile-section">
            <h3>School & Family Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>School Name:</label>
                <span>{displayData.schoolName}</span>
              </div>
              <div className="detail-item">
                <label>Guardian Name:</label>
                <span>{displayData.guardianName}</span>
              </div>
              <div className="detail-item">
                <label>Guardian Occupation:</label>
                <span>{displayData.guardianOccupation}</span>
              </div>
              <div className="detail-item">
                <label>Guardian Contact:</label>
                <span>{displayData.guardianContact}</span>
              </div>
              <div className="detail-item">
                <label>Guardian Email:</label>
                <span>{displayData.guardianEmail}</span>
              </div>
              <div className="detail-item">
                <label>Father Name:</label>
                <span>{displayData.fatherName}</span>
              </div>
              <div className="detail-item">
                <label>Father Occupation:</label>
                <span>{displayData.fatherOccupation}</span>
              </div>
              <div className="detail-item">
                <label>Father Contact:</label>
                <span>{displayData.fatherContact}</span>
              </div>
              <div className="detail-item">
                <label>Father Email:</label>
                <span>{displayData.fatherEmail}</span>
              </div>
              <div className="detail-item">
                <label>Mother Name:</label>
                <span>{displayData.motherName}</span>
              </div>
              <div className="detail-item">
                <label>Mother Occupation:</label>
                <span>{displayData.motherOccupation}</span>
              </div>
              <div className="detail-item">
                <label>Mother Contact:</label>
                <span>{displayData.motherContact}</span>
              </div>
              <div className="detail-item">
                <label>Mother Email:</label>
                <span>{displayData.motherEmail}</span>
              </div>
              <div className="detail-item">
                <label>Sibling Name:</label>
                <span>{displayData.siblingName}</span>
              </div>
              <div className="detail-item">
                <label>Sibling Grade:</label>
                <span>{displayData.siblingGrade}</span>
              </div>
              <div className="detail-item">
                <label>Sibling School:</label>
                <span>{displayData.siblingSchool}</span>
              </div>
              <div className="detail-item">
                <label>Sibling College:</label>
                <span>{displayData.siblingCollege}</span>
              </div>
            </div>
          </div>

          {/* 10th Standard Marks */}
          <div className="profile-section">
            <h3>10th Standard Marks</h3>
            <div className="details-grid" style={{ marginBottom: '15px' }}>
              <div className="detail-item">
                <label>School Name:</label>
                <span>{displayData.std10Marks.schoolName}</span>
              </div>
              <div className="detail-item">
                <label>Year of Passing:</label>
                <span>{displayData.std10Marks.yearOfPassing}</span>
              </div>
              <div className="detail-item">
                <label>Board of Study:</label>
                <span>{displayData.std10Marks.boardOfStudy}</span>
              </div>
            </div>
            <div className="marks-table">
              <table>
                <thead>
                  <tr>
                    <th>English</th>
                    <th>Tamil</th>
                    <th>Hindi</th>
                    <th>Mathematics</th>
                    <th>Science</th>
                    <th>Social Science</th>
                    <th>Total Marks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{displayData.std10Marks.english}</td>
                    <td>{displayData.std10Marks.tamil}</td>
                    <td>{displayData.std10Marks.hindi}</td>
                    <td>{displayData.std10Marks.maths}</td>
                    <td>{displayData.std10Marks.science}</td>
                    <td>{displayData.std10Marks.socialScience}</td>
                    <td><strong>{displayData.std10Marks.total}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 12th Standard Marks */}
          <div className="profile-section">
            <h3>12th Standard Marks</h3>
            <div className="details-grid" style={{ marginBottom: '15px' }}>
              <div className="detail-item">
                <label>School Name:</label>
                <span>{displayData.std12Marks.schoolName}</span>
              </div>
              <div className="detail-item">
                <label>Year of Passing:</label>
                <span>{displayData.std12Marks.yearOfPassing}</span>
              </div>
              <div className="detail-item">
                <label>Board of Study:</label>
                <span>{displayData.std12Marks.boardOfStudy}</span>
              </div>
            </div>
            <div className="marks-table">
              <table>
                <thead>
                  <tr>
                    <th>English</th>
                    <th>Tamil</th>
                    <th>Physics</th>
                    <th>Chemistry</th>
                    <th>Mathematics</th>
                    <th>Biology</th>
                    <th>Computer Science</th>
                    <th>Total Marks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{displayData.std12Marks.english}</td>
                    <td>{displayData.std12Marks.tamil}</td>
                    <td>{displayData.std12Marks.physics}</td>
                    <td>{displayData.std12Marks.chemistry}</td>
                    <td>{displayData.std12Marks.mathematics}</td>
                    <td>{displayData.std12Marks.biology}</td>
                    <td>{displayData.std12Marks.computerScience}</td>
                    <td><strong>{displayData.std12Marks.total}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Entrance Exam Marks */}
          <div className="profile-section">
            <h3>Entrance Exam Marks</h3>
            {displayData.entranceExams.length > 0 ? (
              <div className="marks-table">
                <table>
                  <thead>
                    <tr>
                      <th>Exam Name</th>
                      <th>Physics</th>
                      <th>Chemistry</th>
                      <th>Maths</th>
                      <th>Biology</th>
                      <th>Total</th>
                      <th>Overall Rank</th>
                      <th>Community Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.entranceExams.map((exam, index) => (
                      <tr key={index}>
                        <td className="exam-name">{exam.exam_name}</td>
                        <td>{exam.physics_marks || '-'}</td>
                        <td>{exam.chemistry_marks || '-'}</td>
                        <td>{exam.maths_marks || '-'}</td>
                        <td>{exam.biology_marks || '-'}</td>
                        <td><strong>{exam.total_marks || '-'}</strong></td>
                        <td>{exam.overall_rank || '-'}</td>
                        <td>{exam.community_rank || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                No entrance exam data available
              </p>
            )}
          </div>

          {/* Counselling Details */}
          <div className="profile-section">
            <h3>Counselling Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>Forum of Counselling:</label>
                <span>{displayData.counselling.forum}</span>
              </div>
              <div className="detail-item">
                <label>Round:</label>
                <span>{displayData.counselling.round}</span>
              </div>
              <div className="detail-item">
                <label>College Alloted:</label>
                <span>{displayData.counselling.collegeAlloted}</span>
              </div>
              <div className="detail-item">
                <label>Year of Completion:</label>
                <span>{displayData.counselling.yearOfCompletion}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Marks & Analysis Tab */}
      {activeTab === 'marks' && (
        <div className="tab-content">
          {/* Daily Test Performance */}
          <div className="profile-section">
            <h3>📚 Daily Test Performance</h3>
            <div className="date-filter-row">
              <div className="date-filter-field">
                <label>From</label>
                <input type="date" value={dailyDateFrom} onChange={e => setDailyDateFrom(e.target.value)} className="date-filter-input" />
              </div>
              <div className="date-filter-field">
                <label>To</label>
                <input type="date" value={dailyDateTo} onChange={e => setDailyDateTo(e.target.value)} className="date-filter-input" />
              </div>
              {(dailyDateFrom || dailyDateTo) && (
                <button className="date-filter-clear" onClick={() => { setDailyDateFrom(''); setDailyDateTo(''); }}>✕ Clear</button>
              )}
            </div>
            {filteredDailyTests.length > 0 ? (
              <>
                <div className="marks-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Unit Covered</th>
                        <th>Marks</th>
                        <th>Class Avg</th>
                        <th>Top Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDailyTests.map((test, index) => (
                        <tr key={test.test_id || index}>
                          <td>{test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : 'N/A'}</td>
                          <td className="exam-name">{test.subject || 'N/A'}</td>
                          <td>{test.unit_name || 'N/A'}</td>
                          <td><strong>{test.marks || 0}</strong></td>
                          <td>{test.class_avg || 0}</td>
                          <td className="top-score">{test.top_score || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Performance Trend Chart */}
                {performanceTrend.length > 1 && (
                  <div className="profile-section" style={{ marginTop: '20px' }}>
                    <h4>Performance Trend</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={performanceTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="score" stroke="#5b5fc7" strokeWidth={3} name="Your Score" dot={{ r: 5 }} />
                        <Line type="monotone" dataKey="classAvg" stroke="#a0aec0" strokeWidth={2} strokeDasharray="5 5" name="Class Average" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                No daily test data available
              </p>
            )}
          </div>

          {/* Mock Test Performance */}
          <div className="profile-section">
            <h3>🎯 Mock Test Performance</h3>
            <div className="date-filter-row">
              <div className="date-filter-field">
                <label>From</label>
                <input type="date" value={mockDateFrom} onChange={e => setMockDateFrom(e.target.value)} className="date-filter-input" />
              </div>
              <div className="date-filter-field">
                <label>To</label>
                <input type="date" value={mockDateTo} onChange={e => setMockDateTo(e.target.value)} className="date-filter-input" />
              </div>
              {(mockDateFrom || mockDateTo) && (
                <button className="date-filter-clear" onClick={() => { setMockDateFrom(''); setMockDateTo(''); }}>✕ Clear</button>
              )}
            </div>
            {filteredMockTests.length > 0 ? (
              <>
                {/* Mock Test Bar Chart */}
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={mockTestChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="exam" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="physics" fill="#FF6B9D" name="Physics" />
                    <Bar dataKey="chemistry" fill="#4A90E2" name="Chemistry" />
                    <Bar dataKey="biology" fill="#00D9C0" name="Biology" />
                    <Bar dataKey="maths" fill="#FFA500" name="Maths" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Mock Test Details Table */}
                <div className="marks-table" style={{ marginTop: '20px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Maths</th>
                        <th>Physics</th>
                        <th>Chemistry</th>
                        <th>Biology</th>
                        <th>Total</th>
                        <th>Class Avg</th>
                        <th>Top Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMockTests.map((exam, index) => (
                        <tr key={exam.test_id || index}>
                          <td>{exam.test_date ? new Date(exam.test_date).toLocaleDateString('en-IN') : 'N/A'}</td>
                          <td>{exam.maths_marks || 0}</td>
                          <td>{exam.physics_marks || 0}</td>
                          <td>{exam.chemistry_marks || 0}</td>
                          <td>{exam.biology_marks || 0}</td>
                          <td><strong>{exam.total_marks || 0}</strong></td>
                          <td>{exam.class_avg_total || 0}</td>
                          <td className="top-score">{exam.top_score_total || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                No mock test data available
              </p>
            )}
          </div>

          {/* Teachers Feedback & Suggestions */}
          <div className="profile-section">
            <h3>✍️ Teachers Feedback & Suggestions</h3>
            <div className="feedback-section">
              <div className="feedback-item">
                <label>Date:</label>
                <input
                  type="date"
                  value={currentFeedback.date}
                  onChange={(e) => setCurrentFeedback({ ...currentFeedback, date: e.target.value })}
                  className="feedback-date"
                />
              </div>
              <div className="feedback-item">
                <label>Teachers Feedback:</label>
                <textarea
                  className="feedback-textarea"
                  placeholder="Enter teacher's feedback about the student's performance, behavior, and progress..."
                  rows="4"
                  value={currentFeedback.teacherFeedback}
                  onChange={(e) => setCurrentFeedback({ ...currentFeedback, teacherFeedback: e.target.value })}
                ></textarea>
              </div>
              <div className="feedback-item">
                <label>Suggestions:</label>
                <textarea
                  className="feedback-textarea"
                  placeholder="Enter suggestions for improvement, areas to focus on..."
                  rows="4"
                  value={currentFeedback.suggestions}
                  onChange={(e) => setCurrentFeedback({ ...currentFeedback, suggestions: e.target.value })}
                ></textarea>
              </div>
              <div className="signature-grid">
                <div className="signature-box">
                  <label>Academic Director's Signature</label>
                  <input
                    type="text"
                    placeholder="Type name as signature"
                    value={currentFeedback.academicDirectorSignature}
                    onChange={(e) => setCurrentFeedback({ ...currentFeedback, academicDirectorSignature: e.target.value })}
                    className="signature-input"
                  />
                  {currentFeedback.academicDirectorSignature && (
                    <div className="signature-preview"><span className="signature-text">{currentFeedback.academicDirectorSignature}</span></div>
                  )}
                </div>
                <div className="signature-box">
                  <label>Student Signature</label>
                  <input
                    type="text"
                    placeholder="Type name as signature"
                    value={currentFeedback.studentSignature}
                    onChange={(e) => setCurrentFeedback({ ...currentFeedback, studentSignature: e.target.value })}
                    className="signature-input"
                  />
                  {currentFeedback.studentSignature && (
                    <div className="signature-preview"><span className="signature-text">{currentFeedback.studentSignature}</span></div>
                  )}
                </div>
                <div className="signature-box">
                  <label>Parents Signature</label>
                  <input
                    type="text"
                    placeholder="Type name as signature"
                    value={currentFeedback.parentSignature}
                    onChange={(e) => setCurrentFeedback({ ...currentFeedback, parentSignature: e.target.value })}
                    className="signature-input"
                  />
                  {currentFeedback.parentSignature && (
                    <div className="signature-preview"><span className="signature-text">{currentFeedback.parentSignature}</span></div>
                  )}
                </div>
              </div>
              <button
                className="btn-save-feedback"
                onClick={handleSaveFeedback}
                disabled={savingFeedback}
              >
                {savingFeedback ? 'Saving...' : '💾 Save Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback & Suggestions Tab */}
      {activeTab === 'feedback' && (
        <div className="tab-content">
          <div className="profile-section">
            <h3>📜 Feedback History</h3>
            {feedbackList.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>
                No feedback entries yet.
              </p>
            ) : (
              <div className="feedback-history">
                {feedbackList.map((feedback) => (
                  <div key={feedback.feedback_id || feedback.id} className="feedback-card">
                    <div className="feedback-card-header">
                      <span className="feedback-date-badge">
                        {(feedback.feedback_date || feedback.date)
                          ? new Date(feedback.feedback_date || feedback.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                          : 'Unknown Date'}
                      </span>
                    </div>
                    <div className="feedback-card-body">
                      {feedback.teacher_feedback && (
                        <div className="feedback-entry">
                          <h4>Teachers Feedback</h4>
                          <p>{feedback.teacher_feedback}</p>
                        </div>
                      )}
                      {feedback.suggestions && (
                        <div className="feedback-entry">
                          <h4>Suggestions</h4>
                          <p>{feedback.suggestions}</p>
                        </div>
                      )}
                      <div className="feedback-signatures" style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {feedback.academic_director_signature && (
                          <div>
                            <span style={{ fontWeight: 600, color: '#718096', fontSize: '13px' }}>Academic Director: </span>
                            <span style={{ fontStyle: 'italic', color: '#5b5fc7' }}>{feedback.academic_director_signature}</span>
                          </div>
                        )}
                        {feedback.student_signature && (
                          <div>
                            <span style={{ fontWeight: 600, color: '#718096', fontSize: '13px' }}>Student: </span>
                            <span style={{ fontStyle: 'italic', color: '#5b5fc7' }}>{feedback.student_signature}</span>
                          </div>
                        )}
                        {feedback.parent_signature && (
                          <div>
                            <span style={{ fontWeight: 600, color: '#718096', fontSize: '13px' }}>Parent: </span>
                            <span style={{ fontStyle: 'italic', color: '#5b5fc7' }}>{feedback.parent_signature}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
