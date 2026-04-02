import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';

const subjectLabel = {
  maths: 'Maths',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology'
};

const ManageExamMarks = ({ batchId }) => {
  const [examType, setExamType] = useState('daily test');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [examMeta, setExamMeta] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeMockSubjects, setActiveMockSubjects] = useState(['maths', 'physics', 'chemistry', 'biology']);

  const mockColumns = useMemo(() => activeMockSubjects.map((key) => ({
    key,
    field: `${key}_marks`,
    label: subjectLabel[key] || key
  })), [activeMockSubjects]);

  const toOptionalInt = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    setSelectedGroup(null);
    setExamMeta(null);
    setRecords([]);

    try {
      const endpoint = examType === 'daily test'
        ? `${API_BASE}/api/exam/daily-test/batch/${batchId}/groups`
        : `${API_BASE}/api/exam/mock-test/batch/${batchId}/groups`;

      const response = await authFetch(endpoint);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to fetch exams');
      }

      const data = await response.json();
      setGroups(data.groups || []);
      if (data.active_subjects) {
        setActiveMockSubjects(data.active_subjects);
      }
    } catch (error) {
      alert(error.message || 'Failed to fetch exam groups');
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (batchId) {
      fetchGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, examType]);

  const handleSelectGroup = async (group) => {
    setSelectedGroup(group);
    setExamMeta(
      examType === 'daily test'
        ? {
            subject_total_marks: group.subject_total_marks ?? null,
            test_total_marks: group.test_total_marks ?? null,
          }
        : {
            maths_total_marks: group.maths_total_marks ?? null,
            physics_total_marks: group.physics_total_marks ?? null,
            chemistry_total_marks: group.chemistry_total_marks ?? null,
            biology_total_marks: group.biology_total_marks ?? null,
            test_total_marks: group.test_total_marks ?? null,
          }
    );
    setLoadingRecords(true);

    try {
      const endpoint = examType === 'daily test'
        ? `${API_BASE}/api/exam/daily-test/batch/${batchId}/records`
        : `${API_BASE}/api/exam/mock-test/batch/${batchId}/records`;

      const response = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to fetch marks');
      }

      const data = await response.json();
      setRecords(data.records || []);
    } catch (error) {
      alert(error.message || 'Failed to load selected exam marks');
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleRecordChange = (studentId, field, value) => {
    setRecords((prev) => prev.map((row) => (
      row.student_id === studentId ? { ...row, [field]: value } : row
    )));
  };

  const handleMetaChange = (field, value) => {
    setExamMeta((prev) => ({
      ...(prev || {}),
      [field]: toOptionalInt(value),
    }));
  };

  const handleSave = async () => {
    if (!selectedGroup) return;
    setSaving(true);

    try {
      const endpoint = examType === 'daily test'
        ? `${API_BASE}/api/exam/daily-test/batch/${batchId}`
        : `${API_BASE}/api/exam/mock-test/batch/${batchId}`;

      const payload = examType === 'daily test'
        ? {
            ...selectedGroup,
            subject_total_marks: examMeta?.subject_total_marks ?? selectedGroup.subject_total_marks ?? null,
            test_total_marks: examMeta?.test_total_marks ?? selectedGroup.test_total_marks ?? null,
            studentMarks: records.map((r) => ({ student_id: r.student_id, marks: r.marks || '' }))
          }
        : {
            ...selectedGroup,
            maths_total_marks: examMeta?.maths_total_marks ?? selectedGroup.maths_total_marks ?? null,
            physics_total_marks: examMeta?.physics_total_marks ?? selectedGroup.physics_total_marks ?? null,
            chemistry_total_marks: examMeta?.chemistry_total_marks ?? selectedGroup.chemistry_total_marks ?? null,
            biology_total_marks: examMeta?.biology_total_marks ?? selectedGroup.biology_total_marks ?? null,
            test_total_marks: examMeta?.test_total_marks ?? selectedGroup.test_total_marks ?? null,
            original_maths_total_marks: selectedGroup.maths_total_marks ?? null,
            original_physics_total_marks: selectedGroup.physics_total_marks ?? null,
            original_chemistry_total_marks: selectedGroup.chemistry_total_marks ?? null,
            original_biology_total_marks: selectedGroup.biology_total_marks ?? null,
            original_test_total_marks: selectedGroup.test_total_marks ?? null,
            studentMarks: records.map((r) => ({
              student_id: r.student_id,
              maths_marks: r.maths_marks || '',
              physics_marks: r.physics_marks || '',
              chemistry_marks: r.chemistry_marks || '',
              biology_marks: r.biology_marks || ''
            }))
          };

      const response = await authFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to update marks');
      }

      const result = await response.json();
      alert(`${result.message}\nUpdated: ${result.updated_count}, Inserted: ${result.inserted_count}, Deleted: ${result.deleted_count}`);
      await fetchGroups();
    } catch (error) {
      alert(error.message || 'Failed to update marks');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGroup) return;
    if (!window.confirm('Are you sure you want to delete this entire exam entry for this batch?')) return;

    setSaving(true);
    try {
      const endpoint = examType === 'daily test'
        ? `${API_BASE}/api/exam/daily-test/batch/${batchId}`
        : `${API_BASE}/api/exam/mock-test/batch/${batchId}`;

      const response = await authFetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedGroup)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to delete exam');
      }

      const result = await response.json();
      alert(`${result.message}\nDeleted records: ${result.deleted_count}`);
      await fetchGroups();
    } catch (error) {
      alert(error.message || 'Failed to delete exam');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manage-exam-marks">
      <div className="manage-exam-toolbar">
        <div className="manage-exam-type-toggle">
          <button
            type="button"
            className={`mode-btn ${examType === 'daily test' ? 'active' : ''}`}
            onClick={() => setExamType('daily test')}
          >
            Daily Test
          </button>
          <button
            type="button"
            className={`mode-btn ${examType === 'mock test' ? 'active' : ''}`}
            onClick={() => setExamType('mock test')}
          >
            Mock Test
          </button>
        </div>
        <button type="button" className="btn-download" onClick={fetchGroups} disabled={loadingGroups || saving}>
          Refresh
        </button>
      </div>

      <div className="manage-exam-layout">
        <div className="manage-exam-list">
          <h4>Existing Exams</h4>
          {loadingGroups ? (
            <p>Loading exams...</p>
          ) : groups.length === 0 ? (
            <p>No exams found for this type.</p>
          ) : (
            <div className="manage-exam-group-list">
              {groups.map((group, index) => {
                const isSelected = selectedGroup && JSON.stringify(selectedGroup) === JSON.stringify(group);
                return (
                  <button
                    type="button"
                    key={`${group.test_date}-${index}`}
                    className={`manage-exam-group-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <div><strong>{group.test_date}</strong></div>
                    {examType === 'daily test' ? (
                      <div>{group.subject} • {group.unit_name}</div>
                    ) : (
                      <div>Total: {group.test_total_marks || 'N/A'}</div>
                    )}
                    <small>{group.entries_count} entries</small>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="manage-exam-editor">
          <h4>Modify Marks</h4>
          {!selectedGroup ? (
            <p>Select an exam from the left to edit or delete marks.</p>
          ) : loadingRecords ? (
            <p>Loading marks...</p>
          ) : (
            <>
              <div className="manage-exam-meta-grid">
                {examType === 'daily test' ? (
                  <>
                    <div className="form-group">
                      <label>Subject Total Marks</label>
                      <input
                        type="number"
                        min="1"
                        value={examMeta?.subject_total_marks ?? ''}
                        onChange={(e) => handleMetaChange('subject_total_marks', e.target.value)}
                        placeholder="Subject total"
                      />
                    </div>
                    <div className="form-group">
                      <label>Test Total Marks</label>
                      <input
                        type="number"
                        min="1"
                        value={examMeta?.test_total_marks ?? ''}
                        onChange={(e) => handleMetaChange('test_total_marks', e.target.value)}
                        placeholder="Test total"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {activeMockSubjects.includes('maths') && (
                      <div className="form-group">
                        <label>Maths Total</label>
                        <input
                          type="number"
                          min="1"
                          value={examMeta?.maths_total_marks ?? ''}
                          onChange={(e) => handleMetaChange('maths_total_marks', e.target.value)}
                          placeholder="Maths total"
                        />
                      </div>
                    )}
                    {activeMockSubjects.includes('physics') && (
                      <div className="form-group">
                        <label>Physics Total</label>
                        <input
                          type="number"
                          min="1"
                          value={examMeta?.physics_total_marks ?? ''}
                          onChange={(e) => handleMetaChange('physics_total_marks', e.target.value)}
                          placeholder="Physics total"
                        />
                      </div>
                    )}
                    {activeMockSubjects.includes('chemistry') && (
                      <div className="form-group">
                        <label>Chemistry Total</label>
                        <input
                          type="number"
                          min="1"
                          value={examMeta?.chemistry_total_marks ?? ''}
                          onChange={(e) => handleMetaChange('chemistry_total_marks', e.target.value)}
                          placeholder="Chemistry total"
                        />
                      </div>
                    )}
                    {activeMockSubjects.includes('biology') && (
                      <div className="form-group">
                        <label>Biology Total</label>
                        <input
                          type="number"
                          min="1"
                          value={examMeta?.biology_total_marks ?? ''}
                          onChange={(e) => handleMetaChange('biology_total_marks', e.target.value)}
                          placeholder="Biology total"
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Test Total Marks</label>
                      <input
                        type="number"
                        min="1"
                        value={examMeta?.test_total_marks ?? ''}
                        onChange={(e) => handleMetaChange('test_total_marks', e.target.value)}
                        placeholder="Test total"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="marks-entry-table">
                {examType === 'daily test' ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Admission No</th>
                        <th>Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((row) => (
                        <tr key={row.student_id}>
                          <td>{row.student_name}</td>
                          <td>{row.student_id}</td>
                          <td>
                            <input
                              type="text"
                              value={row.marks || ''}
                              onChange={(e) => handleRecordChange(row.student_id, 'marks', e.target.value)}
                              className="marks-input"
                              placeholder="Leave empty to remove"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Admission No</th>
                        {mockColumns.map((col) => <th key={col.key}>{col.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((row) => (
                        <tr key={row.student_id}>
                          <td>{row.student_name}</td>
                          <td>{row.student_id}</td>
                          {mockColumns.map((col) => (
                            <td key={`${row.student_id}-${col.key}`}>
                              <input
                                type="text"
                                value={row[col.field] || ''}
                                onChange={(e) => handleRecordChange(row.student_id, col.field, e.target.value)}
                                className="marks-input"
                                placeholder={col.label}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="manage-exam-actions">
                <button type="button" className="btn-submit" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" className="btn-cancel danger" onClick={handleDelete} disabled={saving}>
                  Delete Entire Exam
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageExamMarks;
