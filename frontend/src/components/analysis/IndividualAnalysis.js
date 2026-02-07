import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AnalysisFilters from './AnalysisFilters';
import './Analysis.css';

const IndividualAnalysis = () => {
    const [filters, setFilters] = useState({
        name: '',
        course: '',
        branch: '',
        batch: ''
    });

    const [selectedStudent, setSelectedStudent] = useState(null);

    // Sample student database
    const allStudents = [
        {
            id: 1,
            name: 'Rajesh Kumar',
            admissionNo: '2024001',
            course: 'NEET Preparation',
            branch: 'Medical',
            batch: 'NEET 2024-25',
            grade: '12th',
            photo: 'https://via.placeholder.com/100',
            dailyTests: [
                { subject: 'Physics', unit: 'Thermodynamics', test1: 25, test2: 28, test3: 27, classAvg: 22, topScore: 30 },
                { subject: 'Chemistry', unit: 'Organic Chemistry', test1: 28, test2: 29, test3: 30, classAvg: 24, topScore: 30 },
                { subject: 'Biology', unit: 'Cell Biology', test1: 27, test2: 29, test3: 28, classAvg: 25, topScore: 30 },
                { subject: 'Mathematics', unit: 'Calculus', test1: 24, test2: 26, test3: 28, classAvg: 23, topScore: 30 }
            ],
            mockTests: [
                { exam: 'Mock Test 1', physics: 85, chemistry: 88, biology: 90, mathematics: 82, total: 345 },
                { exam: 'Mock Test 2', physics: 88, chemistry: 90, biology: 92, mathematics: 85, total: 355 },
                { exam: 'Mock Test 3', physics: 90, chemistry: 92, biology: 94, mathematics: 88, total: 364 }
            ]
        },
        {
            id: 2,
            name: 'Priya Sharma',
            admissionNo: '2024002',
            course: 'NEET Preparation',
            branch: 'Medical',
            batch: 'NEET 2024-25',
            grade: '12th',
            photo: 'https://via.placeholder.com/100',
            dailyTests: [
                { subject: 'Physics', unit: 'Thermodynamics', test1: 22, test2: 24, test3: 25, classAvg: 22, topScore: 30 },
                { subject: 'Chemistry', unit: 'Organic Chemistry', test1: 25, test2: 26, test3: 27, classAvg: 24, topScore: 30 },
                { subject: 'Biology', unit: 'Cell Biology', test1: 26, test2: 27, test3: 28, classAvg: 25, topScore: 30 },
                { subject: 'Mathematics', unit: 'Calculus', test1: 23, test2: 24, test3: 25, classAvg: 23, topScore: 30 }
            ],
            mockTests: [
                { exam: 'Mock Test 1', physics: 78, chemistry: 82, biology: 85, mathematics: 80, total: 325 },
                { exam: 'Mock Test 2', physics: 80, chemistry: 84, biology: 87, mathematics: 82, total: 333 },
                { exam: 'Mock Test 3', physics: 82, chemistry: 86, biology: 89, mathematics: 84, total: 341 }
            ]
        },
        {
            id: 3,
            name: 'Amit Patel',
            admissionNo: '2024003',
            course: 'JEE Preparation',
            branch: 'Engineering',
            batch: 'JEE 2024-25',
            grade: '11th',
            photo: 'https://via.placeholder.com/100',
            dailyTests: [
                { subject: 'Physics', unit: 'Mechanics', test1: 28, test2: 29, test3: 30, classAvg: 24, topScore: 30 },
                { subject: 'Chemistry', unit: 'Physical Chemistry', test1: 27, test2: 28, test3: 29, classAvg: 23, topScore: 30 },
                { subject: 'Mathematics', unit: 'Algebra', test1: 29, test2: 30, test3: 30, classAvg: 25, topScore: 30 }
            ],
            mockTests: [
                { exam: 'Mock Test 1', physics: 92, chemistry: 89, mathematics: 94, total: 275 },
                { exam: 'Mock Test 2', physics: 94, chemistry: 91, mathematics: 96, total: 281 },
                { exam: 'Mock Test 3', physics: 95, chemistry: 93, mathematics: 97, total: 285 }
            ]
        }
    ];

    // Filter students based on filters
    const filteredStudents = allStudents.filter(student => {
        if (filters.name && !student.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.course && student.course !== filters.course) return false;
        if (filters.branch && student.branch !== filters.branch) return false;
        if (filters.batch && student.batch !== filters.batch) return false;
        return true;
    });

    // Use first filtered student or first student as default
    const currentStudent = selectedStudent || filteredStudents[0] || allStudents[0];

    // Calculate performance trend
    const calculatePerformanceTrend = () => {
        if (!currentStudent.dailyTests) return [];
        const tests = ['test1', 'test2', 'test3'];
        return tests.map((test, idx) => {
            const scores = currentStudent.dailyTests.map(dt => dt[test]);
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            return { test: `Test ${idx + 1}`, score: ((avg / 30) * 100).toFixed(1) };
        });
    };

    const dailyTestData = currentStudent.dailyTests || [];
    const mockTestData = currentStudent.mockTests || [];
    const performanceTrend = calculatePerformanceTrend();

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setSelectedStudent(null); // Reset selection when filters change
    };

    const handleStudentSelect = (e) => {
        const studentId = parseInt(e.target.value);
        const student = allStudents.find(s => s.id === studentId);
        setSelectedStudent(student);
    };

    return (
        <div className="individual-analysis">
            <AnalysisFilters
                filters={filters}
                onFilterChange={handleFilterChange}
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

            {/* Student Selection Dropdown */}
            <div className="analysis-section">
                <h3>Select Student</h3>
                <div className="filter-group">
                    <select
                        value={currentStudent?.id || ''}
                        onChange={handleStudentSelect}
                        style={{ padding: '10px', fontSize: '14px', borderRadius: '8px', border: '1px solid #ddd', minWidth: '300px' }}
                    >
                        {filteredStudents.map(student => (
                            <option key={student.id} value={student.id}>
                                {student.name} ({student.admissionNo}) - {student.branch}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Student Info Card */}
            <div className="analysis-section">
                <h3>Student Information</h3>
                <div className="student-info-card">
                    <div className="student-photo">
                        <img src={currentStudent.photo} alt="Student" />
                    </div>
                    <div className="student-details">
                        <h4>{currentStudent.name}</h4>
                        <p><strong>Admission Number:</strong> {currentStudent.admissionNo}</p>
                        <p><strong>Course:</strong> {currentStudent.course}</p>
                        <p><strong>Branch:</strong> {currentStudent.branch}</p>
                        <p><strong>Batch:</strong> {currentStudent.batch}</p>
                    </div>
                </div>
            </div>

            {/* Daily Test Performance */}
            <div className="analysis-section">
                <h3>Daily Test Performance</h3>
                <div className="marks-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Unit Name</th>
                                <th>Test-1</th>
                                <th>Test-2</th>
                                <th>Test-3</th>
                                <th>Class Avg</th>
                                <th>Top Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyTestData.map((test, index) => (
                                <tr key={index}>
                                    <td className="exam-name">{test.subject}</td>
                                    <td>{test.unit}</td>
                                    <td>{test.test1}</td>
                                    <td>{test.test2}</td>
                                    <td>{test.test3}</td>
                                    <td><strong>{test.classAvg}</strong></td>
                                    <td className="top-score"><strong>{test.topScore}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Performance Trend Chart */}
            <div className="analysis-section">
                <h3>Performance Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="test" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="score" stroke="#5b5fc7" strokeWidth={3} name="Your Score (%)" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Mock Test Performance */}
            <div className="analysis-section">
                <h3>Mock Test Performance</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mockTestData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="exam" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="physics" fill="#FF6B9D" name="Physics" />
                        <Bar dataKey="chemistry" fill="#4A90E2" name="Chemistry" />
                        <Bar dataKey="biology" fill="#00D9C0" name="Biology" />
                        <Bar dataKey="mathematics" fill="#FFA500" name="Mathematics" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Mock Test Details Table */}
            <div className="analysis-section">
                <h3>Mock Test Details</h3>
                <div className="marks-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Exam</th>
                                <th>Physics</th>
                                <th>Chemistry</th>
                                <th>Biology</th>
                                <th>Mathematics</th>
                                <th>Total (400)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mockTestData.map((exam, index) => (
                                <tr key={index}>
                                    <td className="exam-name">{exam.exam}</td>
                                    <td>{exam.physics}</td>
                                    <td>{exam.chemistry}</td>
                                    <td>{exam.biology}</td>
                                    <td>{exam.mathematics}</td>
                                    <td><strong>{exam.total}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default IndividualAnalysis;
