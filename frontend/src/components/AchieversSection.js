import React, { useState } from 'react';
import AchieverCard from './AchieverCard';
import StudentProfile from './StudentProfile';
import AddAchiever from './AddAchiever';
import './AchieversSection.css';

const AchieversSection = ({ onBack }) => {
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [achieversList, setAchieversList] = useState([
        {
            id: 1,
            name: 'Rajesh Kumar',
            admissionNo: '2024001',
            batch: 'NEET 2024-25',
            grade: '12th',
            photo: 'https://via.placeholder.com/150',
            achievement: 'NEET Top Scorer',
            achievementDetails: 'Secured AIR 125 in NEET 2024',
            rank: 'AIR 125',
            score: 98.5,
            // Full student data for profile
            dob: '2006-05-15',
            community: 'OC',
            academicYear: '2024-2025',
            course: 'NEET Preparation',
            branch: 'Medical',
            studentMobile: '+91 9876543210',
            aadharNumber: '1234-5678-9012',
            emailId: 'rajesh.kumar@example.com',
            gender: 'Male'
        },
        {
            id: 2,
            name: 'Priya Sharma',
            admissionNo: '2024002',
            batch: 'NEET 2024-25',
            grade: '12th',
            photo: 'https://via.placeholder.com/150',
            achievement: 'State Topper',
            achievementDetails: 'Topped in Tamil Nadu State Board',
            rank: 'State 1',
            score: 99.2,
            dob: '2006-08-22',
            community: 'BC',
            academicYear: '2024-2025',
            course: 'NEET Preparation',
            branch: 'Medical',
            studentMobile: '+91 9876543211',
            aadharNumber: '1234-5678-9013',
            emailId: 'priya.sharma@example.com',
            gender: 'Female'
        },
        {
            id: 3,
            name: 'Amit Patel',
            admissionNo: '2024003',
            batch: 'JEE 2024-25',
            grade: '11th',
            photo: 'https://via.placeholder.com/150',
            achievement: 'JEE Advanced Qualifier',
            achievementDetails: 'Qualified JEE Advanced with 99.5 percentile',
            rank: 'AIR 450',
            score: 99.5,
            dob: '2007-03-10',
            community: 'OC',
            academicYear: '2024-2025',
            course: 'JEE Preparation',
            branch: 'Engineering',
            studentMobile: '+91 9876543212',
            aadharNumber: '1234-5678-9014',
            emailId: 'amit.patel@example.com',
            gender: 'Male'
        },
        {
            id: 4,
            name: 'Sneha Reddy',
            admissionNo: '2024004',
            batch: 'NEET 2024-25',
            grade: '12th',
            photo: 'https://via.placeholder.com/150',
            achievement: 'Perfect Score Biology',
            achievementDetails: 'Scored 100% in Biology Mock Tests',
            rank: 'Batch 1',
            score: 100,
            dob: '2006-11-18',
            community: 'OC',
            academicYear: '2024-2025',
            course: 'NEET Preparation',
            branch: 'Medical',
            studentMobile: '+91 9876543213',
            aadharNumber: '1234-5678-9015',
            emailId: 'sneha.reddy@example.com',
            gender: 'Female'
        }
    ]);

    const handleAchieverClick = (achiever) => {
        setSelectedStudent(achiever);
    };

    const handleBackToAchievers = () => {
        setSelectedStudent(null);
    };

    const handleAddAchiever = () => {
        setShowAddForm(true);
    };

    const handleSaveAchiever = (newAchiever) => {
        setAchieversList(prev => [...prev, newAchiever]);
        setShowAddForm(false);
    };

    const handleBackFromAdd = () => {
        setShowAddForm(false);
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

            <div className="achievers-grid">
                {achieversList.map(achiever => (
                    <AchieverCard
                        key={achiever.id}
                        achiever={achiever}
                        onClick={handleAchieverClick}
                    />
                ))}
            </div>
        </div>
    );
};

export default AchieversSection;
