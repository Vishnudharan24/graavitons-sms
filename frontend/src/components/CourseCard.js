import React from 'react';
import './CourseCard.css';

const CourseCard = ({ course, onDelete }) => {
  return (
    <div className="course-card">
      {onDelete && (
        <button
          className="course-card-delete-btn"
          title="Delete batch"
          onClick={onDelete}
        >
          🗑
        </button>
      )}
      <h3 className="course-title">{course.batch_name || course.name}</h3>
      <div className="course-details">
        {course.type && (
          <span className="course-type">{course.type}</span>
        )}
        <span className="course-year">{course.start_year} - {course.end_year}</span>
      </div>
      {course.subjects && course.subjects.length > 0 && (
        <div className="course-subjects">
          {course.subjects.slice(0, 3).map((subject, index) => (
            <span key={index} className="subject-tag">{subject}</span>
          ))}
          {course.subjects.length > 3 && (
            <span className="subject-tag">+{course.subjects.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseCard;
