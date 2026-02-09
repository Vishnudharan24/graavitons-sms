import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AnalysisFilters from './AnalysisFilters';
import './Analysis.css';

const API_BASE = 'http://localhost:8000';

const IndividualAnalysis = () => {
    const [filters, setFilters] = useState({
        name: '',
        course: '',
        branch: '',
        batch: ''
    });

    const [studentsList, setStudentsList] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [error, setError] = useState('');

    // Feedback form state
    const [feedbackForm, setFeedbackForm] = useState({
        date: new Date().toISOString().split('T')[0],
        teacherFeedback: '',
        suggestions: '',
        academicDirectorSignature: '',
        studentSignature: '',
        parentSignature: ''
    });
    const [savingFeedback, setSavingFeedback] = useState(false);

    // Date filter state
    const [dailyDateFrom, setDailyDateFrom] = useState('');
    const [dailyDateTo, setDailyDateTo] = useState('');
    const [mockDateFrom, setMockDateFrom] = useState('');
    const [mockDateTo, setMockDateTo] = useState('');

    // Fetch students list based on filters
    const fetchStudents = useCallback(async () => {
        try {
            setStudentsLoading(true);
            const params = new URLSearchParams();
            if (filters.name) params.append('name', filters.name);
            if (filters.batch) params.append('batch_id', filters.batch);
            if (filters.course) params.append('course', filters.course);
            if (filters.branch) params.append('branch', filters.branch);

            const response = await fetch(`${API_BASE}/api/analysis/individual/students?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                setStudentsList(data.students || []);
            }
        } catch (err) {
            console.error('Error fetching students:', err);
        } finally {
            setStudentsLoading(false);
        }
    }, [filters]);

    // Fetch individual student analysis
    const fetchStudentAnalysis = useCallback(async (studentId) => {
        if (!studentId) return;

        try {
            setLoading(true);
            setError('');

            const response = await fetch(`${API_BASE}/api/analysis/individual/${studentId}`);
            if (!response.ok) throw new Error('Failed to fetch student analysis');

            const data = await response.json();
            setStudentData(data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching individual analysis:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load students on mount and when filters change
    useEffect(() => {
        fetchStudents();
    }, []);

    // When student is selected, fetch their analysis
    useEffect(() => {
        if (selectedStudentId) {
            fetchStudentAnalysis(selectedStudentId);
        }
    }, [selectedStudentId, fetchStudentAnalysis]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleStudentSelect = (e) => {
        setSelectedStudentId(e.target.value);
    };

    // Save feedback
    const handleSaveFeedback = async () => {
        if (!selectedStudentId) return;
        if (!feedbackForm.teacherFeedback && !feedbackForm.suggestions) {
            alert('Please enter feedback or suggestions');
            return;
        }

        try {
            setSavingFeedback(true);
            const response = await fetch(`${API_BASE}/api/analysis/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: selectedStudentId,
                    feedback_date: feedbackForm.date,
                    teacher_feedback: feedbackForm.teacherFeedback,
                    suggestions: feedbackForm.suggestions,
                    academic_director_signature: feedbackForm.academicDirectorSignature,
                    student_signature: feedbackForm.studentSignature,
                    parent_signature: feedbackForm.parentSignature
                })
            });

            if (response.ok) {
                alert('Feedback saved successfully!');
                // Reset form
                setFeedbackForm({
                    date: new Date().toISOString().split('T')[0],
                    teacherFeedback: '',
                    suggestions: '',
                    academicDirectorSignature: '',
                    studentSignature: '',
                    parentSignature: ''
                });
                // Refresh student data to get updated feedback
                fetchStudentAnalysis(selectedStudentId);
            } else {
                throw new Error('Failed to save feedback');
            }
        } catch (err) {
            alert('Error saving feedback: ' + err.message);
        } finally {
            setSavingFeedback(false);
        }
    };

    const student = studentData?.student;
    const dailyTestsAll = studentData?.daily_tests || [];
    const mockTestsAll = studentData?.mock_tests || [];
    const feedbackList = studentData?.feedback || [];

    // Apply date filters
    const dailyTests = dailyTestsAll.filter(test => {
        if (!test.test_date) return true;
        const d = test.test_date;
        if (dailyDateFrom && d < dailyDateFrom) return false;
        if (dailyDateTo && d > dailyDateTo) return false;
        return true;
    });

    const mockTests = mockTestsAll.filter(test => {
        if (!test.test_date) return true;
        const d = test.test_date;
        if (mockDateFrom && d < mockDateFrom) return false;
        if (mockDateTo && d > mockDateTo) return false;
        return true;
    });

    const dailyTestTrend = (() => {
        if (!dailyTests.length) return [];
        return dailyTests.map(test => ({
            date: test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '',
            subject: test.subject,
            label: `${test.subject} - ${test.unit_name || ''}`,
            marks: test.marks || 0,
            classAvg: test.class_avg || 0,
            topScore: test.top_score || 0
        }));
    })();

    const mockTestChartData = (() => {
        if (!mockTests.length) return [];
        return mockTests.map((test, idx) => ({
            exam: `Mock ${idx + 1} (${test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''})`,
            physics: test.physics_marks || 0,
            chemistry: test.chemistry_marks || 0,
            biology: test.biology_marks || 0,
            maths: test.maths_marks || 0,
            total: test.total_marks || 0
        }));
    })();

    const performanceTrend = (() => {
        if (!dailyTests.length) return [];
        const byDate = {};
        dailyTests.forEach(test => {
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
    })();

    return (
        <div className="individual-analysis">
            <AnalysisFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onApplyFilters={fetchStudents}
                showFilters={{
                    grade: false,
                    admissionNumber: false,
                    batch: true,
                    subject: false,
                    dateRange: false,
                    name: true,
                    course: true,
                    branch: true
                }}
            />

            {/* Student Selection */}
            <div className="analysis-section">
                <h3>👤 Select Student</h3>
                <div className="student-selector">
                    {studentsLoading ? (
                        <p className="loading-text">Loading students...</p>
                    ) : (
                        <select
                            value={selectedStudentId}
                            onChange={handleStudentSelect}
                            className="student-select"
                        >
                            <option value="">-- Select a Student --</option>
                            {studentsList.map(s => (
                                <option key={s.student_id} value={s.student_id}>
                                    {s.student_name} ({s.student_id}) - {s.branch || 'N/A'} | {s.batch_name || 'N/A'}
                                </option>
                            ))}
                        </select>
                    )}
                    {studentsList.length === 0 && !studentsLoading && (
                        <p className="no-students-text">No students found. Try adjusting filters.</p>
                    )}
                </div>
            </div>

            {loading && (
                <div className="analysis-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading student analysis...</p>
                </div>
            )}

            {error && (
                <div className="analysis-error">
                    <p>⚠️ {error}</p>
                </div>
            )}

            {!loading && !error && student && (
                <>
                    {/* Student Info Card */}
                    <div className="analysis-section">
                        <h3>📝 Student Information</h3>
                        <div className="student-info-card">
                            <div className="student-photo-section">
                                <img
                                    src={student.photo_url || 'https://via.placeholder.com/120?text=Photo'}
                                    alt={student.student_name}
                                    className="student-photo-img"
                                />
                            </div>
                            <div className="student-details-grid">
                                <div className="detail-pair">
                                    <label>Name</label>
                                    <span>{student.student_name}</span>
                                </div>
                                <div className="detail-pair">
                                    <label>Admission No</label>
                                    <span>{student.student_id}</span>
                                </div>
                                <div className="detail-pair">
                                    <label>Course</label>
                                    <span>{student.course || 'N/A'}</span>
                                </div>
                                <div className="detail-pair">
                                    <label>Branch</label>
                                    <span>{student.branch || 'N/A'}</span>
                                </div>
                                <div className="detail-pair">
                                    <label>Batch</label>
                                    <span>{student.batch_name || 'N/A'}</span>
                                </div>
                                <div className="detail-pair">
                                    <label>Grade</label>
                                    <span>{student.grade || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Test Performance Table */}
                    <div className="analysis-section">
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
                        {dailyTests.length > 0 ? (
                            <>
                                <div className="marks-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Subject</th>
                                                <th>Unit Name</th>
                                                <th>Marks</th>
                                                <th>Class Avg</th>
                                                <th>Top Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dailyTests.map((test, index) => (
                                                <tr key={index}>
                                                    <td>{test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : '-'}</td>
                                                    <td className="exam-name">{test.subject}</td>
                                                    <td>{test.unit_name || '-'}</td>
                                                    <td>
                                                        <strong>{test.marks || 0}</strong>
                                                    </td>
                                                    <td>{test.class_avg || 0}</td>
                                                    <td className="top-score">{test.top_score || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Performance Trend Chart */}
                                {performanceTrend.length > 1 && (
                                    <div className="chart-container">
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
                            <div className="no-data">
                                <p>No daily test data available for this student.</p>
                            </div>
                        )}
                    </div>

                    {/* Mock Test Performance */}
                    <div className="analysis-section">
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
                        {mockTests.length > 0 ? (
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
                                            {mockTests.map((test, index) => (
                                                <tr key={index}>
                                                    <td>{test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : '-'}</td>
                                                    <td>{test.maths_marks || 0}</td>
                                                    <td>{test.physics_marks || 0}</td>
                                                    <td>{test.chemistry_marks || 0}</td>
                                                    <td>{test.biology_marks || 0}</td>
                                                    <td><strong>{test.total_marks || 0}</strong></td>
                                                    <td>{test.class_avg_total || 0}</td>
                                                    <td className="top-score">{test.top_score_total || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="no-data">
                                <p>No mock test data available for this student.</p>
                            </div>
                        )}
                    </div>

                    {/* Teachers Feedback & Suggestions */}
                    <div className="analysis-section">
                        <h3>✍️ Teachers Feedback & Suggestions</h3>
                        <div className="feedback-form">
                            <div className="feedback-form-row">
                                <div className="feedback-field">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={feedbackForm.date}
                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, date: e.target.value })}
                                        className="feedback-date-input"
                                    />
                                </div>
                            </div>

                            <div className="feedback-field">
                                <label>Teachers Feedback</label>
                                <textarea
                                    className="feedback-textarea"
                                    placeholder="Enter teacher's feedback about the student's performance, behavior, and progress..."
                                    rows="4"
                                    value={feedbackForm.teacherFeedback}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, teacherFeedback: e.target.value })}
                                />
                            </div>

                            <div className="feedback-field">
                                <label>Suggestions</label>
                                <textarea
                                    className="feedback-textarea"
                                    placeholder="Enter suggestions for improvement, areas to focus on..."
                                    rows="4"
                                    value={feedbackForm.suggestions}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, suggestions: e.target.value })}
                                />
                            </div>

                            {/* Signature Section */}
                            <div className="signatures-section">
                                <h4>Signatures</h4>
                                <div className="signature-grid">
                                    <div className="signature-box">
                                        <label>Academic Director's Signature</label>
                                        <input
                                            type="text"
                                            placeholder="Type name as signature"
                                            value={feedbackForm.academicDirectorSignature}
                                            onChange={(e) => setFeedbackForm({ ...feedbackForm, academicDirectorSignature: e.target.value })}
                                            className="signature-input"
                                        />
                                        <div className="signature-preview">
                                            {feedbackForm.academicDirectorSignature && (
                                                <span className="signature-text">{feedbackForm.academicDirectorSignature}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="signature-box">
                                        <label>Student Signature</label>
                                        <input
                                            type="text"
                                            placeholder="Type name as signature"
                                            value={feedbackForm.studentSignature}
                                            onChange={(e) => setFeedbackForm({ ...feedbackForm, studentSignature: e.target.value })}
                                            className="signature-input"
                                        />
                                        <div className="signature-preview">
                                            {feedbackForm.studentSignature && (
                                                <span className="signature-text">{feedbackForm.studentSignature}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="signature-box">
                                        <label>Parents Signature</label>
                                        <input
                                            type="text"
                                            placeholder="Type name as signature"
                                            value={feedbackForm.parentSignature}
                                            onChange={(e) => setFeedbackForm({ ...feedbackForm, parentSignature: e.target.value })}
                                            className="signature-input"
                                        />
                                        <div className="signature-preview">
                                            {feedbackForm.parentSignature && (
                                                <span className="signature-text">{feedbackForm.parentSignature}</span>
                                            )}
                                        </div>
                                    </div>
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

                    {/* Feedback History */}
                    {feedbackList.length > 0 && (
                        <div className="analysis-section">
                            <h3>📜 Feedback History</h3>
                            <div className="feedback-history">
                                {feedbackList.map((feedback) => (
                                    <div key={feedback.feedback_id} className="feedback-card">
                                        <div className="feedback-card-header">
                                            <span className="feedback-date-badge">
                                                {feedback.feedback_date
                                                    ? new Date(feedback.feedback_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
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
                                            <div className="feedback-signatures">
                                                {feedback.academic_director_signature && (
                                                    <div className="feedback-sig">
                                                        <span className="sig-label">Academic Director:</span>
                                                        <span className="sig-value">{feedback.academic_director_signature}</span>
                                                    </div>
                                                )}
                                                {feedback.student_signature && (
                                                    <div className="feedback-sig">
                                                        <span className="sig-label">Student:</span>
                                                        <span className="sig-value">{feedback.student_signature}</span>
                                                    </div>
                                                )}
                                                {feedback.parent_signature && (
                                                    <div className="feedback-sig">
                                                        <span className="sig-label">Parent:</span>
                                                        <span className="sig-value">{feedback.parent_signature}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {!loading && !error && !student && selectedStudentId && (
                <div className="no-data">
                    <p>Could not load student data. Please try again.</p>
                </div>
            )}
        </div>
    );
};

export default IndividualAnalysis;
