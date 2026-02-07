import React, { useState } from 'react';
import './AddAchiever.css';

const AddAchiever = ({ onBack, onSave }) => {
    const [formData, setFormData] = useState({
        // Basic Info
        name: '',
        admissionNo: '',
        batch: '',
        grade: '',
        photo: '',

        // Achievement Details
        achievement: '',
        achievementDetails: '',
        rank: '',
        score: '',

        // Additional Student Info
        dob: '',
        community: '',
        academicYear: '',
        course: '',
        branch: '',
        studentMobile: '',
        aadharNumber: '',
        emailId: '',
        gender: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Generate ID
        const newAchiever = {
            id: Date.now(),
            ...formData,
            score: parseFloat(formData.score)
        };

        onSave(newAchiever);
        alert('Achiever added successfully!');
    };

    return (
        <div className="add-achiever">
            <div className="add-achiever-header">
                <button className="back-button" onClick={onBack}>← Back</button>
                <h2>Add New Achiever</h2>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Basic Information */}
                <div className="form-section">
                    <h3>Basic Information</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Student Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Enter student name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Admission Number *</label>
                            <input
                                type="text"
                                name="admissionNo"
                                value={formData.admissionNo}
                                onChange={handleChange}
                                required
                                placeholder="e.g., 2024001"
                            />
                        </div>
                        <div className="form-group">
                            <label>Batch *</label>
                            <input
                                type="text"
                                name="batch"
                                value={formData.batch}
                                onChange={handleChange}
                                required
                                placeholder="e.g., NEET 2024-25"
                            />
                        </div>
                        <div className="form-group">
                            <label>Grade *</label>
                            <select name="grade" value={formData.grade} onChange={handleChange} required>
                                <option value="">Select Grade</option>
                                <option value="11th">11th</option>
                                <option value="12th">12th</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Photo URL</label>
                            <input
                                type="url"
                                name="photo"
                                value={formData.photo}
                                onChange={handleChange}
                                placeholder="https://example.com/photo.jpg"
                            />
                        </div>
                        <div className="form-group">
                            <label>Gender *</label>
                            <select name="gender" value={formData.gender} onChange={handleChange} required>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
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
                            <label>Achievement Description *</label>
                            <input
                                type="text"
                                name="achievementDetails"
                                value={formData.achievementDetails}
                                onChange={handleChange}
                                required
                                placeholder="e.g., Secured AIR 125 in NEET 2024"
                            />
                        </div>
                        <div className="form-group">
                            <label>Rank *</label>
                            <input
                                type="text"
                                name="rank"
                                value={formData.rank}
                                onChange={handleChange}
                                required
                                placeholder="e.g., AIR 125 or State 1"
                            />
                        </div>
                        <div className="form-group">
                            <label>Score (%) *</label>
                            <input
                                type="number"
                                name="score"
                                value={formData.score}
                                onChange={handleChange}
                                required
                                min="0"
                                max="100"
                                step="0.1"
                                placeholder="e.g., 98.5"
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Information */}
                <div className="form-section">
                    <h3>Additional Information</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Date of Birth</label>
                            <input
                                type="date"
                                name="dob"
                                value={formData.dob}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Community</label>
                            <input
                                type="text"
                                name="community"
                                value={formData.community}
                                onChange={handleChange}
                                placeholder="e.g., OC, BC, MBC"
                            />
                        </div>
                        <div className="form-group">
                            <label>Academic Year</label>
                            <input
                                type="text"
                                name="academicYear"
                                value={formData.academicYear}
                                onChange={handleChange}
                                placeholder="e.g., 2024-2025"
                            />
                        </div>
                        <div className="form-group">
                            <label>Course</label>
                            <input
                                type="text"
                                name="course"
                                value={formData.course}
                                onChange={handleChange}
                                placeholder="e.g., NEET Preparation"
                            />
                        </div>
                        <div className="form-group">
                            <label>Branch</label>
                            <select name="branch" value={formData.branch} onChange={handleChange}>
                                <option value="">Select Branch</option>
                                <option value="Medical">Medical</option>
                                <option value="Engineering">Engineering</option>
                                <option value="Commerce">Commerce</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Student Mobile</label>
                            <input
                                type="tel"
                                name="studentMobile"
                                value={formData.studentMobile}
                                onChange={handleChange}
                                placeholder="+91 XXXXXXXXXX"
                            />
                        </div>
                        <div className="form-group">
                            <label>Aadhar Number</label>
                            <input
                                type="text"
                                name="aadharNumber"
                                value={formData.aadharNumber}
                                onChange={handleChange}
                                placeholder="XXXX-XXXX-XXXX"
                            />
                        </div>
                        <div className="form-group">
                            <label>Email ID</label>
                            <input
                                type="email"
                                name="emailId"
                                value={formData.emailId}
                                onChange={handleChange}
                                placeholder="student@example.com"
                            />
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={onBack}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit">
                        Add Achiever
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddAchiever;
