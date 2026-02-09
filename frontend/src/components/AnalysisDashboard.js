import React, { useState } from 'react';
import SubjectwiseAnalysis from './analysis/SubjectwiseAnalysis';
import BranchwiseAnalysis from './analysis/BranchwiseAnalysis';
import './AnalysisDashboard.css';

const AnalysisDashboard = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('subjectwise');

    return (
        <div className="analysis-dashboard">
            <div className="analysis-header">
                <button className="back-button" onClick={onBack}>← Back to Dashboard</button>
                <h2>Performance Analysis</h2>
            </div>

            {/* Tab Navigation */}
            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'subjectwise' ? 'active' : ''}`}
                    onClick={() => setActiveTab('subjectwise')}
                >
                    Subjectwise Analysis
                </button>
                <button
                    className={`tab-button ${activeTab === 'branchwise' ? 'active' : ''}`}
                    onClick={() => setActiveTab('branchwise')}
                >
                    Branch-wise Analysis
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'subjectwise' && <SubjectwiseAnalysis />}
                {activeTab === 'branchwise' && <BranchwiseAnalysis />}
            </div>
        </div>
    );
};

export default AnalysisDashboard;
