import React, { useState } from 'react';
import './DateFilterModal.css';

const DateFilterModal = ({ onConfirm, onCancel, title = 'Select Date Range for Progress Report' }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleDownloadFiltered = () => {
    onConfirm({ dateFrom: dateFrom || null, dateTo: dateTo || null });
  };

  const handleDownloadAll = () => {
    onConfirm({ dateFrom: null, dateTo: null });
  };

  return (
    <div className="date-filter-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="date-filter-modal">
        <div className="date-filter-modal-header">
          <h3>📅 {title}</h3>
          <button className="date-filter-close-btn" onClick={onCancel}>&times;</button>
        </div>

        <p className="date-filter-description">
          Choose a date range to include only exam marks within this period in the progress report.
          Leave blank and click <strong>"Download All"</strong> to include all available data.
        </p>

        <div className="date-filter-inputs">
          <div className="date-filter-field">
            <label htmlFor="pdf-date-from">From Date</label>
            <input
              id="pdf-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="date-filter-input"
            />
          </div>
          <div className="date-filter-field">
            <label htmlFor="pdf-date-to">To Date</label>
            <input
              id="pdf-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="date-filter-input"
            />
          </div>
        </div>

        {dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo) && (
          <p className="date-filter-error">⚠️ "From" date must be before "To" date</p>
        )}

        <div className="date-filter-actions">
          <button
            className="date-filter-btn date-filter-btn-primary"
            onClick={handleDownloadFiltered}
            disabled={dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)}
          >
            📄 {dateFrom || dateTo ? 'Download Filtered' : 'Download All'}
          </button>
          {(dateFrom || dateTo) && (
            <button
              className="date-filter-btn date-filter-btn-secondary"
              onClick={handleDownloadAll}
            >
              📦 Download All (Ignore Dates)
            </button>
          )}
          <button
            className="date-filter-btn date-filter-btn-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateFilterModal;
