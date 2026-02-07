import React, { useState, useEffect } from 'react';
import CourseCard from './CourseCard';
import BatchDetail from './BatchDetail';
import AddBatch from './AddBatch';
import AnalysisDashboard from './AnalysisDashboard';
import AchieversSection from './AchieversSection';
import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('courses');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showAchievers, setShowAchievers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [batches, setBatches] = useState([]);

  // Fetch batches from API
  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/batch');
      
      if (!response.ok) {
        throw new Error('Failed to fetch batches');
      }

      const data = await response.json();
      setBatches(data.batches);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load batches');
      console.error('Error fetching batches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchClick = (batch) => {
    setSelectedBatch(batch);
  };

  const handleBackToBatches = () => {
    setSelectedBatch(null);
  };

  const handleAddBatch = () => {
    setShowAddBatch(true);
  };

  const handleBackFromAddBatch = () => {
    setShowAddBatch(false);
  };

  const handleSaveBatch = (batchData) => {
    // Refresh the batch list from the API
    fetchBatches();
    setShowAddBatch(false);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const filteredBatches = batches.filter(batch => {
    const batchYear = `${batch.start_year}-${batch.end_year}`;
    return batchYear === selectedYear;
  });

  // Generate available years from batches
  const years = [...new Set(batches.map(batch => `${batch.start_year}-${batch.end_year}`))].sort();
  
  // Set default year if not set and batches are available
  useEffect(() => {
    if (years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years]);

  if (showAddBatch) {
    return <AddBatch onBack={handleBackFromAddBatch} onSave={handleSaveBatch} />;
  }

  if (showAnalysis) {
    return <AnalysisDashboard onBack={() => setShowAnalysis(false)} />;
  }

  if (showAchievers) {
    return <AchieversSection onBack={() => setShowAchievers(false)} />;
  }

  if (selectedBatch) {
    return <BatchDetail batch={selectedBatch} onBack={handleBackToBatches} />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="breadcrumb">HOME</div>
      </div>

      {error && (
        <div className="error-banner" style={{
          padding: '15px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          margin: '20px 0',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <div className="filter-section">
        <div className="filter-container">
          <button className="filter-button" onClick={toggleFilters}>
            {showFilters ? '▲ Hide Filters' : '▼ Show Filters'}
          </button>
          {showFilters && (
            <div className="filter-options">
              <div className="filter-group">
                <label>Academic Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button className="btn-achievers" onClick={() => setShowAchievers(true)}>🌟 Achievers</button>
          <button className="btn-analysis" onClick={() => setShowAnalysis(true)}>📊 Analysis</button>
          <button className="btn-add-batch" onClick={handleAddBatch}>+ Add Batch</button>
        </div>
      </div>

      <div className="courses-grid">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
            <p>Loading batches...</p>
          </div>
        ) : filteredBatches.length > 0 ? (
          filteredBatches.map((batch) => (
            <div key={batch.batch_id} onClick={() => handleBatchClick(batch)}>
              <CourseCard course={batch} />
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
            <p>No batches found for {selectedYear}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
