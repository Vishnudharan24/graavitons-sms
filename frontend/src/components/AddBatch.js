import React, { useState } from 'react';
import './AddBatch.css';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';

const AddBatch = ({ onBack, onSave }) => {
    const [formData, setFormData] = useState({
        batch_name: '',
        start_year: new Date().getFullYear(),
        end_year: new Date().getFullYear() + 1,
        type: '',
        subjects: []
    });

    const [subjectInput, setSubjectInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'start_year' || name === 'end_year' ? parseInt(value) : value
        }));
    };

    const handleAddSubject = () => {
        if (subjectInput.trim() && !formData.subjects.includes(subjectInput.trim())) {
            setFormData(prev => ({
                ...prev,
                subjects: [...prev.subjects, subjectInput.trim()]
            }));
            setSubjectInput('');
        }
    };

    const handleRemoveSubject = (subjectToRemove) => {
        setFormData(prev => ({
            ...prev,
            subjects: prev.subjects.filter(subject => subject !== subjectToRemove)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (formData.end_year <= formData.start_year) {
            setError('End year must be greater than start year');
            return;
        }

        setLoading(true);
        
        try {
            const response = await authFetch(`${API_BASE}/api/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create batch');
            }

            const result = await response.json();
            onSave(result.batch);
            onBack();
        } catch (err) {
            setError(err.message || 'Failed to create batch');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="add-batch">
            <div className="add-batch-header">
                <button className="back-button" onClick={onBack}>← Back</button>
                <h2>Add New Batch</h2>
            </div>

            <form onSubmit={handleSubmit} className="add-batch-form">
                {error && (
                    <div className="error-message" style={{ 
                        padding: '10px', 
                        backgroundColor: '#fee', 
                        color: '#c00', 
                        borderRadius: '4px', 
                        marginBottom: '20px' 
                    }}>
                        {error}
                    </div>
                )}

                <div className="form-section">
                    <h3>Batch Details</h3>
                    
                    <div className="form-group">
                        <label>Batch Name *</label>
                        <input
                            type="text"
                            name="batch_name"
                            value={formData.batch_name}
                            onChange={handleChange}
                            placeholder="e.g., NEET 2025 Batch A"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Start Year *</label>
                            <input
                                type="number"
                                name="start_year"
                                value={formData.start_year}
                                onChange={handleChange}
                                min="2020"
                                max="2050"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>End Year *</label>
                            <input
                                type="number"
                                name="end_year"
                                value={formData.end_year}
                                onChange={handleChange}
                                min="2020"
                                max="2050"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Batch Type</label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                        >
                            <option value="">Select Type</option>
                            <option value="NEET">NEET</option>
                            <option value="JEE">JEE</option>
                            <option value="Foundation">Foundation (6th-10th)</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Subjects</label>
                        <div className="subject-input-container" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <input
                                type="text"
                                value={subjectInput}
                                onChange={(e) => setSubjectInput(e.target.value)}
                                placeholder="e.g., Physics, Chemistry..."
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddSubject();
                                    }
                                }}
                                style={{ flex: 1 }}
                            />
                            <button
                                type="button"
                                onClick={handleAddSubject}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Add
                            </button>
                        </div>
                        <div className="subjects-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {formData.subjects.map((subject, index) => (
                                <span
                                    key={index}
                                    style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#e0e0e0',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {subject}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSubject(subject)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#666',
                                            cursor: 'pointer',
                                            fontSize: '16px',
                                            padding: '0'
                                        }}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={onBack} disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Batch'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddBatch;
