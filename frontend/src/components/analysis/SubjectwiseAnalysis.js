import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AnalysisFilters from './AnalysisFilters';
import './Analysis.css';

const SubjectwiseAnalysis = () => {
    const [filters, setFilters] = useState({
        grade: '',
        admissionNumber: '',
        batch: '',
        subject: '',
        fromDate: '',
        toDate: ''
    });

    // Sample data with metadata - would come from API in real implementation
    const allStudentData = [
        { student: 'Rajesh Kumar', admissionNo: '2024001', grade: '12th', batch: 'NEET 2024-25', physics: 85, chemistry: 88, biology: 90, mathematics: 87 },
        { student: 'Priya Sharma', admissionNo: '2024002', grade: '12th', batch: 'NEET 2024-25', physics: 78, chemistry: 82, biology: 85, mathematics: 80 },
        { student: 'Amit Patel', admissionNo: '2024003', grade: '11th', batch: 'JEE 2024-25', physics: 92, chemistry: 89, biology: 88, mathematics: 94 },
        { student: 'Sneha Reddy', admissionNo: '2024004', grade: '12th', batch: 'NEET 2024-25', physics: 88, chemistry: 91, biology: 93, mathematics: 86 },
        { student: 'Karthik Iyer', admissionNo: '2024005', grade: '11th', batch: 'JEE 2024-25', physics: 75, chemistry: 78, biology: 80, mathematics: 77 },
        { student: 'Deepa Nair', admissionNo: '2024006', grade: '12th', batch: 'NEET 2024-25', physics: 82, chemistry: 85, biology: 88, mathematics: 83 }
    ];

    // Filter data based on selected filters
    const filteredData = allStudentData.filter(student => {
        if (filters.grade && student.grade !== filters.grade) return false;
        if (filters.admissionNumber && !student.admissionNo.toLowerCase().includes(filters.admissionNumber.toLowerCase())) return false;
        if (filters.batch && student.batch !== filters.batch) return false;
        return true;
    });

    // Get data for display (filter by subject if selected)
    const subjectwiseData = filteredData.map(s => {
        if (filters.subject) {
            const subjectKey = filters.subject.toLowerCase();
            return {
                student: s.student,
                [subjectKey]: s[subjectKey]
            };
        }
        return {
            student: s.student,
            physics: s.physics,
            chemistry: s.chemistry,
            biology: s.biology,
            mathematics: s.mathematics
        };
    });

    // Calculate statistics based on filtered data
    const calculateStats = () => {
        if (filteredData.length === 0) {
            return {
                physics: { average: 0, topScore: 0, lowest: 0 },
                chemistry: { average: 0, topScore: 0, lowest: 0 },
                biology: { average: 0, topScore: 0, lowest: 0 },
                mathematics: { average: 0, topScore: 0, lowest: 0 }
            };
        }

        const subjects = ['physics', 'chemistry', 'biology', 'mathematics'];
        const stats = {};

        subjects.forEach(subject => {
            const scores = filteredData.map(s => s[subject]);
            stats[subject] = {
                average: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
                topScore: Math.max(...scores),
                lowest: Math.min(...scores)
            };
        });

        return stats;
    };

    const subjectStats = filters.subject
        ? { [filters.subject.toLowerCase()]: calculateStats()[filters.subject.toLowerCase()] }
        : calculateStats();

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="subjectwise-analysis">
            <AnalysisFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                showFilters={{
                    grade: true,
                    admissionNumber: true,
                    batch: true,
                    subject: true,
                    dateRange: true,
                    name: false,
                    course: false,
                    branch: false
                }}
            />

            {/* Statistics Cards */}
            <div className="stats-grid">
                {Object.entries(subjectStats).map(([subject, stats]) => (
                    <div key={subject} className="stat-card">
                        <h4>{subject.charAt(0).toUpperCase() + subject.slice(1)}</h4>
                        <div className="stat-values">
                            <div className="stat-item">
                                <span className="stat-label">Average</span>
                                <span className="stat-value">{stats.average}%</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Top Score</span>
                                <span className="stat-value top">{stats.topScore}%</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Lowest</span>
                                <span className="stat-value low">{stats.lowest}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Performance Chart */}
            <div className="analysis-section">
                <h3>Student Performance Comparison</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={subjectwiseData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="student" angle={-45} textAnchor="end" height={100} />
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

            {/* Detailed Table */}
            <div className="analysis-section">
                <h3>Detailed Marks</h3>
                <div className="marks-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th>Physics</th>
                                <th>Chemistry</th>
                                <th>Biology</th>
                                <th>Mathematics</th>
                                <th>Average</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjectwiseData.map((student, index) => {
                                const avg = ((student.physics + student.chemistry + student.biology + student.mathematics) / 4).toFixed(1);
                                return (
                                    <tr key={index}>
                                        <td className="student-name">{student.student}</td>
                                        <td>{student.physics}</td>
                                        <td>{student.chemistry}</td>
                                        <td>{student.biology}</td>
                                        <td>{student.mathematics}</td>
                                        <td><strong>{avg}</strong></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SubjectwiseAnalysis;
