import React, { useState, useEffect } from 'react';
import CourseCard from './CourseCard';
import BatchDetail from './BatchDetail';
import AddBatch from './AddBatch';
import AchieversSection from './AchieversSection';
import './Dashboard.css';
import { API_BASE } from '../config';
import { authFetch } from '../utils/api';
import { useToast } from './Toast';

const Dashboard = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('courses');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [selectedType, setSelectedType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddBatch, setShowAddBatch] = useState(false);
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
      const response = await authFetch(`${API_BASE}/api/batch`);
      
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

  const handleDeleteBatch = async (e, batchId, batchName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${batchName}"? This will remove all related students, exams, and data permanently.`)) {
      return;
    }
    try {
      const response = await authFetch(`${API_BASE}/api/batch/${batchId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to delete batch');
      }
      fetchBatches();
    } catch (err) {
      toast.error(err.message || 'Failed to delete batch');
      console.error('Error deleting batch:', err);
    }
  };

  const handleRenameBatch = async (e, batchId, currentBatchName) => {
    e.stopPropagation();

    const newName = window.prompt('Enter new batch name:', currentBatchName);
    if (newName === null) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.warning('Batch name cannot be empty');
      return;
    }

    if (trimmedName === currentBatchName) {
      return;
    }

    try {
      let response = null;
      const methods = ['PUT', 'PATCH', 'POST'];

      for (const method of methods) {
        response = await authFetch(`${API_BASE}/api/batch/${batchId}/rename`, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ batch_name: trimmedName }),
        });

        if (response.ok) {
          break;
        }

        // Retry with next method when method is blocked by proxy/server
        if (![404, 405].includes(response.status)) {
          break;
        }
      }

      if (!response || !response.ok) {
        let errDetail = 'Failed to rename batch';
        if (response) {
          try {
            const errData = await response.json();
            errDetail = errData.detail || errDetail;
          } catch (_) {
            // keep fallback error message
          }
        }
        throw new Error(errDetail);
      }

      fetchBatches();
    } catch (err) {
      toast.error(err.message || 'Failed to rename batch');
      console.error('Error renaming batch:', err);
    }
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
    const matchesYear = batchYear === selectedYear;
    const matchesType = selectedType === 'all' || (batch.type || '') === selectedType;
    const matchesSearch = !searchTerm.trim() || (batch.batch_name || '').toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchesYear && matchesType && matchesSearch;
  });

  // Generate available years from batches
  const years = [...new Set(batches.map(batch => `${batch.start_year}-${batch.end_year}`))].sort();

  // Generate available batch types from batches
  const batchTypes = [...new Set(batches.map(b => b.type).filter(Boolean))].sort();
  
  // Set default year if not set and batches are available
  useEffect(() => {
    if (years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years]);

  if (showAddBatch) {
    return <AddBatch onBack={handleBackFromAddBatch} onSave={handleSaveBatch} />;
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
        <div className="breadcrumb">Dashboard</div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="filter-section">
        <div className="filter-container">
          <div className="filter-top-row">
            <button className="filter-button" onClick={toggleFilters}>
              {showFilters ? '▲ Hide Filters' : '▼ Show Filters'}
            </button>
            <div className="search-bar-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="batch-search-input"
                placeholder="Search batches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="search-clear-btn" onClick={() => setSearchTerm('')}>×</button>
              )}
            </div>
          </div>
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
              <div className="filter-group">
                <label>Batch Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  {batchTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button className="btn-achievers" onClick={() => setShowAchievers(true)}>Achievers</button>
          <button className="btn-add-batch" onClick={handleAddBatch}>Add Batch</button>
        </div>
      </div>

      <div className="courses-grid">
        {loading ? (
          <div className="dashboard-message">
            <p>Loading batches...</p>
          </div>
        ) : filteredBatches.length > 0 ? (
          filteredBatches.map((batch) => (
            <div key={batch.batch_id} onClick={() => handleBatchClick(batch)}>
              <CourseCard
                course={batch}
                onDelete={(e) => handleDeleteBatch(e, batch.batch_id, batch.batch_name)}
                onRename={(e) => handleRenameBatch(e, batch.batch_id, batch.batch_name)}
              />
            </div>
          ))
        ) : (
          <div className="dashboard-message">
            <p>No batches found{searchTerm ? ` matching "${searchTerm}"` : ''}{selectedType !== 'all' ? ` of type "${selectedType}"` : ''} for {selectedYear}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
