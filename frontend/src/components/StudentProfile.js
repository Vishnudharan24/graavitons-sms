import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './StudentProfile.css';
import { API_BASE, DEFAULT_AVATAR } from '../config';
import { authFetch } from '../utils/api';

// Helper: safely parse a mark value to a number, returning null for non-numeric values like 'A', '-'
const parseNumericMark = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

// Helper: display a mark value — shows 0 as '0', null/undefined as fallback
const displayMark = (val, fallback = '-') => {
  if (val === null || val === undefined || val === '') return fallback;
  return val;
};

const displayMarkWithTotal = (obtained, total, fallback = '-') => {
  const shownObtained = displayMark(obtained, fallback);
  if (total === null || total === undefined || total === '') {
    return shownObtained === fallback ? fallback : `${shownObtained}/N/A`;
  }
  return `${shownObtained}/${total}`;
};

const toPercentage = (obtained, total) => {
  const obtainedNum = parseNumericMark(obtained);
  const totalNum = parseNumericMark(total);
  if (obtainedNum === null || totalNum === null || totalNum <= 0) return null;
  return Number(((obtainedNum * 100) / totalNum).toFixed(1));
};

const isAbsentMark = (value) => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'a' || normalized === 'ab';
};

const chartAxisStyle = {
  tick: { fontSize: 12, fill: '#2d3748' },
  axisLine: { stroke: '#94a3b8' },
  tickLine: { stroke: '#94a3b8' }
};

const chartTooltipStyle = {
  contentStyle: {
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    color: '#1e293b',
    fontSize: '12px'
  },
  itemStyle: { color: '#1e293b' },
  labelStyle: { color: '#334155', fontWeight: 600 }
};

const StudentProfile = ({ student, batchStats, onBack }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [dailyTests, setDailyTests] = useState([]);
  const [mockTests, setMockTests] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [studentMetrics, setStudentMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [studentTestInsights, setStudentTestInsights] = useState({ daily: [], mock: [], combined_latest: [] });
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightTab, setInsightTab] = useState('mock');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [dailyDateFrom, setDailyDateFrom] = useState('');
  const [dailyDateTo, setDailyDateTo] = useState('');
  const [mockDateFrom, setMockDateFrom] = useState('');
  const [mockDateTo, setMockDateTo] = useState('');
  const [dailyChartType, setDailyChartType] = useState('line');
  const [mockChartType, setMockChartType] = useState('grouped');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState({
    date: new Date().toISOString().split('T')[0],
    teacherFeedback: '',
    suggestions: '',
    academicDirectorSignature: '',
    studentSignature: '',
    parentSignature: ''
  });
  const reportExportRef = useRef(null);

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

      // Fetch analysis + metrics + per-test insights in parallel for faster page load
      setMetricsLoading(true);
      setInsightsLoading(true);
      const [analysisReq, metricsReq, insightsReq] = await Promise.allSettled([
        authFetch(`${API_BASE}/api/analysis/individual/${studentId}`),
        authFetch(`${API_BASE}/api/analysis/student-metrics/${studentId}`),
        authFetch(`${API_BASE}/api/analysis/student-test-insights/${studentId}?test_type=both&limit=6`)
      ]);

      // Analysis bundle
      try {
        if (analysisReq.status === 'fulfilled' && analysisReq.value.ok) {
          const analysisResult = await analysisReq.value.json();
          setAnalysisData(analysisResult);
          setDailyTests(analysisResult.daily_tests || []);
          setMockTests(analysisResult.mock_tests || []);
          setFeedbackList(analysisResult.feedback || []);
        } else {
          setAnalysisData(null);
          setDailyTests([]);
          setMockTests([]);
          await fetchFeedback();
        }
      } catch (err) {
        console.error('Error resolving analysis data:', err);
        setAnalysisData(null);
        setDailyTests([]);
        setMockTests([]);
        await fetchFeedback();
      }

      // Metrics
      try {
        if (metricsReq.status === 'fulfilled' && metricsReq.value.ok) {
          const metricsResult = await metricsReq.value.json();
          setStudentMetrics(metricsResult);
        } else {
          setStudentMetrics(null);
        }
      } catch (err) {
        console.error('Error fetching student metrics:', err);
        setStudentMetrics(null);
      } finally {
        setMetricsLoading(false);
      }

      // Per-test insights
      try {
        if (insightsReq.status === 'fulfilled' && insightsReq.value.ok) {
          const insightsResult = await insightsReq.value.json();
          setStudentTestInsights(insightsResult.insights || { daily: [], mock: [], combined_latest: [] });
        } else {
          setStudentTestInsights({ daily: [], mock: [], combined_latest: [] });
        }
      } catch (err) {
        console.error('Error fetching student test insights:', err);
        setStudentTestInsights({ daily: [], mock: [], combined_latest: [] });
      } finally {
        setInsightsLoading(false);
      }
      
    } catch (err) {
      console.error('Error fetching student data:', err);
      setError(err.message);
      setMetricsLoading(false);
      setInsightsLoading(false);
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
  const safeStudentData = studentData || {};
  const displayData = {
    // Basic Information
    name: safeStudentData.student_name || 'N/A',
    dob: formatDate(safeStudentData.dob),
    grade: safeStudentData.grade || 'N/A',
    community: safeStudentData.community || 'N/A',
    academicYear: safeStudentData.enrollment_year || 'N/A',
    course: safeStudentData.course || 'N/A',
    branch: safeStudentData.branch || 'N/A',
    rollNo: safeStudentData.student_id || 'N/A',
    gender: safeStudentData.gender || 'N/A',

    // Contact Information
    studentMobile: safeStudentData.student_mobile || 'N/A',
    aadharNumber: safeStudentData.aadhar_no || 'N/A',
    aasarId: safeStudentData.apaar_id || 'N/A',
    emailId: safeStudentData.email || 'N/A',

    // Personal Information
    schoolName: safeStudentData.school_name || 'N/A',
    guardianName: safeStudentData.guardian_name || 'N/A',
    guardianOccupation: safeStudentData.guardian_occupation || 'N/A',
    guardianContact: safeStudentData.guardian_mobile || 'N/A',
    guardianEmail: safeStudentData.guardian_email || 'N/A',
    fatherName: safeStudentData.father_name || 'N/A',
    fatherOccupation: safeStudentData.father_occupation || 'N/A',
    fatherContact: safeStudentData.father_mobile || 'N/A',
    fatherEmail: safeStudentData.father_email || 'N/A',
    motherName: safeStudentData.mother_name || 'N/A',
    motherOccupation: safeStudentData.mother_occupation || 'N/A',
    motherContact: safeStudentData.mother_mobile || 'N/A',
    motherEmail: safeStudentData.mother_email || 'N/A',
    siblingName: safeStudentData.sibling_name || 'N/A',
    siblingGrade: safeStudentData.sibling_grade || 'N/A',
    siblingSchool: safeStudentData.sibling_school || 'N/A',
    siblingCollege: safeStudentData.sibling_college || 'N/A',

    // 10th Standard Marks
    std10Marks: {
      schoolName: safeStudentData.tenth_school_name || 'N/A',
      yearOfPassing: safeStudentData.tenth_year_of_passing || 'N/A',
      boardOfStudy: safeStudentData.tenth_board_of_study || 'N/A',
      english: displayMark(safeStudentData.tenth_english),
      tamil: displayMark(safeStudentData.tenth_tamil),
      hindi: displayMark(safeStudentData.tenth_hindi),
      maths: displayMark(safeStudentData.tenth_maths),
      science: displayMark(safeStudentData.tenth_science),
      socialScience: displayMark(safeStudentData.tenth_social_science),
      total: displayMark(safeStudentData.tenth_total_marks)
    },

    // 12th Standard Marks
    std12Marks: {
      schoolName: safeStudentData.twelfth_school_name || 'N/A',
      yearOfPassing: safeStudentData.twelfth_year_of_passing || 'N/A',
      boardOfStudy: safeStudentData.twelfth_board_of_study || 'N/A',
      english: displayMark(safeStudentData.twelfth_english),
      tamil: displayMark(safeStudentData.twelfth_tamil),
      physics: displayMark(safeStudentData.twelfth_physics),
      chemistry: displayMark(safeStudentData.twelfth_chemistry),
      mathematics: displayMark(safeStudentData.twelfth_maths),
      biology: displayMark(safeStudentData.twelfth_biology),
      computerScience: displayMark(safeStudentData.twelfth_computer_science),
      total: displayMark(safeStudentData.twelfth_total_marks)
    },

    // Entrance Exam Marks
    entranceExams: safeStudentData.entrance_exams || [],

    // Counselling Details
    counselling: {
      forum: safeStudentData.counselling_forum || 'N/A',
      round: safeStudentData.counselling_round || 'N/A',
      collegeAlloted: safeStudentData.counselling_college_alloted || 'N/A',
      yearOfCompletion: safeStudentData.counselling_year_of_completion || 'N/A'
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
    const hasDailyTotals = filteredDailyTests.some(test => parseNumericMark(test.subject_total_marks ?? test.test_total_marks) !== null);
    const byDate = {};
    filteredDailyTests.forEach(test => {
      const d = test.test_date || 'Unknown';
      if (!byDate[d]) byDate[d] = { marks: [], classAvg: [] };
      const effectiveTotal = test.subject_total_marks ?? test.test_total_marks;
      const numMark = hasDailyTotals
        ? (toPercentage(test.marks, effectiveTotal) ?? parseNumericMark(test.marks))
        : parseNumericMark(test.marks);
      const numAvg = hasDailyTotals
        ? (toPercentage(test.class_avg, effectiveTotal) ?? parseNumericMark(test.class_avg))
        : parseNumericMark(test.class_avg);
      if (numMark !== null) byDate[d].marks.push(numMark);
      if (numAvg !== null) byDate[d].classAvg.push(numAvg);
    });
    return Object.entries(byDate).sort().map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      score: data.marks.length > 0 ? Math.round(data.marks.reduce((a, b) => a + b, 0) / data.marks.length) : null,
      classAvg: data.classAvg.length > 0 ? Math.round(data.classAvg.reduce((a, b) => a + b, 0) / data.classAvg.length) : null,
      unit: hasDailyTotals ? '%' : 'marks'
    }));
  };

  // Build mock test chart data from filtered mock tests
  const buildMockTestChartData = () => {
    if (!filteredMockTests || filteredMockTests.length === 0) return [];
    const hasMockSubjectTotals = filteredMockTests.some(test =>
      parseNumericMark(test.maths_total_marks) !== null ||
      parseNumericMark(test.physics_total_marks) !== null ||
      parseNumericMark(test.chemistry_total_marks) !== null ||
      parseNumericMark(test.biology_total_marks) !== null
    );

    const getSubjectValue = (obtained, total) => {
      if (!hasMockSubjectTotals) return parseNumericMark(obtained);
      return toPercentage(obtained, total) ?? parseNumericMark(obtained);
    };

    return filteredMockTests.map((test, idx) => ({
      exam: `Mock ${idx + 1} (${test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''})`,
      physics: getSubjectValue(test.physics_marks, test.physics_total_marks),
      chemistry: getSubjectValue(test.chemistry_marks, test.chemistry_total_marks),
      biology: getSubjectValue(test.biology_marks, test.biology_total_marks),
      maths: getSubjectValue(test.maths_marks, test.maths_total_marks),
      total: getSubjectValue(test.total_marks, test.test_total_marks),
      unit: hasMockSubjectTotals ? '%' : 'marks'
    }));
  };

  const buildMockTrendData = () => {
    if (!filteredMockTests || filteredMockTests.length === 0) return [];
    const hasMockTotal = filteredMockTests.some(test => parseNumericMark(test.test_total_marks) !== null);
    return filteredMockTests.map((test, idx) => ({
      exam: `Mock ${idx + 1}`,
      date: test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-',
      total: hasMockTotal
        ? (toPercentage(test.total_marks, test.test_total_marks) ?? parseNumericMark(test.total_marks))
        : parseNumericMark(test.total_marks),
      classAvg: hasMockTotal
        ? (toPercentage(test.class_avg_total, test.test_total_marks) ?? parseNumericMark(test.class_avg_total))
        : parseNumericMark(test.class_avg_total),
      topScore: hasMockTotal
        ? (toPercentage(test.top_score_total, test.test_total_marks) ?? parseNumericMark(test.top_score_total))
        : parseNumericMark(test.top_score_total),
      unit: hasMockTotal ? '%' : 'marks'
    }));
  };

  const buildLatestMockSubjectShare = () => {
    if (!filteredMockTests || filteredMockTests.length === 0) return [];
    const lastMock = filteredMockTests[filteredMockTests.length - 1];
    const hasMockSubjectTotals =
      parseNumericMark(lastMock.maths_total_marks) !== null ||
      parseNumericMark(lastMock.physics_total_marks) !== null ||
      parseNumericMark(lastMock.chemistry_total_marks) !== null ||
      parseNumericMark(lastMock.biology_total_marks) !== null;

    const getLatestValue = (obtained, total) => {
      if (!hasMockSubjectTotals) return parseNumericMark(obtained);
      return toPercentage(obtained, total) ?? parseNumericMark(obtained);
    };

    const rows = [
      { name: 'Maths', value: getLatestValue(lastMock.maths_marks, lastMock.maths_total_marks), fill: '#f1ed08' },
      { name: 'Physics', value: getLatestValue(lastMock.physics_marks, lastMock.physics_total_marks), fill: '#FF6B9D' },
      { name: 'Chemistry', value: getLatestValue(lastMock.chemistry_marks, lastMock.chemistry_total_marks), fill: '#4A90E2' },
      { name: 'Biology', value: getLatestValue(lastMock.biology_marks, lastMock.biology_total_marks), fill: '#00D9C0' }
    ];
    return rows.filter(r => r.value > 0);
  };

  const formatMockTopics = (exam) => {
    const topics = [
      { label: 'Maths', units: exam.maths_unit_names },
      { label: 'Physics', units: exam.physics_unit_names },
      { label: 'Chemistry', units: exam.chemistry_unit_names },
      { label: 'Biology', units: exam.biology_unit_names },
    ];

    const formatted = topics
      .map(({ label, units }) => {
        const list = Array.isArray(units)
          ? units.filter(Boolean)
          : (units ? [units] : []);
        if (list.length === 0) return null;
        return `${label}: ${list.join(', ')}`;
      })
      .filter(Boolean);

    return formatted.length > 0 ? formatted.join(' | ') : 'N/A';
  };

  const performanceTrend = buildPerformanceTrend();
  const mockTestChartData = buildMockTestChartData();
  const mockTrendData = buildMockTrendData();
  const latestMockSubjectShare = buildLatestMockSubjectShare();

  const reportTests = useMemo(() => {
    if (!mockTests || mockTests.length === 0) return [];
    return [...mockTests]
      .filter((test) => test?.test_date)
      .sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
  }, [mockTests]);

  const reportSubjectMeta = useMemo(() => ({
    maths: { label: 'Maths', color: '#f1ed08' },
    physics: { label: 'Physics', color: '#3366ff' },
    chemistry: { label: 'Chemistry', color: '#00b894' },
    biology: { label: 'Biology', color: '#ff1744' }
  }), []);

  const reportSubjectKeys = useMemo(() => {
    const subjectDisplayPriority = ['physics', 'chemistry', 'maths', 'biology'];
    const normalizedFromBatch = (analysisData?.student?.batch_subjects || [])
      .map((raw) => String(raw || '').trim().toLowerCase())
      .map((raw) => (raw === 'mathematics' ? 'maths' : raw))
      .filter((key) => ['maths', 'physics', 'chemistry', 'biology'].includes(key));

    const uniqueFromBatch = [...new Set(normalizedFromBatch)]
      .sort((a, b) => subjectDisplayPriority.indexOf(a) - subjectDisplayPriority.indexOf(b));
    if (uniqueFromBatch.length >= 3) return uniqueFromBatch.slice(0, 3);

    const presentInMock = subjectDisplayPriority.filter((key) =>
      reportTests.some((test) => parseNumericMark(test[`${key}_marks`]) !== null)
    );

    const merged = [...new Set([...uniqueFromBatch, ...presentInMock, ...subjectDisplayPriority])];
    return merged.slice(0, 3);
  }, [analysisData, reportTests]);

  const buildReportPointLabel = (test, index) => {
    if (test?.test_name) return test.test_name;
    return `MT-${index + 1}`;
  };

  const dailySubjectComparisonReportData = useMemo(() => {
    const timeline = {};
    (dailyTests || []).forEach((test) => {
      if (!test?.test_date || !test?.subject) return;
      const subjectKey = String(test.subject).trim().toLowerCase() === 'mathematics'
        ? 'maths'
        : String(test.subject).trim().toLowerCase();

      if (!reportSubjectKeys.includes(subjectKey)) return;

      if (!timeline[test.test_date]) {
        timeline[test.test_date] = { label: `DT-${Object.keys(timeline).length + 1}` };
      }

      const score = toPercentage(test.marks, test.subject_total_marks ?? test.test_total_marks)
        ?? parseNumericMark(test.marks);

      if (score !== null) {
        timeline[test.test_date][subjectKey] = Math.round(score);
      }
    });

    return Object.entries(timeline)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([, row], idx) => ({ ...row, label: `DT-${idx + 1}` }));
  }, [dailyTests, reportSubjectKeys]);

  const totalComparisonReportData = useMemo(() => {
    const roundedOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return Number.isNaN(num) ? null : Math.round(num);
    };

    const sumNumericFields = (test, fields) => {
      let sum = 0;
      let hasAny = false;

      fields.forEach((field) => {
        const val = parseNumericMark(test[field]);
        if (val !== null) {
          sum += val;
          hasAny = true;
        }
      });

      return hasAny ? sum : null;
    };

    return reportTests.map((test, index) => {
      const student = parseNumericMark(test.report_student_total)
        ?? sumNumericFields(
        test,
        reportSubjectKeys.map((key) => `${key}_marks`)
      );
      const high = parseNumericMark(test.report_class_high_total)
        ?? sumNumericFields(
        test,
        reportSubjectKeys.map((key) => `class_high_${key}`)
      );
      const average = parseNumericMark(test.report_class_avg_total)
        ?? sumNumericFields(
        test,
        reportSubjectKeys.map((key) => `class_avg_${key}`)
      );
      const low = parseNumericMark(test.report_class_low_total)
        ?? sumNumericFields(
        test,
        reportSubjectKeys.map((key) => `class_low_${key}`)
      );

      return {
        label: buildReportPointLabel(test, index),
        student: roundedOrNull(student),
        high: roundedOrNull(high),
        average: roundedOrNull(average),
        low: roundedOrNull(low)
      };
    });
  }, [reportTests, reportSubjectKeys]);

  const buildMockSubjectVsClassData = useCallback((subjectKey) => {
    return reportTests.map((test, index) => {
      const student = toPercentage(test[`${subjectKey}_marks`], test[`${subjectKey}_total_marks`])
        ?? parseNumericMark(test[`${subjectKey}_marks`]);
      const average = toPercentage(test[`class_avg_${subjectKey}`], test[`${subjectKey}_total_marks`])
        ?? parseNumericMark(test[`class_avg_${subjectKey}`]);
      const high = toPercentage(test[`class_high_${subjectKey}`], test[`${subjectKey}_total_marks`])
        ?? parseNumericMark(test[`class_high_${subjectKey}`]);
      const low = toPercentage(test[`class_low_${subjectKey}`], test[`${subjectKey}_total_marks`])
        ?? parseNumericMark(test[`class_low_${subjectKey}`]);

      return {
        label: buildReportPointLabel(test, index),
        student: student !== null ? Math.round(student) : null,
        high: high !== null ? Math.round(high) : null,
        average: average !== null ? Math.round(average) : null,
        low: low !== null ? Math.round(low) : null
      };
    });
  }, [reportTests]);

  const mockSubjectVsClassReportData = useMemo(() => {
    const report = {};
    reportSubjectKeys.forEach((subjectKey) => {
      report[subjectKey] = buildMockSubjectVsClassData(subjectKey);
    });
    return report;
  }, [reportSubjectKeys, buildMockSubjectVsClassData]);

  const dailyAttemptedCount = useMemo(() => {
    const keySet = new Set(
      (dailyTests || [])
        .filter((t) => !isAbsentMark(t.marks))
        .map((t) => `${t.test_date || ''}::${(t.subject || '').toLowerCase()}::${t.unit_name || ''}`)
    );
    return keySet.size;
  }, [dailyTests]);

  const mockAttemptedCount = useMemo(() => {
    const hasAbsentInMockTest = (test) => {
      const markFields = [
        test?.total_marks,
        test?.maths_marks,
        test?.physics_marks,
        test?.chemistry_marks,
        test?.biology_marks
      ];
      return markFields.some((value) => isAbsentMark(value));
    };

    const keySet = new Set(
      (mockTests || [])
        .filter((t) => !hasAbsentInMockTest(t))
        .map((t) => `${t.test_id || ''}::${t.test_date || ''}`)
    );
    return keySet.size;
  }, [mockTests]);

  const attendanceSummaryRows = useMemo(() => {
    const weeklyConducted = Number(studentMetrics?.daily_tests_conducted ?? dailyAttemptedCount);
    const weeklyAttended = Number(studentMetrics?.daily_tests_attended ?? dailyAttemptedCount);
    const mockConducted = Number(studentMetrics?.mock_tests_conducted ?? mockAttemptedCount);
    const mockAttended = Number(studentMetrics?.mock_tests_attended ?? mockAttemptedCount);

    return [
      {
        testType: 'Daily Test',
        conducted: weeklyConducted,
        attended: weeklyAttended,
        summary: `${weeklyAttended}/${weeklyConducted || 0}`
      },
      {
        testType: 'Mock Test',
        conducted: mockConducted,
        attended: mockAttended,
        summary: `${mockAttended}/${mockConducted || 0}`
      }
    ];
  }, [studentMetrics, dailyAttemptedCount, mockAttemptedCount]);

  const activeInsightRows = useMemo(() => {
    if (insightTab === 'daily') return studentTestInsights?.daily || [];
    return studentTestInsights?.mock || [];
  }, [insightTab, studentTestInsights]);

  const pdfInsightRows = useMemo(() => {
    return (studentTestInsights?.combined_latest || []).slice(0, 6);
  }, [studentTestInsights]);

  const pdfChartMargin = { top: 20, right: 26, left: 30, bottom: 8 };
  const pdfAxisTickStyle = { fontSize: 13, fill: '#374151', fontWeight: 500 };
  const pdfXAxisProps = {
    tick: pdfAxisTickStyle,
    tickMargin: 10,
    axisLine: { stroke: '#d1d5db' },
    tickLine: { stroke: '#d1d5db' },
    padding: { left: 24, right: 18 }
  };
  const pdfYAxisProps = {
    tick: pdfAxisTickStyle,
    axisLine: { stroke: '#d1d5db' },
    tickLine: { stroke: '#d1d5db' }
  };
  const pdfLegendProps = {
    iconType: 'circle',
    wrapperStyle: {
      fontSize: 11,
      color: '#374151',
      paddingTop: 4
    }
  };

  const renderPdfDotWithValue = (color, yOffset = 0, seriesKeys = []) => ({ cx, cy, payload, dataKey }) => {
    const rawValue = payload?.[dataKey];
    const num = Number(rawValue);
    const isNumeric = rawValue !== null && rawValue !== undefined && rawValue !== '' && !Number.isNaN(num);

    if (!isNumeric || !Number.isFinite(Number(cx)) || !Number.isFinite(Number(cy))) {
      return null;
    }

    const nearYAxis = Number(cx) <= 96;
    const labelX = nearYAxis ? Number(cx) + 24 : Number(cx);
    const labelAnchor = nearYAxis ? 'start' : 'middle';

    let stackedOffset = 0;
    if (Array.isArray(seriesKeys) && seriesKeys.length > 0 && payload) {
      const seriesValues = seriesKeys
        .map((key) => {
          const value = Number(payload[key]);
          return Number.isNaN(value) ? null : { key, value };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (b.value !== a.value) return b.value - a.value;
          return a.key.localeCompare(b.key);
        });

      const rank = seriesValues.findIndex((entry) => entry.key === dataKey);
      const rankOffsets = [-20, -8, 8, 20, 32];
      if (rank >= 0) stackedOffset = rankOffsets[Math.min(rank, rankOffsets.length - 1)];
    }

    const baseY = Number(cy) + stackedOffset + yOffset;
    const labelY = baseY < 14 ? Number(cy) + 14 : (baseY > 244 ? Number(cy) - 10 : baseY);

    const shown = isNumeric ? String(Math.round(num)) : '';

    return (
      <g>
        <circle cx={cx} cy={cy} r={2.8} fill={color} stroke={color} strokeWidth={1} />
        {isNumeric && (
          <text
            x={labelX}
            y={labelY}
            fill={color}
            fontSize={11}
            fontWeight={600}
            textAnchor={labelAnchor}
            stroke="#ffffff"
            strokeWidth={2}
            paintOrder="stroke"
          >
            {shown}
          </text>
        )}
      </g>
    );
  };

  const exportStudentPdfReport = async () => {
    const hasMockData = reportTests.length > 0;
    const hasDailyData = dailySubjectComparisonReportData.length > 0;

    if (exportingPdf || (!hasMockData && !hasDailyData)) {
      if (!hasMockData && !hasDailyData) {
        alert('No mock/daily test data available to generate PDF report.');
      }
      return;
    }

    const root = reportExportRef.current;
    if (!root) return;

    try {
      setExportingPdf(true);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pages = Array.from(root.querySelectorAll('.student-pdf-page'));

      for (let i = 0; i < pages.length; i += 1) {
        const page = pages[i];
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        const renderWidth = imgWidth * ratio;
        const renderHeight = imgHeight * ratio;
        const x = (pageWidth - renderWidth) / 2;
        const y = (pageHeight - renderHeight) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, renderWidth, renderHeight, undefined, 'FAST');
      }

      const fileName = `${displayData.name.replace(/\s+/g, '_')}_${displayData.rollNo}_Progress_Report.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const metricInfo = {
    overallAverage: 'This is your average performance across all available tests. Higher is better.',
    batchPercentile: 'This shows where you stand in your batch. 70% means you scored better than about 70 out of 100 classmates.',
    participationRate: 'This is how many tests you attended compared to tests conducted for your batch. 100% means you attended all.',
    consistency: 'This shows how steady your marks are. Lower value = more consistent performance; higher value = marks are fluctuating more.',
    trendSlope: 'This shows whether your performance is improving or dropping over time. Positive = improving, negative = declining.',
    riskLevel: 'This is an overall alert level based on score, trend, participation, and absences/non-numeric marks. Low is good, High needs attention.'
  };

  const renderInsightMetric = (metric = {}) => {
    if (metric.delta !== undefined && metric.delta !== null) {
      const val = Number(metric.delta);
      const sign = val > 0 ? '+' : '';
      return `${sign}${val}`;
    }
    if (metric.rank !== undefined && metric.total !== undefined) {
      return `#${metric.rank}/${metric.total}`;
    }
    if (metric.subjects && Array.isArray(metric.subjects)) {
      return metric.subjects.join(', ');
    }
    if (metric.delta_vs_avg !== undefined && metric.delta_vs_avg !== null) {
      const val = Number(metric.delta_vs_avg);
      const sign = val > 0 ? '+' : '';
      return `${sign}${val} vs avg`;
    }
    return null;
  };

  const renderPdfScoreSummary = (testInsight) => {
    const parts = [];
    if (testInsight?.score !== null && testInsight?.score !== undefined) {
      const scoreVal = Number(testInsight.score);
      if (!Number.isNaN(scoreVal)) parts.push(`Score: ${Math.round(scoreVal)}`);
    }
    if (testInsight?.class_avg !== null && testInsight?.class_avg !== undefined) {
      const avgVal = Number(testInsight.class_avg);
      if (!Number.isNaN(avgVal)) parts.push(`Class Avg: ${Math.round(avgVal)}`);
    }
    if (testInsight?.rank && testInsight?.rank_total) {
      parts.push(`Rank: #${testInsight.rank}/${testInsight.rank_total}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'No score summary available';
  };

  const renderMetricLabel = (label, infoKey) => (
    <span className="metric-label-with-help">
      {label}
      <span
        className="metric-help-icon"
        title={metricInfo[infoKey]}
        aria-label={metricInfo[infoKey]}
      >
        ⓘ
      </span>
    </span>
  );

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
          displayMark(exam.exam_name, '-'),
          displayMark(exam.physics_marks),
          displayMark(exam.chemistry_marks),
          displayMark(exam.maths_marks),
          displayMark(exam.biology_marks),
          displayMark(exam.total_marks),
          displayMark(exam.overall_rank),
          displayMark(exam.community_rank)
        ]);
      });
    }

    const wsAcademic = XLSX.utils.aoa_to_sheet(academicRows);
    wsAcademic['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsAcademic, 'Academic Marks');

    // ===== Sheet 3: Daily Test Performance =====
    if (dailyTests.length > 0) {
      const dailyHeader = ['Date', 'Subject', 'Unit Name', 'Marks (Obtained/Total)', 'Class Avg', 'Top Score'];
      const dailyRows = dailyTests.map(test => [
        test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : '-',
        test.subject || '-',
        test.unit_name || '-',
        displayMarkWithTotal(test.marks, test.subject_total_marks ?? test.test_total_marks, 0),
        displayMarkWithTotal(test.class_avg, test.subject_total_marks ?? test.test_total_marks, 0),
        displayMarkWithTotal(test.top_score, test.subject_total_marks ?? test.test_total_marks, 0)
      ]);
      const wsDaily = XLSX.utils.aoa_to_sheet([['DAILY TEST PERFORMANCE'], [], dailyHeader, ...dailyRows]);
      wsDaily['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Tests');
    }

    // ===== Sheet 4: Mock Test Performance =====
    if (mockTests.length > 0) {
      const mockHeader = ['Date', 'Maths (Obtained/Total)', 'Physics (Obtained/Total)', 'Chemistry (Obtained/Total)', 'Biology (Obtained/Total)', 'Total (Obtained/Total)', 'Class Avg', 'Top Score'];
      const mockRows = mockTests.map(test => [
        test.test_date ? new Date(test.test_date).toLocaleDateString('en-IN') : '-',
        displayMarkWithTotal(test.maths_marks, test.maths_total_marks, 0),
        displayMarkWithTotal(test.physics_marks, test.physics_total_marks, 0),
        displayMarkWithTotal(test.chemistry_marks, test.chemistry_total_marks, 0),
        displayMarkWithTotal(test.biology_marks, test.biology_total_marks, 0),
        displayMarkWithTotal(test.total_marks, test.test_total_marks, 0),
        displayMarkWithTotal(test.class_avg_total, test.test_total_marks, 0),
        displayMarkWithTotal(test.top_score_total, test.test_total_marks, 0)
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

  return (
    <div className="student-profile">
      <div className="profile-header">
        <div className="profile-header-actions">
          <button className="back-button" onClick={onBack}>← Back to Students</button>
          <button className="btn-download-report" onClick={exportStudentPdfReport} disabled={exportingPdf}>
            {exportingPdf ? '⏳ Generating PDF...' : '📄 Download Progress PDF'}
          </button>
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
                        <td>{displayMark(exam.physics_marks)}</td>
                        <td>{displayMark(exam.chemistry_marks)}</td>
                        <td>{displayMark(exam.maths_marks)}</td>
                        <td>{displayMark(exam.biology_marks)}</td>
                        <td><strong>{displayMark(exam.total_marks)}</strong></td>
                        <td>{displayMark(exam.overall_rank)}</td>
                        <td>{displayMark(exam.community_rank)}</td>
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
          <div className="profile-section">
            <h3>📌 Advanced Performance Metrics</h3>
            {metricsLoading ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Loading advanced metrics...</p>
            ) : studentMetrics ? (
              <>
                <div className="student-metrics-grid">
                  <div className="student-metric-card">
                    <label>{renderMetricLabel('Overall Average', 'overallAverage')}</label>
                    <p>{studentMetrics.overall_avg_pct}%</p>
                  </div>
                  <div className="student-metric-card">
                    <label>{renderMetricLabel('Batch Percentile', 'batchPercentile')}</label>
                    <p>{studentMetrics.percentile_overall}%</p>
                  </div>
                  <div className="student-metric-card">
                    <label>{renderMetricLabel('Participation Rate', 'participationRate')}</label>
                    <p>{studentMetrics.participation_rate}%</p>
                  </div>
                  <div className="student-metric-card">
                    <label>{renderMetricLabel('Consistency (Std Dev)', 'consistency')}</label>
                    <p>{studentMetrics.consistency_stddev}</p>
                  </div>
                  <div className="student-metric-card">
                    <label>{renderMetricLabel('Trend Slope', 'trendSlope')}</label>
                    <p>{studentMetrics.trend_slope}</p>
                  </div>
                  <div className="student-metric-card">
                    <label>{renderMetricLabel('Risk Level', 'riskLevel')}</label>
                    <p className={`risk-pill ${studentMetrics.risk_level || 'low'}`}>
                      {(studentMetrics.risk_level || 'low').toUpperCase()} ({studentMetrics.risk_score})
                    </p>
                  </div>
                </div>
                {studentMetrics.reasons?.length > 0 && (
                  <div className="student-risk-reasons">
                    <h4>Risk Reasons</h4>
                    <ul>
                      {studentMetrics.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                    <p><strong>Recommended Action:</strong> {studentMetrics.recommended_action}</p>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Advanced metrics unavailable for this student.</p>
            )}
          </div>

          <div className="profile-section">
            <h3>🧩 Per-Test Remediation Insights</h3>
            <div className="insight-tab-row">
              <button className={`insight-tab-btn ${insightTab === 'mock' ? 'active' : ''}`} onClick={() => setInsightTab('mock')}>
                Mock Test Insights
              </button>
              <button className={`insight-tab-btn ${insightTab === 'daily' ? 'active' : ''}`} onClick={() => setInsightTab('daily')}>
                Daily Test Insights
              </button>
            </div>

            {insightsLoading ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Loading per-test remediation insights...</p>
            ) : activeInsightRows.length > 0 ? (
              <div className="insight-lane-grid">
                {activeInsightRows.map((testInsight) => (
                  <div className="insight-test-column" key={`${testInsight.test_type}-${testInsight.test_id}`}>
                    <div className="insight-test-title">
                      <strong>{testInsight.test_label}</strong>
                      <span>{testInsight.test_date ? new Date(testInsight.test_date).toLocaleDateString('en-IN') : 'N/A'}</span>
                    </div>

                    <div className="insight-section-title achievement">● ACHIEVEMENTS ({(testInsight.achievements || []).length})</div>
                    {(testInsight.achievements || []).length > 0 ? (
                      (testInsight.achievements || []).map((item, idx) => (
                        <div className="insight-item achievement" key={`ach-${testInsight.test_id}-${idx}`}>
                          <div className="insight-item-title">{item.title}</div>
                          <div className="insight-item-detail">{item.detail}</div>
                          {renderInsightMetric(item.metric) && <div className="insight-item-metric">{renderInsightMetric(item.metric)}</div>}
                        </div>
                      ))
                    ) : (
                      <div className="insight-empty">No achievements for this test.</div>
                    )}

                    <div className="insight-section-title redflag">● RED FLAGS ({(testInsight.red_flags || []).length})</div>
                    {(testInsight.red_flags || []).length > 0 ? (
                      (testInsight.red_flags || []).map((item, idx) => (
                        <div className="insight-item redflag" key={`red-${testInsight.test_id}-${idx}`}>
                          <div className="insight-item-title">{item.title}</div>
                          <div className="insight-item-detail">{item.detail}</div>
                          {renderInsightMetric(item.metric) && <div className="insight-item-metric">{renderInsightMetric(item.metric)}</div>}
                          <div className="insight-remedy">Plan: {item.remediation_action}</div>
                        </div>
                      ))
                    ) : (
                      <div className="insight-empty">No red flags for this test.</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                No per-test remediation insights available.
              </p>
            )}
          </div>

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
                        <th>Marks (Obtained/Total)</th>
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
                          <td><strong>{displayMarkWithTotal(test.marks, test.subject_total_marks ?? test.test_total_marks, 0)}</strong></td>
                          <td>{displayMarkWithTotal(test.class_avg, test.subject_total_marks ?? test.test_total_marks, 0)}</td>
                          <td className="top-score">{displayMarkWithTotal(test.top_score, test.subject_total_marks ?? test.test_total_marks, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Performance Trend Chart */}
                {performanceTrend.length > 1 && (
                  <div className="profile-section" style={{ marginTop: '20px' }}>
                    <div className="chart-control-row">
                      <h4>Performance Trend</h4>
                      <div className="date-filter-field">
                        <label>Chart Type</label>
                        <select className="date-filter-input" value={dailyChartType} onChange={(e) => setDailyChartType(e.target.value)}>
                          <option value="line">Line Chart</option>
                          <option value="area">Area Chart</option>
                          <option value="bar">Bar Chart</option>
                        </select>
                      </div>
                    </div>
                    {dailyChartType === 'line' && (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={performanceTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" {...chartAxisStyle} />
                          <YAxis {...chartAxisStyle} />
                          <Tooltip
                            {...chartTooltipStyle}
                            formatter={(value, name, payload) => {
                              const unit = payload?.payload?.unit || 'marks';
                              return [unit === '%' ? `${value}%` : value, name];
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="score" stroke="#5b5fc7" strokeWidth={3} name="Your Score" dot={{ r: 5 }} />
                          <Line type="monotone" dataKey="classAvg" stroke="#a0aec0" strokeWidth={2} strokeDasharray="5 5" name="Class Average" dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                    {dailyChartType === 'area' && (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={performanceTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" {...chartAxisStyle} />
                          <YAxis {...chartAxisStyle} />
                          <Tooltip
                            {...chartTooltipStyle}
                            formatter={(value, name, payload) => {
                              const unit = payload?.payload?.unit || 'marks';
                              return [unit === '%' ? `${value}%` : value, name];
                            }}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="score" stroke="#5b5fc7" fill="#5b5fc733" strokeWidth={2} name="Your Score" />
                          <Area type="monotone" dataKey="classAvg" stroke="#a0aec0" fill="#a0aec033" strokeWidth={2} name="Class Average" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                    {dailyChartType === 'bar' && (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={performanceTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" {...chartAxisStyle} />
                          <YAxis {...chartAxisStyle} />
                          <Tooltip
                            {...chartTooltipStyle}
                            formatter={(value, name, payload) => {
                              const unit = payload?.payload?.unit || 'marks';
                              return [unit === '%' ? `${value}%` : value, name];
                            }}
                          />
                          <Legend />
                          <Bar dataKey="score" fill="#5b5fc7" name="Your Score" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="classAvg" fill="#a0aec0" name="Class Average" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
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
                <div className="chart-control-row" style={{ marginBottom: '12px' }}>
                  <h4 style={{ margin: 0 }}>Mock Test Chart</h4>
                  <div className="date-filter-field">
                    <label>Chart Type</label>
                    <select className="date-filter-input" value={mockChartType} onChange={(e) => setMockChartType(e.target.value)}>
                      <option value="grouped">Grouped Bar (Subject-wise)</option>
                      <option value="trend">Line Trend (Total vs Class)</option>
                      <option value="radar">Radar (Latest Mock Subject Profile)</option>
                      <option value="pie">Pie (Latest Mock Subject Share)</option>
                    </select>
                  </div>
                </div>

                {mockChartType === 'grouped' && (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={mockTestChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="exam" {...chartAxisStyle} angle={-20} textAnchor="end" height={70} />
                      <YAxis {...chartAxisStyle} />
                      <Tooltip
                        {...chartTooltipStyle}
                        formatter={(value, name, payload) => {
                          const unit = payload?.payload?.unit || 'marks';
                          return [unit === '%' ? `${value}%` : value, name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="physics" fill="#FF6B9D" name="Physics" />
                      <Bar dataKey="chemistry" fill="#4A90E2" name="Chemistry" />
                      <Bar dataKey="biology" fill="#00D9C0" name="Biology" />
                      <Bar dataKey="maths" fill="#f1ed08" name="Maths" />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {mockChartType === 'trend' && (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={mockTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="exam" {...chartAxisStyle} />
                      <YAxis {...chartAxisStyle} />
                      <Tooltip
                        {...chartTooltipStyle}
                        formatter={(value, name, payload) => {
                          const unit = payload?.payload?.unit || 'marks';
                          return [unit === '%' ? `${value}%` : value, name];
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#5b5fc7" strokeWidth={3} name="Your Total" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="classAvg" stroke="#38b2ac" strokeWidth={2} name="Class Average" dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="topScore" stroke="#48bb78" strokeWidth={2} name="Top Score" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}

                {mockChartType === 'radar' && latestMockSubjectShare.length > 0 && (
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={latestMockSubjectShare}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#2d3748', fontSize: 12 }} />
                      <PolarRadiusAxis />
                      <Tooltip {...chartTooltipStyle} formatter={(value) => [`${value}`, 'Score']} />
                      <Radar dataKey="value" name="Marks" stroke="#5b5fc7" fill="#5b5fc7" fillOpacity={0.35} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}

                {mockChartType === 'pie' && latestMockSubjectShare.length > 0 && (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Tooltip {...chartTooltipStyle} formatter={(value) => [`${value}`, 'Score']} />
                      <Legend />
                      <Pie
                        data={latestMockSubjectShare}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        label
                      >
                        {latestMockSubjectShare.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}

                {(mockChartType === 'radar' || mockChartType === 'pie') && latestMockSubjectShare.length === 0 && (
                  <p style={{ color: '#666', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
                    Not enough numeric marks in the latest mock test for this chart.
                  </p>
                )}

                {/* Mock Test Details Table */}
                <div className="marks-table" style={{ marginTop: '20px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject Topics</th>
                        <th>Maths</th>
                        <th>Physics</th>
                        <th>Chemistry</th>
                        <th>Biology</th>
                        <th>Total (Obtained/Total)</th>
                        <th>Class Avg</th>
                        <th>Top Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMockTests.map((exam, index) => (
                        <tr key={exam.test_id || index}>
                          <td>{exam.test_date ? new Date(exam.test_date).toLocaleDateString('en-IN') : 'N/A'}</td>
                          <td>{formatMockTopics(exam)}</td>
                          <td>{displayMarkWithTotal(exam.maths_marks, exam.maths_total_marks, 0)}</td>
                          <td>{displayMarkWithTotal(exam.physics_marks, exam.physics_total_marks, 0)}</td>
                          <td>{displayMarkWithTotal(exam.chemistry_marks, exam.chemistry_total_marks, 0)}</td>
                          <td>{displayMarkWithTotal(exam.biology_marks, exam.biology_total_marks, 0)}</td>
                          <td><strong>{displayMarkWithTotal(exam.total_marks, exam.test_total_marks, 0)}</strong></td>
                          <td>{displayMarkWithTotal(exam.class_avg_total, exam.test_total_marks, 0)}</td>
                          <td className="top-score">{displayMarkWithTotal(exam.top_score_total, exam.test_total_marks, 0)}</td>
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

      <div className="student-pdf-export-root" ref={reportExportRef}>
        <div className="student-pdf-page">
          <div className="student-pdf-header">Progress Charts - {displayData.name} | Graavitons</div>
          <h1>Student Progress Charts</h1>
          <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: '14px' }}>Daily test and mock test performance report</p>
          <div className="student-pdf-info-grid">
            <div>
              <p><strong>School:</strong> {displayData.schoolName}</p>
              <p><strong>Name:</strong> {displayData.name}</p>
              <p><strong>Roll No:</strong> {displayData.rollNo}</p>
            </div>
            <div>
              <p><strong>Grade:</strong> {displayData.grade}</p>
              <p><strong>Program:</strong> {displayData.course}</p>
              <p><strong>Series:</strong> {analysisData?.student?.batch_name || 'N/A'}</p>
            </div>
          </div>

          <div className="student-pdf-chart-block">
            <h3>Attendance Summary</h3>
            <p>Weekly and mock test attendance (Attended/Conducted)</p>
            <div className="student-pdf-table-wrap">
              <table className="student-pdf-table attendance-table">
                <thead>
                  <tr>
                    <th>Test Type</th>
                    <th>Conducted</th>
                    <th>Attended</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceSummaryRows.map((row) => (
                    <tr key={row.testType}>
                      <td>{row.testType}</td>
                      <td>{row.conducted}</td>
                      <td>{row.attended}</td>
                      <td><strong>{row.summary}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="student-pdf-chart-block student-pdf-chart-panel">
            <h3>Subject Comparison - Daily Test</h3>
            <p>Student subject-wise trend across daily tests ({dailySubjectComparisonReportData.length} points)</p>
            <LineChart width={720} height={250} data={dailySubjectComparisonReportData} margin={pdfChartMargin}>
              <CartesianGrid strokeDasharray="0" stroke="#d1d5db" />
              <XAxis dataKey="label" {...pdfXAxisProps} />
              <YAxis {...pdfYAxisProps} />
              <Tooltip />
              <Legend {...pdfLegendProps} />
              {reportSubjectKeys.map((subjectKey) => (
                <Line
                  key={subjectKey}
                  type="monotone"
                  dataKey={subjectKey}
                  stroke={reportSubjectMeta[subjectKey]?.color || '#64748b'}
                  strokeWidth={2.2}
                  activeDot={{ r: 4, fill: '#111827', stroke: '#111827', strokeWidth: 1 }}
                  dot={renderPdfDotWithValue(reportSubjectMeta[subjectKey]?.color || '#64748b', 0, reportSubjectKeys)}
                  name={reportSubjectMeta[subjectKey]?.label || subjectKey}
                  connectNulls
                />
              ))}
            </LineChart>
          </div>

          <div className="student-pdf-chart-block student-pdf-chart-panel">
            <h3>Total Score vs Class High / Average / Low - Mock Test</h3>
            <p>Mock total comparison against class band ({reportTests.length} tests)</p>
            <LineChart width={720} height={250} data={totalComparisonReportData} margin={pdfChartMargin}>
              <CartesianGrid strokeDasharray="0" stroke="#d1d5db" />
              <XAxis dataKey="label" {...pdfXAxisProps} />
              <YAxis {...pdfYAxisProps} />
              <Tooltip />
              <Legend {...pdfLegendProps} />
              <Line type="monotone" dataKey="student" stroke="#2563eb" strokeWidth={2.8} dot={renderPdfDotWithValue('#2563eb', 0, ['high', 'student', 'average', 'low'])} name="Student" connectNulls />
              <Line type="monotone" dataKey="high" stroke="#22c55e" strokeWidth={2.2} dot={renderPdfDotWithValue('#22c55e', 0, ['high', 'student', 'average', 'low'])} name="High" connectNulls />
              <Line type="monotone" dataKey="average" stroke="#f1ed08" strokeWidth={2.2} dot={renderPdfDotWithValue('#f1ed08', 0, ['high', 'student', 'average', 'low'])} name="Average" connectNulls />
              <Line type="monotone" dataKey="low" stroke="#ef4444" strokeWidth={2.2} dot={renderPdfDotWithValue('#ef4444', 0, ['high', 'student', 'average', 'low'])} name="Low" connectNulls />
            </LineChart>
          </div>
        </div>

        <div className="student-pdf-page">
          <div className="student-pdf-header">Progress Charts - {displayData.name} | Graavitons</div>
          {reportSubjectKeys.map((subjectKey) => {
            const subjectLabel = reportSubjectMeta[subjectKey]?.label || subjectKey;
            const chartData = mockSubjectVsClassReportData[subjectKey] || [];

            return (
              <div className="student-pdf-chart-block student-pdf-chart-panel" key={`mock-subject-${subjectKey}`}>
                <h3>{subjectLabel} - Mock Test: Student vs Class</h3>
                <p>{subjectLabel} performance vs class High, Average, Low ({reportTests.length} tests)</p>
                <LineChart width={720} height={250} data={chartData} margin={pdfChartMargin}>
                  <CartesianGrid strokeDasharray="0" stroke="#d1d5db" />
                  <XAxis dataKey="label" {...pdfXAxisProps} />
                  <YAxis {...pdfYAxisProps} />
                  <Tooltip />
                  <Legend {...pdfLegendProps} />
                  <Line type="monotone" dataKey="student" stroke="#2563eb" strokeWidth={2.6} dot={renderPdfDotWithValue('#2563eb', 0, ['high', 'student', 'average', 'low'])} name="Student" connectNulls />
                  <Line type="monotone" dataKey="high" stroke="#22c55e" strokeWidth={2} dot={renderPdfDotWithValue('#22c55e', 0, ['high', 'student', 'average', 'low'])} name="High" connectNulls />
                  <Line type="monotone" dataKey="average" stroke="#f1ed08" strokeWidth={2} dot={renderPdfDotWithValue('#f1ed08', 0, ['high', 'student', 'average', 'low'])} name="Average" connectNulls />
                  <Line type="monotone" dataKey="low" stroke="#ef4444" strokeWidth={2} dot={renderPdfDotWithValue('#ef4444', 0, ['high', 'student', 'average', 'low'])} name="Low" connectNulls />
                </LineChart>
              </div>
            );
          })}
        </div>

        <div className="student-pdf-page">
          <div className="student-pdf-header">Progress Charts - {displayData.name} | Graavitons</div>

          <div className="student-pdf-chart-block">
            <h3>🧩 Per-Test Remediation (Latest 6)</h3>
            <p>Detailed Achievements and Red Flags from latest test events</p>
            <div className="pdf-insight-grid">
              {pdfInsightRows.length > 0 ? pdfInsightRows.map((testInsight, idx) => (
                <div className="pdf-insight-card" key={`pdf-insight-${idx}`}>
                  <div className="pdf-insight-head">
                    <strong>{testInsight.test_label} ({String(testInsight.test_type || '').toUpperCase() || 'TEST'})</strong>
                    <span>{testInsight.test_date ? new Date(testInsight.test_date).toLocaleDateString('en-IN') : 'N/A'}</span>
                  </div>
                  <div className="pdf-insight-subhead">
                    {testInsight.subject ? `${testInsight.subject}` : 'General'}
                    {testInsight.unit_name ? ` • ${testInsight.unit_name}` : ''}
                  </div>
                  <div className="pdf-insight-meta">{renderPdfScoreSummary(testInsight)}</div>
                  <div className="pdf-insight-body">
                    <p className="pdf-insight-section"><strong>Achievement</strong> ({testInsight.achievements?.length || 0})</p>
                    {testInsight.achievements?.[0] ? (
                      <>
                        <p><strong>• {testInsight.achievements[0].title}</strong></p>
                        <p>{testInsight.achievements[0].detail}</p>
                        {renderInsightMetric(testInsight.achievements[0].metric) && (
                          <p><strong>Metric:</strong> {renderInsightMetric(testInsight.achievements[0].metric)}</p>
                        )}
                      </>
                    ) : (
                      <p>No achievement noted for this test.</p>
                    )}

                    <p className="pdf-insight-section"><strong>Red Flag</strong> ({testInsight.red_flags?.length || 0})</p>
                    {testInsight.red_flags?.[0] ? (
                      <>
                        <p><strong>• {testInsight.red_flags[0].title}</strong></p>
                        <p>{testInsight.red_flags[0].detail}</p>
                        {renderInsightMetric(testInsight.red_flags[0].metric) && (
                          <p><strong>Metric:</strong> {renderInsightMetric(testInsight.red_flags[0].metric)}</p>
                        )}
                        {testInsight.red_flags[0].remediation_action && (
                          <p><strong>Plan:</strong> {testInsight.red_flags[0].remediation_action}</p>
                        )}
                      </>
                    ) : (
                      <p>No red flag noted for this test.</p>
                    )}
                  </div>
                </div>
              )) : (
                <div className="pdf-insight-card">No remediation insights available.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
