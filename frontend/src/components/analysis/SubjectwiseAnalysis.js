import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AnalysisFilters from './AnalysisFilters';
import './Analysis.css';
import { API_BASE } from '../../config';
import { authFetch } from '../../utils/auth';

const SubjectwiseAnalysis = () => {
    const [filters, setFilters] = useState({
        grade: '',
        admissionNumber: '',
        batch: '',
        subject: '',
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
            if (filters.subject) params.append('subject', filters.subject);
            if (filters.fromDate) params.append('from_date', filters.fromDate);
            if (filters.toDate) params.append('to_date', filters.toDate);

            const response = await authFetch(`/api/analysis/subjectwise?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch analysis data');

            const data = await response.json();
            setAnalysisData(data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching subjectwise analysis:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Fetch on mount
    useEffect(() => {
        fetchAnalysis();
    }, []);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // Build chart data from API response
    const buildChartData = () => {
        if (!analysisData || !analysisData.students) return [];

        return analysisData.students.map(student => {
            const chartEntry = { student: student.student_name };

            // Add daily test averages per subject
            if (student.daily_tests) {
                Object.entries(student.daily_tests).forEach(([subject, data]) => {
                    const avg = data.count > 0 ? (data.total_marks / data.count) : 0;
                    chartEntry[subject.toLowerCase()] = Math.round(avg);
                });
            }

            // Add mock test averages if available
            if (student.mock_averages) {
                if (!chartEntry.maths && !chartEntry.mathematics) chartEntry.mathematics = student.mock_averages.maths;
                if (!chartEntry.physics) chartEntry.physics = student.mock_averages.physics;
                if (!chartEntry.chemistry) chartEntry.chemistry = student.mock_averages.chemistry;
                if (!chartEntry.biology) chartEntry.biology = student.mock_averages.biology;
            }

            return chartEntry;
        });
    };

    // Get all subjects that appear in the data
    const getSubjectKeys = () => {
        const keys = new Set();
        if (!analysisData || !analysisData.students) return [];

        analysisData.students.forEach(student => {
            if (student.daily_tests) {
                Object.keys(student.daily_tests).forEach(s => keys.add(s.toLowerCase()));
            }
            if (student.mock_averages) {
                Object.keys(student.mock_averages).forEach(s => keys.add(s));
            }
        });
        return Array.from(keys);
    };

    const subjectColors = {
        physics: '#FF6B9D',
        chemistry: '#4A90E2',
        biology: '#00D9C0',
        mathematics: '#FFA500',
        maths: '#FFA500'
    };

    const chartData = buildChartData();
    const subjectKeys = getSubjectKeys();

    return (
        <div className="subjectwise-analysis">
            <AnalysisFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onApplyFilters={fetchAnalysis}
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

            {loading && (
                <div className="analysis-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading analysis data...</p>
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
                    {/* Subject Statistics Cards */}
                    {analysisData.subject_stats && Object.keys(analysisData.subject_stats).length > 0 && (
                        <div className="stats-grid">
                            {Object.entries(analysisData.subject_stats).map(([subject, stats]) => (
                                <div key={subject} className="stat-card">
                                    <h4>{subject.charAt(0).toUpperCase() + subject.slice(1)}</h4>
                                    <div className="stat-values">
                                        <div className="stat-item">
                                            <span className="stat-label">Average</span>
                                            <span className="stat-value">{stats.average}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Top Score</span>
                                            <span className="stat-value top">{stats.top_score}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Lowest</span>
                                            <span className="stat-value low">{stats.lowest}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Tests</span>
                                            <span className="stat-value">{stats.total_tests}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Performance Chart */}
                    {chartData.length > 0 && (
                        <div className="analysis-section">
                            <h3>📊 Student Performance Comparison</h3>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="student" angle={-45} textAnchor="end" height={100} interval={0} />
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

                    {/* Detailed Table */}
                    <div className="analysis-section">
                        <h3>📋 Detailed Student Marks</h3>
                        {analysisData.students && analysisData.students.length > 0 ? (
                            <div className="marks-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Admission No</th>
                                            <th>Student Name</th>
                                            <th>Grade</th>
                                            <th>Batch</th>
                                            {subjectKeys.map(key => (
                                                <th key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analysisData.students.map((student, index) => {
                                            const row = chartData.find(d => d.student === student.student_name) || {};
                                            return (
                                                <tr key={index}>
                                                    <td>{student.student_id}</td>
                                                    <td className="student-name">{student.student_name}</td>
                                                    <td>{student.grade || '-'}</td>
                                                    <td>{student.batch || '-'}</td>
                                                    {subjectKeys.map(key => (
                                                        <td key={key}>{row[key] !== undefined ? row[key] : '-'}</td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="no-data">
                                <p>📭 No data found for the selected filters. Try adjusting your filter criteria.</p>
                            </div>
                        )}
                    </div>

                    <div className="analysis-summary">
                        <span>Total Students: <strong>{analysisData.total_students || 0}</strong></span>
                    </div>
                </>
            )}

            {!loading && !error && !analysisData && (
                <div className="no-data">
                    <p>Click "Apply Filters" to load analysis data.</p>
                </div>
            )}
        </div>
    );
};

export default SubjectwiseAnalysis;
