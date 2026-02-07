import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './StudentProfile.css';

const StudentProfile = ({ student, batchStats, onBack }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [dailyTests, setDailyTests] = useState([]);
  const [mockTests, setMockTests] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [currentFeedback, setCurrentFeedback] = useState({
    date: new Date().toISOString().split('T')[0],
    teacherFeedback: '',
    suggestions: ''
  });

  // Fetch complete student data from API
  useEffect(() => {
    if (student && student.rollNo) {
      fetchStudentData();
    }
  }, [student?.rollNo]);

  const fetchStudentData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/student/${student.rollNo}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStudentData(data);
      
      // Fetch daily tests
      try {
        const dailyTestsResponse = await fetch(`http://localhost:8000/api/exam/daily-test/student/${student.rollNo}`);
        if (dailyTestsResponse.ok) {
          const dailyTestsData = await dailyTestsResponse.json();
          setDailyTests(dailyTestsData.daily_tests || []);
        }
      } catch (err) {
        console.error('Error fetching daily tests:', err);
      }
      
      // Fetch mock tests
      try {
        const mockTestsResponse = await fetch(`http://localhost:8000/api/exam/mock-test/student/${student.rollNo}`);
        if (mockTestsResponse.ok) {
          const mockTestsData = await mockTestsResponse.json();
          setMockTests(mockTestsData.mock_tests || []);
        }
      } catch (err) {
        console.error('Error fetching mock tests:', err);
      }
      
    } catch (err) {
      console.error('Error fetching student data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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

  return (
    <div className="student-profile">
      <div className="profile-header">
        <button className="back-button" onClick={onBack}>← Back to Students</button>
        <div className="profile-title-section">
          <h2>Student Profile - {displayData.name}</h2>
          <div className="student-photo">
            <img src="https://via.placeholder.com/150" alt={studentData.name} />
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
            <h3>Daily Test Performance</h3>
            {dailyTests.length > 0 ? (
              <div className="marks-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Unit Covered</th>
                      <th>Marks Obtained</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTests.map((test, index) => (
                      <tr key={test.test_id || index}>
                        <td>{test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : 'N/A'}</td>
                        <td className="exam-name">{test.subject || 'N/A'}</td>
                        <td>{test.unit_name || 'N/A'}</td>
                        <td><strong>{test.total_marks || 0}</strong></td>
                        <td>{test.grade || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                No daily test data available
              </p>
            )}
          </div>

          {/* Mock Test Performance */}
          <div className="profile-section">
            <h3>Mock Test Performance</h3>
            {mockTests.length > 0 ? (
              <div className="marks-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Maths</th>
                      <th>Physics</th>
                      <th>Chemistry</th>
                      <th>Biology</th>
                      <th>Total</th>
                      <th>Grade</th>
                      <th>Units Covered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTests.map((exam, index) => (
                      <tr key={exam.test_id || index}>
                        <td>{exam.test_date ? new Date(exam.test_date).toLocaleDateString('en-IN') : 'N/A'}</td>
                        <td>{exam.maths_marks || 0}</td>
                        <td>{exam.physics_marks || 0}</td>
                        <td>{exam.chemistry_marks || 0}</td>
                        <td>{exam.biology_marks || 0}</td>
                        <td><strong>{exam.total_marks || 0}</strong></td>
                        <td>{exam.grade || 'N/A'}</td>
                        <td style={{ fontSize: '12px', lineHeight: '1.4' }}>
                          {exam.maths_unit_names && (
                            <div><strong>M:</strong> {Array.isArray(exam.maths_unit_names) ? exam.maths_unit_names.join(', ') : exam.maths_unit_names}</div>
                          )}
                          {exam.physics_unit_names && (
                            <div><strong>P:</strong> {Array.isArray(exam.physics_unit_names) ? exam.physics_unit_names.join(', ') : exam.physics_unit_names}</div>
                          )}
                          {exam.chemistry_unit_names && (
                            <div><strong>C:</strong> {Array.isArray(exam.chemistry_unit_names) ? exam.chemistry_unit_names.join(', ') : exam.chemistry_unit_names}</div>
                          )}
                          {exam.biology_unit_names && (
                            <div><strong>B:</strong> {Array.isArray(exam.biology_unit_names) ? exam.biology_unit_names.join(', ') : exam.biology_unit_names}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
                No mock test data available
              </p>
            )}
          </div>

          {/* Performance Graph Section */}
          {batchStats && (
            <div className="profile-section performance-graph-section">
              <h3>Performance Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: 'Top Mark', topMark: batchStats.topMark },
                    { name: 'Batch Average', batchAverage: Math.round(batchStats.averageMark * 10) / 10 },
                    { name: 'Your Mark', yourMark: batchStats.studentMark }
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="topMark" fill="#FF6B9D" name="Top Mark (%)" />
                  <Bar dataKey="batchAverage" fill="#4A90E2" name="Batch Average (%)" />
                  <Bar dataKey="yourMark" fill="#00D9C0" name="Your Mark (%)" />
                </BarChart>
              </ResponsiveContainer>
              <div className="performance-stats">
                <div className="stat-item">
                  <span className="stat-label">Top Mark in Batch:</span>
                  <span className="stat-value">{batchStats.topMark}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Batch Average:</span>
                  <span className="stat-value">{Math.round(batchStats.averageMark * 10) / 10}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Your Mark:</span>
                  <span className="stat-value">{batchStats.studentMark}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Teachers Feedback & Signatures */}
          <div className="profile-section">
            <h3>Feedback & Signatures</h3>
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
                  placeholder="Enter teacher's feedback here..."
                  rows="4"
                  value={currentFeedback.teacherFeedback}
                  onChange={(e) => setCurrentFeedback({ ...currentFeedback, teacherFeedback: e.target.value })}
                ></textarea>
              </div>
              <div className="feedback-item">
                <label>Suggestions:</label>
                <textarea
                  className="feedback-textarea"
                  placeholder="Enter suggestions here..."
                  rows="4"
                  value={currentFeedback.suggestions}
                  onChange={(e) => setCurrentFeedback({ ...currentFeedback, suggestions: e.target.value })}
                ></textarea>
              </div>
              <button
                className="btn-save-feedback"
                onClick={() => {
                  if (currentFeedback.teacherFeedback || currentFeedback.suggestions) {
                    setFeedbackList([
                      {
                        id: feedbackList.length + 1,
                        ...currentFeedback
                      },
                      ...feedbackList
                    ]);
                    setCurrentFeedback({
                      date: new Date().toISOString().split('T')[0],
                      teacherFeedback: '',
                      suggestions: ''
                    });
                    alert('Feedback saved successfully!');
                  }
                }}
              >
                Save Feedback
              </button>
              <div className="signature-grid">
                <div className="signature-box">
                  <label>Academic Director's Signature</label>
                  <div className="signature-area"></div>
                </div>
                <div className="signature-box">
                  <label>Student Signature</label>
                  <div className="signature-area"></div>
                </div>
                <div className="signature-box">
                  <label>Parents Signature</label>
                  <div className="signature-area"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback & Suggestions Tab */}
      {activeTab === 'feedback' && (
        <div className="tab-content">
          <div className="profile-section">
            <h3>Feedback History</h3>
            {feedbackList.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>
                No feedback entries yet.
              </p>
            ) : (
              <div className="feedback-history">
                {feedbackList.map((feedback) => (
                  <div key={feedback.id} className="feedback-card">
                    <div className="feedback-card-header">
                      <span className="feedback-date-badge">{new Date(feedback.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="feedback-card-body">
                      <div className="feedback-entry">
                        <h4>Teachers Feedback:</h4>
                        <p>{feedback.teacherFeedback}</p>
                      </div>
                      {feedback.suggestions && (
                        <div className="feedback-entry">
                          <h4>Suggestions:</h4>
                          <p>{feedback.suggestions}</p>
                        </div>
                      )}
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
