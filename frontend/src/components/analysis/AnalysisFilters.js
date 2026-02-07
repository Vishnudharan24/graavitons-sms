import React from 'react';
import './AnalysisFilters.css';

const AnalysisFilters = ({
    filters,
    onFilterChange,
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
    const grades = ['6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    const batches = ['NEET 2024-25', 'JEE 2024-25', 'Foundation 2023-24'];
    const subjects = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];
    const courses = ['NEET Preparation', 'JEE Preparation', 'Foundation Course'];
    const branches = ['Medical', 'Engineering', 'Commerce'];

    return (
        <div className="analysis-filters">
            <h4>Filters</h4>
            <div className="filters-grid">
                {showFilters.grade && (
                    <div className="filter-group">
                        <label>Grade</label>
                        <select
                            value={filters.grade || ''}
                            onChange={(e) => onFilterChange('grade', e.target.value)}
                        >
                            <option value="">All Grades</option>
                            {grades.map(grade => (
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
                            {batches.map(batch => (
                                <option key={batch} value={batch}>{batch}</option>
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
                            {subjects.map(subject => (
                                <option key={subject} value={subject}>{subject}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showFilters.name && (
                    <div className="filter-group">
                        <label>Student Name</label>
                        <input
                            type="text"
                            placeholder="Enter student name"
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
                            {courses.map(course => (
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
                            {branches.map(branch => (
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
        </div>
    );
};

export default AnalysisFilters;
