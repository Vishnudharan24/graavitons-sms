import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import AnalysisFilters from './AnalysisFilters';
import './Analysis.css';

const BranchwiseAnalysis = () => {
    const [filters, setFilters] = useState({
        grade: '',
        admissionNumber: '',
        batch: '',
        subject: '',
        fromDate: '',
        toDate: ''
    });

    // Sample student data with branch assignments
    const allStudentData = [
        { student: 'Rajesh Kumar', admissionNo: '2024001', grade: '12th', batch: 'NEET 2024-25', branch: 'Medical', physics: 85, chemistry: 88, biology: 90, mathematics: 87 },
        { student: 'Priya Sharma', admissionNo: '2024002', grade: '12th', batch: 'NEET 2024-25', branch: 'Medical', physics: 78, chemistry: 82, biology: 85, mathematics: 80 },
        { student: 'Sneha Reddy', admissionNo: '2024004', grade: '12th', batch: 'NEET 2024-25', branch: 'Medical', physics: 88, chemistry: 91, biology: 93, mathematics: 86 },
        { student: 'Deepa Nair', admissionNo: '2024006', grade: '12th', batch: 'NEET 2024-25', branch: 'Medical', physics: 82, chemistry: 85, biology: 88, mathematics: 83 },
        { student: 'Amit Patel', admissionNo: '2024003', grade: '11th', batch: 'JEE 2024-25', branch: 'Engineering', physics: 92, chemistry: 89, biology: 88, mathematics: 94 },
        { student: 'Karthik Iyer', admissionNo: '2024005', grade: '11th', batch: 'JEE 2024-25', branch: 'Engineering', physics: 75, chemistry: 78, biology: 80, mathematics: 77 },
        { student: 'Vikram Singh', admissionNo: '2024007', grade: '11th', batch: 'JEE 2024-25', branch: 'Engineering', physics: 88, chemistry: 86, biology: 82, mathematics: 92 },
        { student: 'Ananya Desai', admissionNo: '2024008', grade: '12th', batch: 'Foundation 2023-24', branch: 'Commerce', physics: 70, chemistry: 72, biology: 68, mathematics: 78 },
        { student: 'Rohan Kapoor', admissionNo: '2024009', grade: '11th', batch: 'Foundation 2023-24', branch: 'Commerce', physics: 68, chemistry: 70, biology: 65, mathematics: 75 }
    ];

    // Filter students based on selected filters
    const filteredStudents = allStudentData.filter(student => {
        if (filters.grade && student.grade !== filters.grade) return false;
        if (filters.admissionNumber && !student.admissionNo.toLowerCase().includes(filters.admissionNumber.toLowerCase())) return false;
        if (filters.batch && student.batch !== filters.batch) return false;
        return true;
    });

    // Calculate branch-wise statistics from filtered students
    const calculateBranchData = () => {
        const branches = ['Medical', 'Engineering', 'Commerce'];
        const branchData = [];
        const radarData = [];
        const stats = {};

        branches.forEach(branch => {
            const branchStudents = filteredStudents.filter(s => s.branch === branch);

            if (branchStudents.length > 0) {
                const avgPhysics = branchStudents.reduce((sum, s) => sum + s.physics, 0) / branchStudents.length;
                const avgChemistry = branchStudents.reduce((sum, s) => sum + s.chemistry, 0) / branchStudents.length;
                const avgBiology = branchStudents.reduce((sum, s) => sum + s.biology, 0) / branchStudents.length;
                const avgMathematics = branchStudents.reduce((sum, s) => sum + s.mathematics, 0) / branchStudents.length;

                branchData.push({
                    branch,
                    physics: Math.round(avgPhysics),
                    chemistry: Math.round(avgChemistry),
                    biology: Math.round(avgBiology),
                    mathematics: Math.round(avgMathematics)
                });

                const allScores = branchStudents.flatMap(s => [s.physics, s.chemistry, s.biology, s.mathematics]);
                const branchAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;

                stats[branch] = {
                    average: branchAvg.toFixed(1),
                    topScore: Math.max(...allScores),
                    lowest: Math.min(...allScores),
                    totalStudents: branchStudents.length
                };
            }
        });

        // Build radar data
        const subjects = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];
        subjects.forEach((subject, idx) => {
            const subjectKey = subject.toLowerCase();
            const radarEntry = { subject };
            branchData.forEach(b => {
                radarEntry[b.branch] = b[subjectKey];
            });
            radarData.push(radarEntry);
        });

        return { branchData, radarData, stats };
    };

    const { branchData: branchwiseData, radarData, stats: branchStats } = calculateBranchData();

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="branchwise-analysis">
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

            {/* Branch Statistics Cards */}
            <div className="stats-grid">
                {Object.entries(branchStats).map(([branch, stats]) => (
                    <div key={branch} className="stat-card branch-card">
                        <h4>{branch}</h4>
                        <div className="stat-values">
                            <div className="stat-item">
                                <span className="stat-label">Students</span>
                                <span className="stat-value">{stats.totalStudents}</span>
                            </div>
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

            {/* Branch Comparison Bar Chart */}
            <div className="analysis-section">
                <h3>Branch-wise Performance Comparison</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={branchwiseData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branch" />
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

            {/* Radar Chart for Subject Comparison */}
            <div className="analysis-section">
                <h3>Subject Strength Analysis</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar name="Medical" dataKey="Medical" stroke="#FF6B9D" fill="#FF6B9D" fillOpacity={0.6} />
                        <Radar name="Engineering" dataKey="Engineering" stroke="#4A90E2" fill="#4A90E2" fillOpacity={0.6} />
                        <Radar name="Commerce" dataKey="Commerce" stroke="#00D9C0" fill="#00D9C0" fillOpacity={0.6} />
                        <Legend />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            <div className="analysis-section">
                <h3>Detailed Branch Performance</h3>
                <div className="marks-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Branch</th>
                                <th>Physics</th>
                                <th>Chemistry</th>
                                <th>Biology</th>
                                <th>Mathematics</th>
                                <th>Average</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branchwiseData.map((branch, index) => {
                                const avg = ((branch.physics + branch.chemistry + branch.biology + branch.mathematics) / 4).toFixed(1);
                                return (
                                    <tr key={index}>
                                        <td className="student-name">{branch.branch}</td>
                                        <td>{branch.physics}</td>
                                        <td>{branch.chemistry}</td>
                                        <td>{branch.biology}</td>
                                        <td>{branch.mathematics}</td>
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

export default BranchwiseAnalysis;
