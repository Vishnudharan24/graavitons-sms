import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';
import './BatchPerformance.css';

const COLORS = ['#5b5fc7', '#48bb78', '#ed8936', '#e53e3e', '#38b2ac', '#d69e2e'];
const DIST_COLORS = ['#e53e3e', '#ed8936', '#48bb78', '#5b5fc7'];

const BatchPerformance = ({ batch }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testType, setTestType] = useState('both');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [subject, setSubject] = useState('');

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ test_type: testType });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (subject) params.append('subject', subject);

      const res = await authFetch(
        `${API_BASE}/api/analysis/batch-performance/${batch.batch_id}?${params}`
      );
      if (!res.ok) throw new Error('Failed to fetch performance data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [batch.batch_id, testType, dateFrom, dateTo, subject]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Gather unique subjects from daily breakdown for filter dropdown
  const availableSubjects = data?.daily_subject_breakdown?.map(s => s.subject) || [];

  if (loading) {
    return (
      <div className="perf-loading">
        <div className="perf-spinner" />
        <p>Loading performance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="perf-error">
        <p>⚠️ {error}</p>
        <button className="btn btn-primary" onClick={fetchPerformance}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const { daily_stats, mock_stats, daily_trend, mock_trend, daily_subject_breakdown,
    mock_subject_breakdown, top_students, bottom_students,
    daily_distribution, mock_distribution, participation } = data;

  // Pick which stats to show based on filter
  const showDaily = testType === 'daily' || testType === 'both';
  const showMock = testType === 'mock' || testType === 'both';

  // Combined subject data for bar chart
  const subjectChartData = [];
  if (showDaily && daily_subject_breakdown.length > 0) {
    daily_subject_breakdown.forEach(s => {
      subjectChartData.push({ subject: s.subject, 'Daily Avg': s.avg, 'Daily Top': s.top });
    });
  }
  if (showMock && mock_subject_breakdown.length > 0) {
    mock_subject_breakdown.forEach(s => {
      const existing = subjectChartData.find(d => d.subject === s.subject);
      if (existing) {
        existing['Mock Avg'] = s.avg;
        existing['Mock Top'] = s.top;
      } else {
        subjectChartData.push({ subject: s.subject, 'Mock Avg': s.avg, 'Mock Top': s.top });
      }
    });
  }

  return (
    <div className="batch-performance">
      {/* ── Filters ── */}
      <div className="perf-filters">
        <div className="filter-group">
          <label>Test Type</label>
          <select value={testType} onChange={e => setTestType(e.target.value)}>
            <option value="both">All Tests</option>
            <option value="daily">Daily Tests</option>
            <option value="mock">Mock Tests</option>
          </select>
        </div>
        <div className="filter-group">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {showDaily && availableSubjects.length > 0 && (
          <div className="filter-group">
            <label>Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {availableSubjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        {(dateFrom || dateTo || subject) && (
          <button className="btn-clear-filters" onClick={() => { setDateFrom(''); setDateTo(''); setSubject(''); }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Stat Cards ── */}
      <div className="perf-stat-cards">
        <div className="perf-stat-card">
          <h4>Total Students</h4>
          <p className="stat-value">{participation.total_students}</p>
        </div>
        {showDaily && (
          <>
            <div className="perf-stat-card accent-blue">
              <h4>Daily Test Avg</h4>
              <p className="stat-value">{daily_stats.avg_score}</p>
            </div>
            <div className="perf-stat-card accent-green">
              <h4>Daily Top Score</h4>
              <p className="stat-value">{daily_stats.top_score}</p>
            </div>
            <div className="perf-stat-card accent-orange">
              <h4>Daily Tests</h4>
              <p className="stat-value">{daily_stats.total_tests}</p>
            </div>
          </>
        )}
        {showMock && (
          <>
            <div className="perf-stat-card accent-purple">
              <h4>Mock Test Avg</h4>
              <p className="stat-value">{mock_stats.avg_score}</p>
            </div>
            <div className="perf-stat-card accent-teal">
              <h4>Mock Top Score</h4>
              <p className="stat-value">{mock_stats.top_score}</p>
            </div>
            <div className="perf-stat-card accent-yellow">
              <h4>Mock Tests</h4>
              <p className="stat-value">{mock_stats.total_tests}</p>
            </div>
          </>
        )}
        <div className="perf-stat-card">
          <h4>Participation</h4>
          <p className="stat-value">
            {showDaily && !showMock ? `${participation.daily_rate}%` :
             showMock && !showDaily ? `${participation.mock_rate}%` :
             `${Math.max(participation.daily_rate, participation.mock_rate)}%`}
          </p>
        </div>
      </div>

      {/* ── Charts Grid ── */}
      <div className="perf-charts-grid">
        {/* Daily Trend Line Chart */}
        {showDaily && daily_trend.length > 0 && (
          <div className="chart-card">
            <h4>📈 Daily Test Trend</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg" name="Average" stroke="#5b5fc7" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="top" name="Top Score" stroke="#48bb78" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="low" name="Lowest" stroke="#e53e3e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Mock Trend Line Chart */}
        {showMock && mock_trend.length > 0 && (
          <div className="chart-card">
            <h4>📈 Mock Test Trend</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mock_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg" name="Average" stroke="#5b5fc7" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="top" name="Top Score" stroke="#48bb78" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="low" name="Lowest" stroke="#e53e3e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Subject Breakdown Bar Chart */}
        {subjectChartData.length > 0 && (
          <div className="chart-card">
            <h4>📊 Subject-wise Performance</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={subjectChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {showDaily && <Bar dataKey="Daily Avg" fill="#5b5fc7" radius={[4, 4, 0, 0]} />}
                {showMock && <Bar dataKey="Mock Avg" fill="#48bb78" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Score Distribution */}
        {(showDaily && daily_distribution.length > 0) && (
          <div className="chart-card">
            <h4>📉 Daily Score Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={daily_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {daily_distribution.map((_, i) => (
                    <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {(showMock && mock_distribution.length > 0) && (
          <div className="chart-card">
            <h4>📉 Mock Score Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mock_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {mock_distribution.map((_, i) => (
                    <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Top & Bottom Students ── */}
      <div className="perf-rankings">
        {top_students.length > 0 && (
          <div className="ranking-card">
            <h4>🏆 Top 5 Students</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Daily Avg</th>
                  <th>Mock Avg</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {top_students.map((s, i) => (
                  <tr key={s.student_id}>
                    <td className="rank-badge top">{i + 1}</td>
                    <td>
                      <span className="student-name">{s.student_name}</span>
                      <span className="student-id">{s.student_id}</span>
                    </td>
                    <td>{s.daily_avg != null ? s.daily_avg : '—'}</td>
                    <td>{s.mock_avg != null ? s.mock_avg : '—'}</td>
                    <td className="overall-score">{s.overall_avg != null ? s.overall_avg : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {bottom_students.length > 0 && (
          <div className="ranking-card">
            <h4>⚠️ Bottom 5 Students</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Daily Avg</th>
                  <th>Mock Avg</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {bottom_students.map((s, i) => (
                  <tr key={s.student_id}>
                    <td className="rank-badge bottom">{i + 1}</td>
                    <td>
                      <span className="student-name">{s.student_name}</span>
                      <span className="student-id">{s.student_id}</span>
                    </td>
                    <td>{s.daily_avg != null ? s.daily_avg : '—'}</td>
                    <td>{s.mock_avg != null ? s.mock_avg : '—'}</td>
                    <td className="overall-score">{s.overall_avg != null ? s.overall_avg : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── No data state ── */}
      {daily_trend.length === 0 && mock_trend.length === 0 &&
        top_students.length === 0 && bottom_students.length === 0 && (
        <div className="perf-empty">
          <p>📋 No test data available for this batch yet.</p>
          <p>Add exams from the Students tab to see performance analytics here.</p>
        </div>
      )}
    </div>
  );
};

export default BatchPerformance;
