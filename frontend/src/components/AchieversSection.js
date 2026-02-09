import React, { useState, useEffect } from 'react';
import AchieverCard from './AchieverCard';
import StudentProfile from './StudentProfile';
import AddAchiever from './AddAchiever';
import './AchieversSection.css';
import { API_BASE } from '../config';

const AchieversSection = ({ onBack }) => {
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [achieversList, setAchieversList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch achievers from API on mount
    useEffect(() => {
        fetchAchievers();
    }, []);

    const fetchAchievers = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/api/achiever`);
            if (!response.ok) throw new Error(`Failed to fetch achievers: ${response.statusText}`);
            const data = await response.json();
            setAchieversList(data.achievers || []);
        } catch (err) {
            console.error('Error fetching achievers:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAchieverClick = (achiever) => {
        setSelectedStudent(achiever);
    };

    const handleBackToAchievers = () => {
        setSelectedStudent(null);
    };

    const handleAddAchiever = () => {
        setShowAddForm(true);
    };

    const handleSaveAchiever = () => {
        // Re-fetch from DB after adding
        fetchAchievers();
        setShowAddForm(false);
    };

    const handleBackFromAdd = () => {
        setShowAddForm(false);
    };

    const handleDeleteAchiever = async (achieverId) => {
        if (!window.confirm('Are you sure you want to remove this achiever?')) return;
        try {
            const response = await fetch(`${API_BASE}/api/achiever/${achieverId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete achiever');
            // Refresh list from DB
            fetchAchievers();
        } catch (err) {
            console.error('Error deleting achiever:', err);
            alert('Failed to delete achiever. Please try again.');
        }
    };

    if (showAddForm) {
        return <AddAchiever onBack={handleBackFromAdd} onSave={handleSaveAchiever} />;
    }

    if (selectedStudent) {
        return <StudentProfile student={selectedStudent} onBack={handleBackToAchievers} />;
    }

    return (
        <div className="achievers-section">
            <div className="achievers-header">
                <button className="back-button" onClick={onBack}>← Back to Dashboard</button>
                <div className="header-content">
                    <h2>🌟 Our Top Achievers</h2>
                    <p>Celebrating excellence and outstanding performance</p>
                </div>
                <button className="add-achiever-btn" onClick={handleAddAchiever}>+ Add Achiever</button>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '15px',
                    backgroundColor: '#fee',
                    color: '#c00',
                    borderRadius: '8px',
                    margin: '20px 0',
                    border: '1px solid #fcc'
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    Loading achievers...
                </div>
            ) : achieversList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    No achievers found. Click "+ Add Achiever" to add one.
                </div>
            ) : (
                <div className="achievers-grid">
                    {achieversList.map(achiever => (
                        <AchieverCard
                            key={achiever.id}
                            achiever={achiever}
                            onClick={handleAchieverClick}
                            onDelete={handleDeleteAchiever}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AchieversSection;
