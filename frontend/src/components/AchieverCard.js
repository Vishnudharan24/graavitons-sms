import React from 'react';
import './AchieverCard.css';
import { DEFAULT_AVATAR } from '../config';

const AchieverCard = ({ achiever, onClick, onDelete }) => {
    const handleDelete = (e) => {
        e.stopPropagation(); // Prevent card click
        if (onDelete) onDelete(achiever.id);
    };

    return (
        <div className="achiever-card" onClick={() => onClick(achiever)}>
            <div className="achiever-photo">
                <img src={achiever.photo || DEFAULT_AVATAR} alt={achiever.name} />
                <div className="achievement-badge">
                    <span className="trophy-icon">🏆</span>
                </div>
            </div>

            <div className="achiever-info">
                <h3 className="achiever-name">{achiever.name}</h3>
                <p className="achiever-admission">{achiever.admissionNo}</p>
                <p className="achiever-batch">{achiever.batch}</p>

                <div className="achievement-highlight">
                    <div className="achievement-icon">⭐</div>
                    <div className="achievement-text">
                        <h4>{achiever.achievement}</h4>
                        <p>{achiever.achievementDetails}</p>
                    </div>
                </div>

                <div className="achiever-stats">
                    <div className="stat-item">
                        <span className="stat-label">Rank</span>
                        <span className="stat-value">{achiever.rank}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Score</span>
                        <span className="stat-value">{achiever.score}%</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Grade</span>
                        <span className="stat-value">{achiever.grade}</span>
                    </div>
                </div>

                <div className="achiever-card-actions">
                    <button className="view-profile-btn">
                        View Full Profile →
                    </button>
                    <button className="delete-achiever-btn" onClick={handleDelete}>
                        🗑️ Remove
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AchieverCard;
