import React, { useState, useEffect } from 'react';
import './AnalysisFilters.css';

const API_BASE = 'http://localhost:8000';

const AnalysisFilters = ({
    filters,
    onFilterChange,
    onApplyFilters,
    showFilters = {
        grade: true,
        admissionNumber: true,
        batch: true,
        subject: true,
        dateRange: true,
        name: false,
        course: false,
        branch: false
    }
}) => {
    const [filterOptions, setFilterOptions] = useState({
        grades: [],
        batches: [],
        subjects: [],
        courses: [],
        branches: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${API_BASE}/api/analysis/filter-options`);
                if (response.ok) {
                    const data = await response.json();
                    setFilterOptions({
                        grades: data.grades || [],
                        batches: data.batches || [],
                        subjects: data.subjects || [],
                        courses: data.courses || [],
                        branches: data.branches || []
                    });
                }
            } catch (err) {
                console.error('Error fetching filter options:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFilterOptions();
    }, []);

    const handleClearFilters = () => {
        Object.keys(filters).forEach(key => {
            onFilterChange(key, '');
        });
    };

    return (
        <div className="analysis-filters">
            <div className="filters-header">
                <h4>🔍 Filters</h4>
                <div className="filters-actions">
                    <button className="btn-clear-filters" onClick={handleClearFilters}>
                        Clear All
                    </button>
                    {onApplyFilters && (
                        <button className="btn-apply-filters" onClick={onApplyFilters}>
                            Apply Filters
                        </button>
                    )}
                </div>
            </div>
            {loading ? (
                <div className="filters-loading">Loading filter options...</div>
            ) : (
                <div className="filters-grid">
                    {showFilters.grade && (
                        <div className="filter-group">
                            <label>Grade</label>
                            <select
                                value={filters.grade || ''}
                                onChange={(e) => onFilterChange('grade', e.target.value)}
                            >
                                <option value="">All Grades</option>
                                {filterOptions.grades.map(grade => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {showFilters.admissionNumber && (
                        <div className="filter-group">
                            <label>Admission Number</label>
                            <input
                                type="text"
                                placeholder="Enter admission number"
                                value={filters.admissionNumber || ''}
                                onChange={(e) => onFilterChange('admissionNumber', e.target.value)}
                            />
                        </div>
                    )}

                    {showFilters.batch && (
                        <div className="filter-group">
                            <label>Batch</label>
                            <select
                                value={filters.batch || ''}
                                onChange={(e) => onFilterChange('batch', e.target.value)}
                            >
                                <option value="">All Batches</option>
                                {filterOptions.batches.map(batch => (
                                    <option key={batch.batch_id} value={batch.batch_id}>
                                        {batch.batch_name} ({batch.start_year}-{batch.end_year})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {showFilters.subject && (
                        <div className="filter-group">
                            <label>Subject</label>
                            <select
                                value={filters.subject || ''}
                                onChange={(e) => onFilterChange('subject', e.target.value)}
                            >
                                <option value="">All Subjects</option>
                                {filterOptions.subjects.length > 0 ? (
                                    filterOptions.subjects.map(subject => (
                                        <option key={subject} value={subject}>{subject}</option>
                                    ))
                                ) : (
                                    <>
                                        <option value="Physics">Physics</option>
                                        <option value="Chemistry">Chemistry</option>
                                        <option value="Biology">Biology</option>
                                        <option value="Mathematics">Mathematics</option>
                                    </>
                                )}
                            </select>
                        </div>
                    )}

                    {showFilters.name && (
                        <div className="filter-group">
                            <label>Student Name</label>
                            <input
                                type="text"
                                placeholder="Search by name"
                                value={filters.name || ''}
                                onChange={(e) => onFilterChange('name', e.target.value)}
                            />
                        </div>
                    )}

                    {showFilters.course && (
                        <div className="filter-group">
                            <label>Course</label>
                            <select
                                value={filters.course || ''}
                                onChange={(e) => onFilterChange('course', e.target.value)}
                            >
                                <option value="">All Courses</option>
                                {filterOptions.courses.map(course => (
                                    <option key={course} value={course}>{course}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {showFilters.branch && (
                        <div className="filter-group">
                            <label>Branch</label>
                            <select
                                value={filters.branch || ''}
                                onChange={(e) => onFilterChange('branch', e.target.value)}
                            >
                                <option value="">All Branches</option>
                                {filterOptions.branches.map(branch => (
                                    <option key={branch} value={branch}>{branch}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {showFilters.dateRange && (
                        <>
                            <div className="filter-group">
                                <label>From Date</label>
                                <input
                                    type="date"
                                    value={filters.fromDate || ''}
                                    onChange={(e) => onFilterChange('fromDate', e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <label>To Date</label>
                                <input
                                    type="date"
                                    value={filters.toDate || ''}
                                    onChange={(e) => onFilterChange('toDate', e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnalysisFilters;
