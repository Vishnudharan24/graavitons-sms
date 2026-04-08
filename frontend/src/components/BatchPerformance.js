import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, Brush
} from 'recharts';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';
import './BatchPerformance.css';

const COLORS = ['#5b5fc7', '#48bb78', '#ed8936', '#e53e3e', '#38b2ac', '#d69e2e'];
const DIST_COLORS = ['#e53e3e', '#ed8936', '#ecc94b', '#48bb78', '#5b5fc7', '#38b2ac', '#9f7aea', '#d69e2e'];

const AXIS_STYLE = {
  tick: { fontSize: 12, fill: '#2d3748' },
  axisLine: { stroke: '#94a3b8' },
  tickLine: { stroke: '#94a3b8' }
};

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    color: '#1e293b',
    fontSize: '12px'
  },
  itemStyle: { color: '#1e293b' },
  labelStyle: { color: '#334155', fontWeight: 600 }
};

const formatPercentMetric = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return `${value}%`;
};

const formatPlainMetric = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return value;
};

const formatTooltipMetric = (value, name) => {
  if (name === 'Students') return [formatPlainMetric(value), name];
  return [formatPercentMetric(value), name];
};

const INFO_TEXT = {
  dailyTrendChart: 'Shows test-date wise class performance for daily tests. Average % is the mean normalized score of all student attempts on that date. Top Score % is the highest normalized score. Lowest % is the minimum normalized score.',
  mockTrendChart: 'Shows test-date wise class performance for mock tests. Average %, top %, and lowest % are computed from normalized total scores for that date.',
  subjectWiseChart: 'Compares subject performance. Daily/Mock Avg % is the average normalized score in that subject. This helps identify stronger and weaker subjects.',
  dailyDistributionChart: 'Groups daily-test scores into score ranges and shows how many students fall in each range.',
  mockDistributionChart: 'Groups mock-test scores into score ranges and shows how many students fall in each range.',
  riskDashboard: 'Risk is computed from student average score, trend slope, participation rate, and non-numeric/absent mark rate. Higher score means higher concern.',
  subjectDiagnostics: 'Unit-level summary for the selected subject or all subjects. Difficulty is computed as 100 - unit average %.',
  topStudents: 'Top 5 students by overall average %. Overall % is derived from available daily and mock normalized scores.',
  bottomStudents: 'Bottom 5 students by overall average %. Use this list for immediate support planning.',
  studentCol: 'Student name and admission number.',
  riskCol: 'Risk level and score from the risk model (avg score + trend + participation + non-numeric rate).',
  avgPctCol: 'Average normalized percentage for the selected filter window.',
  participationCol: 'Attempted tests / conducted tests × 100 for the selected period.',
  unitCol: 'Chapter/topic unit name used while entering daily-test marks.',
  difficultyCol: 'Difficulty index = 100 - average %. Higher value means more difficult unit for students.',
  rankCol: 'Display position within the shown top/bottom list.',
  dailyAvgCol: 'Student average percentage from daily tests only.',
  mockAvgCol: 'Student average percentage from mock tests only.',
  overallPctCol: 'Combined average percentage across available daily + mock tests.'
};

const renderInfoLabel = (label, key) => (
  <span className="perf-label-with-info">
    <span>{label}</span>
    <span className="perf-info-icon" aria-label={INFO_TEXT[key] || ''}>i</span>
  </span>
);

const BatchPerformance = ({ batch }) => {
  const [data, setData] = useState(null);
  const [advancedStats, setAdvancedStats] = useState(null);
  const [riskDashboard, setRiskDashboard] = useState(null);
  const [subjectDiagnostics, setSubjectDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testType, setTestType] = useState('both');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [subject, setSubject] = useState('');
  const [chartSection, setChartSection] = useState('all');
  const [trendChartType, setTrendChartType] = useState('line');
  const [subjectChartType, setSubjectChartType] = useState('bar');
  const [distributionChartType, setDistributionChartType] = useState('bar');
  const [expandedChart, setExpandedChart] = useState(null);

  const toggleChartExpand = (chartId) => {
    setExpandedChart(prev => (prev === chartId ? null : chartId));
  };

  const getChartMinWidth = (pointsCount, minWidth = 760, widthPerPoint = 62, maxWidth = 3200) => {
    const count = Math.max(0, Number(pointsCount || 0));
    const calculated = Math.max(minWidth, count * widthPerPoint);
    return Math.min(maxWidth, calculated);
  };

  const isDenseData = (pointsCount) => Number(pointsCount || 0) > 10;

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

      const advancedParams = new URLSearchParams({ test_type: testType });
      if (dateFrom) advancedParams.append('date_from', dateFrom);
      if (dateTo) advancedParams.append('date_to', dateTo);
      if (subject) advancedParams.append('subject', subject);

      const riskParams = new URLSearchParams({ limit: '8' });
      if (dateFrom) riskParams.append('date_from', dateFrom);
      if (dateTo) riskParams.append('date_to', dateTo);

      const diagnosticsParams = new URLSearchParams();
      if (dateFrom) diagnosticsParams.append('date_from', dateFrom);
      if (dateTo) diagnosticsParams.append('date_to', dateTo);
      if (subject) diagnosticsParams.append('subject', subject);

      const [advancedRes, riskRes, diagnosticsRes] = await Promise.all([
        authFetch(`${API_BASE}/api/analysis/batch-advanced/${batch.batch_id}?${advancedParams}`),
        authFetch(`${API_BASE}/api/analysis/risk-dashboard/${batch.batch_id}?${riskParams}`),
        authFetch(`${API_BASE}/api/analysis/subject-diagnostics/${batch.batch_id}?${diagnosticsParams}`)
      ]);

      if (advancedRes.ok) {
        setAdvancedStats(await advancedRes.json());
      } else {
        setAdvancedStats(null);
      }

      if (riskRes.ok) {
        setRiskDashboard(await riskRes.json());
      } else {
        setRiskDashboard(null);
      }

      if (diagnosticsRes.ok) {
        setSubjectDiagnostics(await diagnosticsRes.json());
      } else {
        setSubjectDiagnostics(null);
      }
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

  useEffect(() => {
    if (expandedChart) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [expandedChart]);

  // Gather unique subjects for filter dropdown (prefer batch subjects so options remain stable after filtering)
  const availableSubjects = batch?.subjects?.length > 0
    ? batch.subjects
    : (data?.daily_subject_breakdown?.map(s => s.subject) || []);

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
  const showTrendSection = chartSection === 'all' || chartSection === 'trends';
  const showSubjectSection = chartSection === 'all' || chartSection === 'subjects';
  const showDistributionSection = chartSection === 'all' || chartSection === 'distribution';
  const showRankingSection = chartSection === 'all' || chartSection === 'rankings';

  const normalizeSubject = (value) => {
    const v = (value || '').toLowerCase().trim();
    if (v === 'maths') return 'mathematics';
    return v;
  };

  const selectedSubjectNormalized = normalizeSubject(subject);
  const matchesSelectedSubject = (label) => {
    if (!selectedSubjectNormalized) return true;
    return normalizeSubject(label) === selectedSubjectNormalized;
  };

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

  const filteredSubjectChartData = subjectChartData.filter(item => matchesSelectedSubject(item.subject));

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
        <div className="filter-group">
          <label>Chart Section</label>
          <select value={chartSection} onChange={e => setChartSection(e.target.value)}>
            <option value="all">All Charts</option>
            <option value="trends">Trends</option>
            <option value="subjects">Subject-wise</option>
            <option value="distribution">Distribution</option>
            <option value="rankings">Rankings</option>
          </select>
        </div>
        {showTrendSection && (
          <div className="filter-group">
            <label>Trend Chart</label>
            <select value={trendChartType} onChange={e => setTrendChartType(e.target.value)}>
              <option value="line">Line</option>
              <option value="area">Area</option>
            </select>
          </div>
        )}
        {showSubjectSection && (
          <div className="filter-group">
            <label>Subject Chart</label>
            <select value={subjectChartType} onChange={e => setSubjectChartType(e.target.value)}>
              <option value="bar">Bar</option>
              <option value="radar">Radar</option>
            </select>
          </div>
        )}
        {showDistributionSection && (
          <div className="filter-group">
            <label>Distribution Chart</label>
            <select value={distributionChartType} onChange={e => setDistributionChartType(e.target.value)}>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
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
              <h4>Daily Test Avg %</h4>
              <p className="stat-value">{formatPercentMetric(daily_stats.avg_score)}</p>
            </div>
            {/* <div className="perf-stat-card accent-green">
              <h4>Daily Top Score</h4>
              <p className="stat-value">{daily_stats.top_score}</p>
            </div> */}
            <div className="perf-stat-card accent-orange">
              <h4>Daily Tests</h4>
              <p className="stat-value">{daily_stats.total_tests}</p>
            </div>
          </>
        )}
        {showMock && (
          <>
            <div className="perf-stat-card accent-purple">
              <h4>Mock Test Avg %</h4>
              <p className="stat-value">{formatPercentMetric(mock_stats.avg_score)}</p>
            </div>
            <div className="perf-stat-card accent-teal">
              <h4>Mock Top Score %</h4>
              <p className="stat-value">{formatPercentMetric(mock_stats.top_score)}</p>
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

      {advancedStats && (
        <div className="perf-stat-cards" style={{ marginTop: '-6px' }}>
          <div className="perf-stat-card accent-blue">
            <h4>Median %</h4>
            <p className="stat-value">{formatPlainMetric(advancedStats.median_pct)}</p>
          </div>
          <div className="perf-stat-card accent-purple">
            <h4>Std Dev</h4>
            <p className="stat-value">{formatPlainMetric(advancedStats.stddev_pct)}</p>
          </div>
          <div className="perf-stat-card accent-teal">
            <h4>IQR</h4>
            <p className="stat-value">{formatPlainMetric(advancedStats.iqr_pct)}</p>
          </div>
          <div className="perf-stat-card accent-green">
            <h4>P90 %</h4>
            <p className="stat-value">{formatPlainMetric(advancedStats?.percentile_bands?.p90)}</p>
          </div>
          <div className="perf-stat-card accent-orange">
            <h4>Low Outliers</h4>
            <p className="stat-value">{formatPlainMetric(advancedStats?.outliers_low?.length)}</p>
          </div>
          <div className="perf-stat-card accent-yellow">
            <h4>High Outliers</h4>
            <p className="stat-value">{formatPlainMetric(advancedStats?.outliers_high?.length)}</p>
          </div>
        </div>
      )}

      {(riskDashboard || subjectDiagnostics) && (
        <div className="perf-rankings" style={{ marginTop: 0 }}>
          {riskDashboard && (
            <div className="ranking-card">
              <h4>{renderInfoLabel('🚨 Risk Dashboard', 'riskDashboard')}</h4>
              <p style={{ marginTop: 0, color: '#64748b', fontSize: '13px' }}>
                High: <strong>{riskDashboard.high_risk_count}</strong> · Medium: <strong>{riskDashboard.medium_risk_count}</strong>
              </p>
              <table>
                <thead>
                  <tr>
                    <th>{renderInfoLabel('Student', 'studentCol')}</th>
                    <th>{renderInfoLabel('Risk', 'riskCol')}</th>
                    <th>{renderInfoLabel('Avg %', 'avgPctCol')}</th>
                    <th>{renderInfoLabel('Participation', 'participationCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(riskDashboard.students || []).map((s) => (
                    <tr key={s.student_id}>
                      <td>
                        <span className="student-name">{s.student_name}</span>
                        <span className="student-id">{s.student_id}</span>
                      </td>
                      <td>{(s.risk_level || 'low').toUpperCase()} ({s.risk_score})</td>
                      <td>{s.avg_score}%</td>
                      <td>{s.participation_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subjectDiagnostics && (
            <div className="ranking-card">
              <h4>{renderInfoLabel(`🧠 Subject Diagnostics (${subjectDiagnostics.subject})`, 'subjectDiagnostics')}</h4>
              <p style={{ marginTop: 0, color: '#64748b', fontSize: '13px' }}>
                Subject Average: <strong>{subjectDiagnostics.subject_avg_pct}%</strong>
              </p>
              <table>
                <thead>
                  <tr>
                    <th>{renderInfoLabel('Unit', 'unitCol')}</th>
                    <th>{renderInfoLabel('Avg %', 'avgPctCol')}</th>
                    <th>{renderInfoLabel('Difficulty', 'difficultyCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(subjectDiagnostics.unit_breakdown || []).slice(0, 6).map((u) => (
                    <tr key={u.unit_name}>
                      <td>{u.unit_name}</td>
                      <td>{u.avg_pct}</td>
                      <td>{u.difficulty_index}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Charts Grid ── */}
      <div className="perf-charts-grid">
        {/* Daily Trend Line Chart */}
        {showTrendSection && showDaily && daily_trend.length > 0 && (
          <div className={`chart-card ${expandedChart === 'dailyTrend' ? 'chart-card-expanded' : ''}`}>
            <div className="chart-card-header">
              <h4>{renderInfoLabel('📈 Daily Test Trend', 'dailyTrendChart')}</h4>
              <button className="chart-expand-btn" onClick={() => toggleChartExpand('dailyTrend')}>
                {expandedChart === 'dailyTrend' ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
            <div className={`chart-scroll-wrap ${isDenseData(daily_trend.length) ? 'dense' : ''}`}>
              <div className="chart-scroll-inner" style={{ minWidth: `${getChartMinWidth(daily_trend.length)}px` }}>
                {trendChartType === 'line' ? (
                  <ResponsiveContainer width="100%" height={expandedChart === 'dailyTrend' ? 520 : 300}>
                    <LineChart data={daily_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" {...AXIS_STYLE} angle={-30} textAnchor="end" height={60} />
                      <YAxis {...AXIS_STYLE} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={formatTooltipMetric} />
                      <Legend />
                      <Line type="monotone" dataKey="avg" name="Average %" stroke="#5b5fc7" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="top" name="Top Score %" stroke="#48bb78" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                      <Line type="monotone" dataKey="low" name="Lowest %" stroke="#e53e3e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                      {daily_trend.length > 10 && <Brush dataKey="date" height={20} stroke="#5b5fc7" />}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={expandedChart === 'dailyTrend' ? 520 : 300}>
                    <AreaChart data={daily_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" {...AXIS_STYLE} angle={-30} textAnchor="end" height={60} />
                      <YAxis {...AXIS_STYLE} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={formatTooltipMetric} />
                      <Legend />
                      <Area type="monotone" dataKey="avg" name="Average %" stroke="#5b5fc7" fill="#5b5fc733" strokeWidth={2} />
                      <Area type="monotone" dataKey="top" name="Top Score %" stroke="#48bb78" fill="#48bb7833" strokeWidth={1.5} />
                      {daily_trend.length > 10 && <Brush dataKey="date" height={20} stroke="#5b5fc7" />}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mock Trend Line Chart */}
        {showTrendSection && showMock && mock_trend.length > 0 && (
          <div className={`chart-card ${expandedChart === 'mockTrend' ? 'chart-card-expanded' : ''}`}>
            <div className="chart-card-header">
              <h4>{renderInfoLabel('📈 Mock Test Trend', 'mockTrendChart')}</h4>
              <button className="chart-expand-btn" onClick={() => toggleChartExpand('mockTrend')}>
                {expandedChart === 'mockTrend' ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
            <div className={`chart-scroll-wrap ${isDenseData(mock_trend.length) ? 'dense' : ''}`}>
              <div className="chart-scroll-inner" style={{ minWidth: `${getChartMinWidth(mock_trend.length)}px` }}>
                {trendChartType === 'line' ? (
                  <ResponsiveContainer width="100%" height={expandedChart === 'mockTrend' ? 520 : 300}>
                    <LineChart data={mock_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" {...AXIS_STYLE} angle={-30} textAnchor="end" height={60} />
                      <YAxis {...AXIS_STYLE} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={formatTooltipMetric} />
                      <Legend />
                      <Line type="monotone" dataKey="avg" name="Average %" stroke="#5b5fc7" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="top" name="Top Score %" stroke="#48bb78" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                      <Line type="monotone" dataKey="low" name="Lowest %" stroke="#e53e3e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                      {mock_trend.length > 10 && <Brush dataKey="date" height={20} stroke="#5b5fc7" />}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={expandedChart === 'mockTrend' ? 520 : 300}>
                    <AreaChart data={mock_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" {...AXIS_STYLE} angle={-30} textAnchor="end" height={60} />
                      <YAxis {...AXIS_STYLE} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={formatTooltipMetric} />
                      <Legend />
                      <Area type="monotone" dataKey="avg" name="Average %" stroke="#5b5fc7" fill="#5b5fc733" strokeWidth={2} />
                      <Area type="monotone" dataKey="top" name="Top Score %" stroke="#48bb78" fill="#48bb7833" strokeWidth={1.5} />
                      {mock_trend.length > 10 && <Brush dataKey="date" height={20} stroke="#5b5fc7" />}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subject Breakdown Bar Chart */}
        {showSubjectSection && filteredSubjectChartData.length > 0 && (
          <div className={`chart-card ${expandedChart === 'subjectChart' ? 'chart-card-expanded' : ''}`}>
            <div className="chart-card-header">
              <h4>{renderInfoLabel('📊 Subject-wise Performance', 'subjectWiseChart')}</h4>
              <button className="chart-expand-btn" onClick={() => toggleChartExpand('subjectChart')}>
                {expandedChart === 'subjectChart' ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
            <div className={`chart-scroll-wrap ${isDenseData(filteredSubjectChartData.length) ? 'dense' : ''}`}>
              <div className="chart-scroll-inner" style={{ minWidth: `${getChartMinWidth(filteredSubjectChartData.length)}px` }}>
                {subjectChartType === 'bar' ? (
                  <ResponsiveContainer width="100%" height={expandedChart === 'subjectChart' ? 520 : 300}>
                    <BarChart data={filteredSubjectChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="subject" {...AXIS_STYLE} />
                      <YAxis {...AXIS_STYLE} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={formatTooltipMetric} />
                      <Legend />
                      {showDaily && <Bar dataKey="Daily Avg" name="Daily Avg %" fill="#5b5fc7" radius={[4, 4, 0, 0]} />}
                      {showMock && <Bar dataKey="Mock Avg" name="Mock Avg %" fill="#48bb78" radius={[4, 4, 0, 0]} />}
                      {filteredSubjectChartData.length > 8 && <Brush dataKey="subject" height={20} stroke="#5b5fc7" />}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={expandedChart === 'subjectChart' ? 520 : 300}>
                    <RadarChart data={filteredSubjectChartData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#2d3748', fontSize: 12 }} />
                      <PolarRadiusAxis />
                      <Tooltip {...TOOLTIP_STYLE} formatter={formatTooltipMetric} />
                      <Legend />
                      {showDaily && <Radar dataKey="Daily Avg" name="Daily Avg %" stroke="#5b5fc7" fill="#5b5fc7" fillOpacity={0.35} />}
                      {showMock && <Radar dataKey="Mock Avg" name="Mock Avg %" stroke="#48bb78" fill="#48bb78" fillOpacity={0.25} />}
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Score Distribution */}
        {showDistributionSection && (showDaily && daily_distribution.length > 0) && (
          <div className={`chart-card ${expandedChart === 'dailyDistribution' ? 'chart-card-expanded' : ''}`}>
            <div className="chart-card-header">
              <h4>{renderInfoLabel('📉 Daily Score Distribution', 'dailyDistributionChart')}</h4>
              <button className="chart-expand-btn" onClick={() => toggleChartExpand('dailyDistribution')}>
                {expandedChart === 'dailyDistribution' ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
            <div className={`chart-scroll-wrap ${isDenseData(daily_distribution.length) ? 'dense' : ''}`}>
              <div className="chart-scroll-inner" style={{ minWidth: `${getChartMinWidth(daily_distribution.length, 680, 80)}px` }}>
                {distributionChartType === 'bar' ? (
                  <ResponsiveContainer width="100%" height={expandedChart === 'dailyDistribution' ? 520 : 300}>
                    <BarChart data={daily_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="range" {...AXIS_STYLE} />
                      <YAxis {...AXIS_STYLE} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                        {daily_distribution.map((_, i) => (
                          <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                        ))}
                      </Bar>
                      {daily_distribution.length > 8 && <Brush dataKey="range" height={20} stroke="#5b5fc7" />}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={expandedChart === 'dailyDistribution' ? 520 : 300}>
                    <LineChart data={daily_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="range" {...AXIS_STYLE} />
                      <YAxis {...AXIS_STYLE} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="count" name="Students" stroke="#5b5fc7" strokeWidth={3} dot={{ r: 4 }} />
                      {daily_distribution.length > 8 && <Brush dataKey="range" height={20} stroke="#5b5fc7" />}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {showDistributionSection && (showMock && mock_distribution.length > 0) && (
          <div className={`chart-card ${expandedChart === 'mockDistribution' ? 'chart-card-expanded' : ''}`}>
            <div className="chart-card-header">
              <h4>{renderInfoLabel('📉 Mock Score Distribution', 'mockDistributionChart')}</h4>
              <button className="chart-expand-btn" onClick={() => toggleChartExpand('mockDistribution')}>
                {expandedChart === 'mockDistribution' ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            </div>
            <div className={`chart-scroll-wrap ${isDenseData(mock_distribution.length) ? 'dense' : ''}`}>
              <div className="chart-scroll-inner" style={{ minWidth: `${getChartMinWidth(mock_distribution.length, 680, 80)}px` }}>
                {distributionChartType === 'bar' ? (
                  <ResponsiveContainer width="100%" height={expandedChart === 'mockDistribution' ? 520 : 300}>
                    <BarChart data={mock_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="range" {...AXIS_STYLE} />
                      <YAxis {...AXIS_STYLE} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                        {mock_distribution.map((_, i) => (
                          <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                        ))}
                      </Bar>
                      {mock_distribution.length > 8 && <Brush dataKey="range" height={20} stroke="#38b2ac" />}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={expandedChart === 'mockDistribution' ? 520 : 300}>
                    <LineChart data={mock_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="range" {...AXIS_STYLE} />
                      <YAxis {...AXIS_STYLE} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="count" name="Students" stroke="#38b2ac" strokeWidth={3} dot={{ r: 4 }} />
                      {mock_distribution.length > 8 && <Brush dataKey="range" height={20} stroke="#38b2ac" />}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {expandedChart && <div className="chart-fullscreen-backdrop" onClick={() => setExpandedChart(null)} />}

      {/* ── Top & Bottom Students ── */}
      {showRankingSection && <div className="perf-rankings">
        {top_students.length > 0 && (
          <div className="ranking-card">
            <h4>{renderInfoLabel('🏆 Top 5 Students', 'topStudents')}</h4>
            <table>
              <thead>
                <tr>
                  <th>{renderInfoLabel('#', 'rankCol')}</th>
                  <th>{renderInfoLabel('Student', 'studentCol')}</th>
                  <th>{renderInfoLabel('Daily Avg', 'dailyAvgCol')}</th>
                  <th>{renderInfoLabel('Mock Avg', 'mockAvgCol')}</th>
                  <th>{renderInfoLabel('Overall %', 'overallPctCol')}</th>
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
                    <td>{s.daily_avg != null ? `${s.daily_avg}%` : '—'}</td>
                    <td>{s.mock_avg != null ? `${s.mock_avg}%` : '—'}</td>
                    <td className="overall-score">{s.overall_avg != null ? `${s.overall_avg}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {bottom_students.length > 0 && (
          <div className="ranking-card">
            <h4>{renderInfoLabel('⚠️ Bottom 5 Students', 'bottomStudents')}</h4>
            <table>
              <thead>
                <tr>
                  <th>{renderInfoLabel('#', 'rankCol')}</th>
                  <th>{renderInfoLabel('Student', 'studentCol')}</th>
                  <th>{renderInfoLabel('Daily Avg', 'dailyAvgCol')}</th>
                  <th>{renderInfoLabel('Mock Avg', 'mockAvgCol')}</th>
                  <th>{renderInfoLabel('Overall %', 'overallPctCol')}</th>
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
                    <td>{s.daily_avg != null ? `${s.daily_avg}%` : '—'}</td>
                    <td>{s.mock_avg != null ? `${s.mock_avg}%` : '—'}</td>
                    <td className="overall-score">{s.overall_avg != null ? `${s.overall_avg}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

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
