import re
import os

add_student_path = r'v:\odyssey\sms\GRAAVITONS\frontend\src\components\AddStudent.js'

with open(add_student_path, 'r', encoding='utf-8') as f:
    add_student = f.read()

# 1. AddStudent.js - State Initialization
old_state = """    // Entrance Exams (Array - matches entrance_exams table)
    entrance_exams: [],"""
new_state = """    // Entrance Exams
    entrance_exam_1: '',
    entrance_exam_1_percentile: '',
    entrance_exam_1_mark: '',
    entrance_exam_2: '',
    entrance_exam_2_percentile: '',
    entrance_exam_2_mark: '',
    entrance_exam_3: '',
    entrance_exam_3_percentile: '',
    entrance_exam_3_mark: '','"""""
add_student = add_student.replace(old_state, new_state.strip())

# 2. AddStudent.js - Entrance Exam Handlers
old_handlers = """  // Entrance Exam Handlers
  const handleAddExam = () => {
    const newExam = {
      exam_name: 'NEET',
      physics_marks: '',
      chemistry_marks: '',
      biology_marks: '',
      maths_marks: '',
      total_marks: '',
      overall_rank: '',
      community_rank: ''
    };
    setFormData(prev => ({
      ...prev,
      entrance_exams: [...prev.entrance_exams, newExam]
    }));
  };

  const handleRemoveExam = (index) => {
    setFormData(prev => ({
      ...prev,
      entrance_exams: prev.entrance_exams.filter((_, i) => i !== index)
    }));
  };

  const handleExamChange = (index, field, value) => {
    const updatedExams = [...formData.entrance_exams];
    updatedExams[index][field] = value;
    setFormData(prev => ({ ...prev, entrance_exams: updatedExams }));
  };"""
add_student = add_student.replace(old_handlers, "")

# 3. AddStudent.js - Template Info
old_template_info = """      // Entrance exam
      'entrance_exam_name', 'entrance_physics_marks', 'entrance_chemistry_marks',
      'entrance_maths_marks', 'entrance_biology_marks', 'entrance_total_marks',
      'entrance_overall_rank', 'entrance_community_rank',"""
new_template_info = """      // Entrance exam
      'entrance_exam_1', 'entrance_exam_1_percentile', 'entrance_exam_1_mark',
      'entrance_exam_2', 'entrance_exam_2_percentile', 'entrance_exam_2_mark',
      'entrance_exam_3', 'entrance_exam_3_percentile', 'entrance_exam_3_mark',"""
add_student = add_student.replace(old_template_info, new_template_info)

# 4. AddStudent.js - Replace Entrance Exam Render
old_render = """        {/* Entrance Exam Marks */}
        <div className="form-section">
          <h3>Entrance Exam Marks</h3>
          <button type="button" className="btn-add-exam" onClick={handleAddExam}>
            + Add Attempt
          </button>

          {formData.entrance_exams.map((exam, index) => (
            <div key={index} className="exam-card">
              <div className="exam-card-header">
                <h4>Attempt {index + 1}</h4>
                <button type="button" className="btn-remove-exam" onClick={() => handleRemoveExam(index)}>
                  Remove
                </button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Exam Name</label>
                  <select
                    value={exam.exam_name}
                    onChange={(e) => handleExamChange(index, 'exam_name', e.target.value)}
                  >
                    <option value="NEET">NEET</option>
                    <option value="JEE Main - Phase 1">JEE Main - Phase 1</option>
                    <option value="JEE Main - Phase 2">JEE Main - Phase 2</option>
                    <option value="JEE Advanced">JEE Advanced</option>
                    <option value="CUET">CUET</option>
                    <option value="IISER">IISER</option>
                    <option value="NISER">NISER</option>
                    <option value="ICAR">ICAR</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="marks-grid">
                <div className="form-group">
                  <label>Physics Marks</label>
                  <input 
                    type="number" 
                    value={exam.physics_marks} 
                    onChange={(e) => handleExamChange(index, 'physics_marks', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Chemistry Marks</label>
                  <input 
                    type="number" 
                    value={exam.chemistry_marks} 
                    onChange={(e) => handleExamChange(index, 'chemistry_marks', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Biology Marks</label>
                  <input 
                    type="number" 
                    value={exam.biology_marks} 
                    onChange={(e) => handleExamChange(index, 'biology_marks', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Maths Marks</label>
                  <input 
                    type="number" 
                    value={exam.maths_marks} 
                    onChange={(e) => handleExamChange(index, 'maths_marks', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Total Marks</label>
                  <input 
                    type="number" 
                    value={exam.total_marks} 
                    onChange={(e) => handleExamChange(index, 'total_marks', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Overall Rank</label>
                  <input 
                    type="number" 
                    value={exam.overall_rank} 
                    onChange={(e) => handleExamChange(index, 'overall_rank', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Community Rank</label>
                  <input 
                    type="number" 
                    value={exam.community_rank} 
                    onChange={(e) => handleExamChange(index, 'community_rank', e.target.value)} 
                  />
                </div>
              </div>
            </div>
          ))}
          {formData.entrance_exams.length === 0 && (
            <div className="no-exams-message">
              No entrance exams added. Click '+ Add Attempt' to add one.
            </div>
          )}
        </div>"""

new_render = """        {/* Entrance Exam Marks */}
        <div className="form-section">
          <h3>Entrance Exam Marks</h3>
          
          {[1, 2, 3].map(num => (
            <div key={num} className="exam-card">
              <div className="exam-card-header">
                <h4>Entrance Exam {num}</h4>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Exam Name</label>
                  <select
                    name={`entrance_exam_${num}`}
                    value={formData[`entrance_exam_${num}`] || ''}
                    onChange={handleChange}
                  >
                    <option value="">-- Select Exam --</option>
                    <option value="NEET">NEET</option>
                    <option value="JEE Main">JEE Main</option>
                    <option value="JEE Advanced">JEE Advanced</option>
                    <option value="CUET">CUET</option>
                    <option value="IISER">IISER</option>
                    <option value="NISER">NISER</option>
                    <option value="ICAR">ICAR</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Percentile</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name={`entrance_exam_${num}_percentile`}
                    value={formData[`entrance_exam_${num}_percentile`] || ''}
                    onChange={handleChange} 
                  />
                </div>
                <div className="form-group">
                  <label>Mark</label>
                  <input 
                    type="number" 
                    name={`entrance_exam_${num}_mark`}
                    value={formData[`entrance_exam_${num}_mark`] || ''}
                    onChange={handleChange} 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>"""

add_student = add_student.replace(old_render, new_render)

# Remove the line `['  • For entrance exams, only one exam per row is supported.'],`
add_student = add_student.replace("      ['  • For entrance exams, only one exam per row is supported.'],", "")


with open(add_student_path, 'w', encoding='utf-8') as f:
    f.write(add_student)


# StudentProfile.js Update
profile_path = r'v:\odyssey\sms\GRAAVITONS\frontend\src\components\StudentProfile.js'

with open(profile_path, 'r', encoding='utf-8') as f:
    profile = f.read()

# 1. State Mapping
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
old_excel_entrance = """    // ===== Sheet 2: Academic Marks (10th, 12th, Entrance) =====
    const academicData = [
      ['SECTION', 'SUBJECT / FIELD', 'MARKS / VALUE'],
      [], // blank line
      ['10TH STANDARD', 'Board of Study', displayData.tenth.board],
      ['', 'Year of Passing', displayData.tenth.year],
      ['', 'English', displayData.tenth.english],
      ['', 'Tamil / Regional Language', displayData.tenth.tamil],
      ['', 'Hindi', displayData.tenth.hindi],
      ['', 'Maths', displayData.tenth.maths],
      ['', 'Science', displayData.tenth.science],
      ['', 'Social Science', displayData.tenth.socialScience],
      ['', 'Total Marks', displayData.tenth.totalMarks],
      [], // blank line
      ['12TH STANDARD', 'School Name', displayData.twelfth.schoolName],
      ['', 'Board of Study', displayData.twelfth.board],
      ['', 'Year of Passing', displayData.twelfth.year],
      ['', 'English', displayData.twelfth.english],
      ['', 'Tamil / Regional Language', displayData.twelfth.tamil],
      ['', 'Physics', displayData.twelfth.physics],
      ['', 'Chemistry', displayData.twelfth.chemistry],
      ['', 'Maths', displayData.twelfth.maths],
      ['', 'Biology', displayData.twelfth.biology],
      ['', 'Computer Science', displayData.twelfth.computerScience],
      ['', 'Total Marks', displayData.twelfth.totalMarks]
    ];

    if (displayData.entranceExams.length > 0) {
      academicRows.push([], ['ENTRANCE EXAMS']);
      
      displayData.entranceExams.forEach(exam => {
        academicRows.push([exam.exam_name, 'Physics', exam.physics_marks]);
        academicRows.push(['', 'Chemistry', exam.chemistry_marks]);
        academicRows.push(['', 'Biology', exam.biology_marks]);
        academicRows.push(['', 'Maths', exam.maths_marks]);
        academicRows.push(['', 'Total Marks', exam.total_marks]);
        academicRows.push(['', 'Overall Rank', exam.overall_rank]);
        academicRows.push(['', 'Community Rank', exam.community_rank]);
        academicRows.push([]); // blank separator
      });
    }"""
# Note: wait the original code uses `academicRows.push` but there's a `const academicData = [` first. Let's see exactly how it's written in `StudentProfile.js` by not doing an exact multi-line replace, but a regex or something, because `academicRows` might not match. Let's write Python to do it safer.

profile = re.sub(
    r"if \(displayData\.entranceExams\.length > 0\) \{.*?\}\n",
    "",
    profile,
    flags=re.DOTALL
)

# Insert the new entrance exam logic right before `    const academicWs = XLSX.utils.aoa_to_sheet(academicData);`
# Or append to `academicData`. Wait, `academicData` might not exist like that. Let me look at line 1323 of StudentProfile.js.
