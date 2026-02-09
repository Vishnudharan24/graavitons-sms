import React, { useState, useEffect } from 'react';
import './AddAchiever.css';
import { API_BASE } from '../config';
import { authFetch, authJsonFetch } from '../utils/auth';

const AddAchiever = ({ onBack, onSave }) => {
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');

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

    // Fetch batches on mount
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const res = await authFetch('/api/batch');
                if (res.ok) {
                    const data = await res.json();
                    setBatches(data.batches || []);
                }
            } catch (err) {
                console.error('Error fetching batches:', err);
            }
        };
        fetchBatches();
    }, []);

    // Fetch students when batch changes
    useEffect(() => {
        if (!formData.batch_id) {
            setStudents([]);
            return;
        }
        const fetchStudents = async () => {
            try {
                const res = await authFetch(`/api/student/batch/${formData.batch_id}`);
                if (res.ok) {
                    const data = await res.json();
                    setStudents(data.students || []);
                }
            } catch (err) {
                console.error('Error fetching students:', err);
            }
        };
        fetchStudents();
    }, [formData.batch_id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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

            const response = await authJsonFetch('/api/achiever', {
                method: 'POST',
                body: payload,
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
                    <h3>Select Student</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Batch *</label>
                            <select name="batch_id" value={formData.batch_id} onChange={handleChange} required>
                                <option value="">Select Batch</option>
                                {batches.map(b => (
                                    <option key={b.batch_id} value={b.batch_id}>
                                        {b.batch_name} ({b.start_year}-{b.end_year})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Student *</label>
                            <select
                                name="student_id"
                                value={formData.student_id}
                                onChange={handleChange}
                                required
                                disabled={!formData.batch_id}
                            >
                                <option value="">
                                    {formData.batch_id ? 'Select Student' : 'Select a batch first'}
                                </option>
                                {students.map(s => (
                                    <option key={s.student_id} value={s.student_id}>
                                        {s.student_name} ({s.student_id})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
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
                    <button type="submit" className="btn-submit" disabled={submitLoading}>
                        {submitLoading ? 'Adding...' : 'Add Achiever'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddAchiever;
