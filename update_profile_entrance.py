import re

profile_path = r'v:\odyssey\sms\GRAAVITONS\frontend\src\components\StudentProfile.js'

with open(profile_path, 'r', encoding='utf-8') as f:
    profile = f.read()

# 1. State Mapping in `displayData`
old_profile_entrance = """    // Entrance Exam Marks
    entranceExams: safeStudentData.entrance_exams || [],"""
new_profile_entrance = """    // Entrance Exam Marks
    entrance_exam_1: safeStudentData.entrance_exam_1 || '',
    entrance_exam_1_percentile: safeStudentData.entrance_exam_1_percentile || '',
    entrance_exam_1_mark: safeStudentData.entrance_exam_1_mark || '',
    entrance_exam_2: safeStudentData.entrance_exam_2 || '',
    entrance_exam_2_percentile: safeStudentData.entrance_exam_2_percentile || '',
    entrance_exam_2_mark: safeStudentData.entrance_exam_2_mark || '',
    entrance_exam_3: safeStudentData.entrance_exam_3 || '',
    entrance_exam_3_percentile: safeStudentData.entrance_exam_3_percentile || '',
    entrance_exam_3_mark: safeStudentData.entrance_exam_3_mark || '',"""
profile = profile.replace(old_profile_entrance, new_profile_entrance)

# 2. Excel PDF logic
old_excel_entrance = """    if (displayData.entranceExams.length > 0) {
      academicRows.push([], ['ENTRANCE EXAMS']);
      academicRows.push(['Exam Name', 'Physics', 'Chemistry', 'Maths', 'Biology', 'Total', 'Overall Rank', 'Community Rank']);
      displayData.entranceExams.forEach(exam => {
        academicRows.push([
          displayMark(exam.exam_name, '-'),
          displayMark(exam.physics_marks),
          displayMark(exam.chemistry_marks),
          displayMark(exam.maths_marks),
          displayMark(exam.biology_marks),
          displayMark(exam.total_marks),
          displayMark(exam.overall_rank),
          displayMark(exam.community_rank)
        ]);
      });
    }"""
new_excel_entrance = """    academicRows.push([], ['ENTRANCE EXAMS']);
    academicRows.push(['Exam Name', 'Percentile', 'Mark']);
    if (displayData.entrance_exam_1) academicRows.push([displayData.entrance_exam_1, displayData.entrance_exam_1_percentile, displayData.entrance_exam_1_mark]);
    if (displayData.entrance_exam_2) academicRows.push([displayData.entrance_exam_2, displayData.entrance_exam_2_percentile, displayData.entrance_exam_2_mark]);
    if (displayData.entrance_exam_3) academicRows.push([displayData.entrance_exam_3, displayData.entrance_exam_3_percentile, displayData.entrance_exam_3_mark]);
"""
profile = profile.replace(old_excel_entrance, new_excel_entrance)

# 3. Component render
old_render_entrance = """          {/* Entrance Exam Marks */}
          <div className="profile-section marks-section fade-in">
            <h3>Entrance Exam Marks</h3>
            {displayData.entranceExams.length > 0 ? (
              <div className="table-responsive">
                <table className="marks-table">
                  <thead>
                    <tr>
                      <th>Exam Name</th>
                      <th>Physics</th>
                      <th>Chemistry</th>
                      <th>Maths</th>
                      <th>Biology</th>
                      <th>Total</th>
                      <th>Overall Rank</th>
                      <th>Community Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.entranceExams.map((exam, index) => (
                      <tr key={index}>
                        <td>{displayMark(exam.exam_name, '-')}</td>
                        <td>{displayMark(exam.physics_marks)}</td>
                        <td>{displayMark(exam.chemistry_marks)}</td>
                        <td>{displayMark(exam.maths_marks)}</td>
                        <td>{displayMark(exam.biology_marks)}</td>
                        <td>{displayMark(exam.total_marks)}</td>
                        <td>{displayMark(exam.overall_rank)}</td>
                        <td>{displayMark(exam.community_rank)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data-card">
                <FaInfoCircle className="no-data-icon" />
                <p>No entrance exam data available</p>
              </div>
            )}
          </div>"""

new_render_entrance = """          {/* Entrance Exam Marks */}
          <div className="profile-section marks-section fade-in">
            <h3>Entrance Exam Marks</h3>
            <div className="table-responsive">
              <table className="marks-table">
                <thead>
                  <tr>
                    <th>Exam Name</th>
                    <th>Percentile</th>
                    <th>Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map(num => {
                    const name = displayData[`entrance_exam_${num}`];
                    const percentile = displayData[`entrance_exam_${num}_percentile`];
                    const mark = displayData[`entrance_exam_${num}_mark`];
                    if (!name) return null;
                    return (
                      <tr key={num}>
                        <td>{name}</td>
                        <td>{displayMark(percentile)}</td>
                        <td>{displayMark(mark)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(!displayData.entrance_exam_1 && !displayData.entrance_exam_2 && !displayData.entrance_exam_3) && (
              <div className="no-data-card">
                <FaInfoCircle className="no-data-icon" />
                <p>No entrance exam data available</p>
              </div>
            )}
          </div>"""

profile = profile.replace(old_render_entrance, new_render_entrance)

with open(profile_path, 'w', encoding='utf-8') as f:
    f.write(profile)

print('Done')
