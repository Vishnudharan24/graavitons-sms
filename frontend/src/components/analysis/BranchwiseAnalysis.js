import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import AnalysisFilters from './AnalysisFilters';
import './Analysis.css';

const API_BASE = 'http://localhost:8000';

const BranchwiseAnalysis = () => {
    const [filters, setFilters] = useState({
        grade: '',
        admissionNumber: '',
        batch: '',
        fromDate: '',
        toDate: ''
    });

    const [analysisData, setAnalysisData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchAnalysis = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const params = new URLSearchParams();
            if (filters.grade) params.append('grade', filters.grade);
            if (filters.admissionNumber) params.append('admission_number', filters.admissionNumber);
            if (filters.batch) params.append('batch_id', filters.batch);
            if (filters.fromDate) params.append('from_date', filters.fromDate);
            if (filters.toDate) params.append('to_date', filters.toDate);

            const response = await fetch(`${API_BASE}/api/analysis/branchwise?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch branchwise analysis data');

            const data = await response.json();
            setAnalysisData(data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching branchwise analysis:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchAnalysis();
    }, []);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // Build bar chart data from branches
    const buildBarChartData = () => {
        if (!analysisData || !analysisData.branches) return [];

        return analysisData.branches.map(branch => {
            const entry = { branch: branch.branch };

            // Use mock test data if available (has subject-wise breakdown)
            if (branch.mock_test_data) {
                entry.physics = branch.mock_test_data.physics || 0;
                entry.chemistry = branch.mock_test_data.chemistry || 0;
                entry.biology = branch.mock_test_data.biology || 0;
                entry.maths = branch.mock_test_data.maths || 0;
            }

            // Also use daily test data
            if (branch.daily_test_data) {
                Object.entries(branch.daily_test_data).forEach(([subject, data]) => {
                    const key = subject.toLowerCase();
                    if (!entry[key]) {
                        entry[key] = data.average || 0;
                    }
                });
            }

            return entry;
        });
    };

    // Build radar chart data
    const buildRadarData = () => {
        if (!analysisData || !analysisData.branches) return [];

        const allSubjects = new Set();
        analysisData.branches.forEach(branch => {
            if (branch.daily_test_data) {
                Object.keys(branch.daily_test_data).forEach(s => allSubjects.add(s));
            }
            if (branch.mock_test_data) {
                ['Physics', 'Chemistry', 'Biology', 'Maths'].forEach(s => allSubjects.add(s));
            }
        });

        return Array.from(allSubjects).map(subject => {
            const entry = { subject };
            analysisData.branches.forEach(branch => {
                const key = subject.toLowerCase();
                if (branch.mock_test_data && branch.mock_test_data[key] !== undefined) {
                    entry[branch.branch] = branch.mock_test_data[key];
                } else if (branch.daily_test_data && branch.daily_test_data[subject]) {
                    entry[branch.branch] = branch.daily_test_data[subject].average || 0;
                } else {
                    entry[branch.branch] = 0;
                }
            });
            return entry;
        });
    };

    // Build branch stats for cards
    const buildBranchStats = () => {
        if (!analysisData || !analysisData.branches) return {};

        const stats = {};
        analysisData.branches.forEach(branch => {
            const allScores = [];

            if (branch.daily_test_data) {
                Object.values(branch.daily_test_data).forEach(data => {
                    allScores.push(data.average);
                    if (data.top_score) allScores.push(data.top_score);
                });
            }

            if (branch.mock_test_data) {
                const mt = branch.mock_test_data;
                ['maths', 'physics', 'chemistry', 'biology'].forEach(s => {
                    if (mt[s]) allScores.push(mt[s]);
                });
            }

            const avg = allScores.length > 0
                ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
                : 0;

            stats[branch.branch] = {
                average: avg,
                topScore: allScores.length > 0 ? Math.max(...allScores) : 0,
                lowest: allScores.length > 0 ? Math.min(...allScores) : 0,
                totalStudents: branch.student_count || 0
            };
        });

        return stats;
    };

    const branchColors = ['#FF6B9D', '#4A90E2', '#00D9C0', '#FFA500', '#9B59B6', '#E67E22'];
    const barChartData = buildBarChartData();
    const radarData = buildRadarData();
    const branchStats = buildBranchStats();
    const branchNames = analysisData?.branches?.map(b => b.branch) || [];

    // Get all subject keys for bar chart
    const getSubjectKeys = () => {
        const keys = new Set();
        barChartData.forEach(entry => {
            Object.keys(entry).forEach(k => {
                if (k !== 'branch') keys.add(k);
            });
        });
        return Array.from(keys);
    };

    const subjectKeys = getSubjectKeys();
    const subjectColors = {
        physics: '#FF6B9D',
        chemistry: '#4A90E2',
        biology: '#00D9C0',
        mathematics: '#FFA500',
        maths: '#FFA500'
    };

    return (
        <div className="branchwise-analysis">
            <AnalysisFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onApplyFilters={fetchAnalysis}
                showFilters={{
                    grade: true,
                    admissionNumber: true,
                    batch: true,
                    subject: false,
                    dateRange: true,
                    name: false,
                    course: false,
                    branch: false
                }}
            />

            {loading && (
                <div className="analysis-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading branchwise analysis...</p>
                </div>
            )}

            {error && (
                <div className="analysis-error">
                    <p>⚠️ {error}</p>
                    <button onClick={fetchAnalysis}>Retry</button>
                </div>
            )}

            {!loading && !error && analysisData && (
                <>
                    {/* Branch Statistics Cards */}
                    {Object.keys(branchStats).length > 0 && (
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
                                            <span className="stat-value">{stats.average}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Top Score</span>
                                            <span className="stat-value top">{stats.topScore}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Lowest</span>
                                            <span className="stat-value low">{stats.lowest}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Branch Performance Bar Chart */}
                    {barChartData.length > 0 && (
                        <div className="analysis-section">
                            <h3>📊 Branch-wise Performance Comparison</h3>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="branch" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    {subjectKeys.map(key => (
                                        <Bar
                                            key={key}
                                            dataKey={key}
                                            fill={subjectColors[key] || '#8884d8'}
                                            name={key.charAt(0).toUpperCase() + key.slice(1)}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Radar Chart */}
                    {radarData.length > 0 && branchNames.length > 0 && (
                        <div className="analysis-section">
                            <h3>🎯 Subject Strength Analysis by Branch</h3>
                            <ResponsiveContainer width="100%" height={400}>
                                <RadarChart data={radarData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" />
                                    <PolarRadiusAxis />
                                    {branchNames.map((branch, idx) => (
                                        <Radar
                                            key={branch}
                                            name={branch}
                                            dataKey={branch}
                                            stroke={branchColors[idx % branchColors.length]}
                                            fill={branchColors[idx % branchColors.length]}
                                            fillOpacity={0.3}
                                        />
                                    ))}
                                    <Legend />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Students by Branch Detail Table */}
                    {analysisData.students_by_branch && Object.keys(analysisData.students_by_branch).length > 0 && (
                        <div className="analysis-section">
                            <h3>📋 Student Details by Branch</h3>
                            {Object.entries(analysisData.students_by_branch).map(([branch, students]) => (
                                <div key={branch} className="branch-detail-section">
                                    <h4 className="branch-subtitle">{branch} ({students.length} students)</h4>
                                    <div className="marks-table">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Admission No</th>
                                                    <th>Student Name</th>
                                                    <th>Grade</th>
                                                    <th>Batch</th>
                                                    {Object.keys(students[0]?.subjects || {}).map(subj => (
                                                        <th key={subj}>{subj}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((student, idx) => (
                                                    <tr key={idx}>
                                                        <td>{student.student_id}</td>
                                                        <td className="student-name">{student.student_name}</td>
                                                        <td>{student.grade || '-'}</td>
                                                        <td>{student.batch || '-'}</td>
                                                        {Object.values(student.subjects || {}).map((val, i) => (
                                                            <td key={i}>{val}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No data message */}
                    {(!analysisData.branches || analysisData.branches.length === 0) && (
                        <div className="no-data">
                            <p>📭 No branch data found for the selected filters. Try adjusting your filter criteria.</p>
                        </div>
                    )}

                    <div className="analysis-summary">
                        <span>Total Branches: <strong>{analysisData.total_branches || 0}</strong></span>
                    </div>
                </>
            )}
        </div>
    );
};

export default BranchwiseAnalysis;
