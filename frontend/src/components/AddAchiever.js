import React, { useState, useEffect } from 'react';
import './AddAchiever.css';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';

const AddAchiever = ({ onBack, onSave }) => {
    const [admissionQuery, setAdmissionQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [searchError, setSearchError] = useState('');

    const [formData, setFormData] = useState({
        student_id: '',
        batch_id: '',
        achievement: '',
        achievement_details: '',
        rank: '',
        score: '',
        photo_url: '',
        achieved_date: ''
    });

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (admissionQuery.trim().length >= 1 && !selectedStudent) {
                handleSearchStudents(admissionQuery.trim());
            } else if (!admissionQuery.trim()) {
                setSearchResults([]);
                setSearchError('');
            }
        }, 250);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [admissionQuery]);

    const handleSearchStudents = async (queryText) => {
        setSearchLoading(true);
        setSearchError('');
        try {
            const res = await authFetch(
                `${API_BASE}/api/achiever/students/search?admission_query=${encodeURIComponent(queryText)}&limit=20`
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to search students');
            }
            const data = await res.json();
            setSearchResults(data.students || []);
        } catch (err) {
            console.error('Error searching students:', err);
            setSearchError(err.message || 'Failed to search students');
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        setAdmissionQuery(student.student_id);
        setSearchResults([]);
        setSearchError('');
        setFormData(prev => ({
            ...prev,
            student_id: student.student_id,
            batch_id: student.batch_id || '',
            photo_url: prev.photo_url || student.photo_url || ''
        }));
    };

    const handleClearStudent = () => {
        setSelectedStudent(null);
        setAdmissionQuery('');
        setSearchResults([]);
        setSearchError('');
        setFormData(prev => ({
            ...prev,
            student_id: '',
            batch_id: '',
            photo_url: ''
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.student_id) {
            setSubmitError('Please select a student using admission number search');
            return;
        }

        setSubmitLoading(true);
        setSubmitError('');

        try {
            const payload = {
                student_id: formData.student_id,
                batch_id: formData.batch_id ? parseInt(formData.batch_id) : null,
                achievement: formData.achievement,
                achievement_details: formData.achievement_details || null,
                rank: formData.rank || null,
                score: formData.score ? parseFloat(formData.score) : null,
                photo_url: formData.photo_url || null,
                achieved_date: formData.achieved_date || null,
            };

            const response = await authFetch(`${API_BASE}/api/achiever`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to add achiever');
            }

            alert('Achiever added successfully!');
            onSave();
        } catch (err) {
            console.error('Error adding achiever:', err);
            setSubmitError(err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <div className="add-achiever">
            <div className="add-achiever-header">
                <button className="back-button" onClick={onBack}>← Back</button>
                <h2>Add New Achiever</h2>
            </div>

            {submitError && (
                <div style={{
                    padding: '15px',
                    backgroundColor: '#fee',
                    color: '#c00',
                    borderRadius: '8px',
                    margin: '20px 0',
                    border: '1px solid #fcc'
                }}>
                    <strong>Error:</strong> {submitError}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Student Selection */}
                <div className="form-section">
                    <h3>Select Existing Student by Admission Number</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Admission Number *</label>
                            <input
                                type="text"
                                value={admissionQuery}
                                onChange={(e) => {
                                    setAdmissionQuery(e.target.value);
                                    if (selectedStudent) {
                                        setSelectedStudent(null);
                                        setFormData(prev => ({ ...prev, student_id: '', batch_id: '' }));
                                    }
                                }}
                                placeholder="Type admission number (e.g., 2608)"
                                required
                            />
                            <div className="search-hint">Search uses admission number from existing students in DB.</div>
                        </div>
                        <div className="form-group">
                            <label>Selected Student</label>
                            <input
                                type="text"
                                value={selectedStudent ? `${selectedStudent.student_name} (${selectedStudent.student_id})` : 'No student selected'}
                                readOnly
                            />
                            {selectedStudent && (
                                <button type="button" className="clear-student-btn" onClick={handleClearStudent}>
                                    Clear Selection
                                </button>
                            )}
                        </div>
                    </div>

                    {(searchLoading || searchError || searchResults.length > 0) && !selectedStudent && (
                        <div className="student-search-results">
                            {searchLoading && <p>Searching students...</p>}
                            {searchError && <p className="search-error">{searchError}</p>}
                            {!searchLoading && !searchError && searchResults.length === 0 && admissionQuery.trim() && (
                                <p>No students found for this admission number.</p>
                            )}
                            {!searchLoading && searchResults.length > 0 && (
                                <div className="result-list">
                                    {searchResults.map((student) => (
                                        <button
                                            key={student.student_id}
                                            type="button"
                                            className="result-item"
                                            onClick={() => handleSelectStudent(student)}
                                        >
                                            <strong>{student.student_id}</strong> — {student.student_name}
                                            <span>
                                                {student.batch_name || 'No Batch'}
                                                {student.academic_year ? ` (${student.academic_year})` : ''}
                                                {student.branch ? ` • ${student.branch}` : ''}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedStudent && (
                        <div className="selected-student-preview">
                            <p><strong>Name:</strong> {selectedStudent.student_name}</p>
                            <p><strong>Admission No:</strong> {selectedStudent.student_id}</p>
                            <p><strong>Batch:</strong> {selectedStudent.batch_name || 'N/A'}</p>
                            <p><strong>Course / Branch:</strong> {selectedStudent.course || 'N/A'} / {selectedStudent.branch || 'N/A'}</p>
                            <p><strong>Grade:</strong> {selectedStudent.grade || 'N/A'}</p>
                        </div>
                    )}
                </div>

                {/* Achievement Details */}
                <div className="form-section">
                    <h3>Achievement Details</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Achievement Title *</label>
                            <input
                                type="text"
                                name="achievement"
                                value={formData.achievement}
                                onChange={handleChange}
                                required
                                placeholder="e.g., NEET Top Scorer"
                            />
                        </div>
                        <div className="form-group">
                            <label>Achievement Description</label>
                            <input
                                type="text"
                                name="achievement_details"
                                value={formData.achievement_details}
                                onChange={handleChange}
                                placeholder="e.g., Secured AIR 125 in NEET 2024"
                            />
                        </div>
                        <div className="form-group">
                            <label>Rank</label>
                            <input
                                type="text"
                                name="rank"
                                value={formData.rank}
                                onChange={handleChange}
                                placeholder="e.g., AIR 125 or State 1"
                            />
                        </div>
                        <div className="form-group">
                            <label>Score (%)</label>
                            <input
                                type="number"
                                name="score"
                                value={formData.score}
                                onChange={handleChange}
                                min="0"
                                max="100"
                                step="0.1"
                                placeholder="e.g., 98.5"
                            />
                        </div>
                        <div className="form-group">
                            <label>Photo URL</label>
                            <input
                                type="url"
                                name="photo_url"
                                value={formData.photo_url}
                                onChange={handleChange}
                                placeholder="https://example.com/photo.jpg"
                            />
                        </div>
                        <div className="form-group">
                            <label>Date of Achievement</label>
                            <input
                                type="date"
                                name="achieved_date"
                                value={formData.achieved_date}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={onBack}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={submitLoading || !formData.student_id}>
                        {submitLoading ? 'Adding...' : 'Add Achiever'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddAchiever;
