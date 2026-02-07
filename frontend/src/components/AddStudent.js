import React, { useState, useEffect } from 'react';
import './AddStudent.css';

const AddStudent = ({ batch, onBack, onSave, editMode = false, studentId = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('manual'); // 'manual' or 'upload'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(!editMode);
  
  const getInitialFormData = () => ({
    // Personal Information (matches student table)
    student_id: '',
    batch_id: batch?.batch_id || null, // Auto-populated from batch
    student_name: '',
    dob: '',
    grade: '',
    community: '',
    enrollment_year: new Date().getFullYear(),
    course: '',
    branch: '',
    student_mobile: '',
    aadhar_no: '',
    apaar_id: '',
    email: '',
    gender: '',
    school_name: '',
    photo_url: '',

    // Parent Information (matches parent_info table)
    guardian_name: '',
    guardian_occupation: '',
    guardian_mobile: '',
    guardian_email: '',
    father_name: '',
    father_occupation: '',
    father_mobile: '',
    father_email: '',
    mother_name: '',
    mother_occupation: '',
    mother_mobile: '',
    mother_email: '',
    sibling_name: '',
    sibling_grade: '',
    sibling_school: '',
    sibling_college: '',

    // 10th Standard Details (matches tenth_mark table)
    tenth_school_name: '',
    tenth_year_of_passing: '',
    tenth_board_of_study: '',
    tenth_english: '',
    tenth_tamil: '',
    tenth_hindi: '',
    tenth_maths: '',
    tenth_science: '',
    tenth_social_science: '',
    tenth_total_marks: '',

    // 12th Standard Details (matches twelfth_mark table)
    twelfth_school_name: '',
    twelfth_year_of_passing: '',
    twelfth_board_of_study: '',
    twelfth_english: '',
    twelfth_tamil: '',
    twelfth_physics: '',
    twelfth_chemistry: '',
    twelfth_maths: '',
    twelfth_biology: '',
    twelfth_computer_science: '',
    twelfth_total_marks: '',

    // Entrance Exams (Array - matches entrance_exams table)
    entrance_exams: [],

    // Counselling Details (matches counselling_detail table)
    counselling_forum: '',
    counselling_round: '',
    counselling_college_alloted: '',
    counselling_year_of_completion: ''
  });
  
  const [formData, setFormData] = useState(getInitialFormData());

  // Fetch student data if in edit mode
  useEffect(() => {
    if (editMode && studentId) {
      fetchStudentData();
    }
  }, [editMode, studentId]);

  const fetchStudentData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/student/${studentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Populate form with fetched data
      setFormData({
        ...getInitialFormData(),
        ...data,
        // Convert null to empty string for form inputs
        student_id: data.student_id || '',
        batch_id: data.batch_id || batch?.batch_id || null,
        student_name: data.student_name || '',
        dob: data.dob || '',
        grade: data.grade || '',
        community: data.community || '',
        enrollment_year: data.enrollment_year || new Date().getFullYear(),
        course: data.course || '',
        branch: data.branch || '',
        student_mobile: data.student_mobile || '',
        aadhar_no: data.aadhar_no || '',
        apaar_id: data.apaar_id || '',
        email: data.email || '',
        gender: data.gender || '',
        school_name: data.school_name || '',
        guardian_name: data.guardian_name || '',
        guardian_occupation: data.guardian_occupation || '',
        guardian_mobile: data.guardian_mobile || '',
        guardian_email: data.guardian_email || '',
        father_name: data.father_name || '',
        father_occupation: data.father_occupation || '',
        father_mobile: data.father_mobile || '',
        father_email: data.father_email || '',
        mother_name: data.mother_name || '',
        mother_occupation: data.mother_occupation || '',
        mother_mobile: data.mother_mobile || '',
        mother_email: data.mother_email || '',
        sibling_name: data.sibling_name || '',
        sibling_grade: data.sibling_grade || '',
        sibling_school: data.sibling_school || '',
        sibling_college: data.sibling_college || '',
        tenth_school_name: data.tenth_school_name || '',
        tenth_year_of_passing: data.tenth_year_of_passing || '',
        tenth_board_of_study: data.tenth_board_of_study || '',
        tenth_english: data.tenth_english || '',
        tenth_tamil: data.tenth_tamil || '',
        tenth_hindi: data.tenth_hindi || '',
        tenth_maths: data.tenth_maths || '',
        tenth_science: data.tenth_science || '',
        tenth_social_science: data.tenth_social_science || '',
        tenth_total_marks: data.tenth_total_marks || '',
        twelfth_school_name: data.twelfth_school_name || '',
        twelfth_year_of_passing: data.twelfth_year_of_passing || '',
        twelfth_board_of_study: data.twelfth_board_of_study || '',
        twelfth_english: data.twelfth_english || '',
        twelfth_tamil: data.twelfth_tamil || '',
        twelfth_physics: data.twelfth_physics || '',
        twelfth_chemistry: data.twelfth_chemistry || '',
        twelfth_maths: data.twelfth_maths || '',
        twelfth_biology: data.twelfth_biology || '',
        twelfth_computer_science: data.twelfth_computer_science || '',
        twelfth_total_marks: data.twelfth_total_marks || '',
        counselling_forum: data.counselling_forum || '',
        counselling_round: data.counselling_round || '',
        counselling_college_alloted: data.counselling_college_alloted || '',
        counselling_year_of_completion: data.counselling_year_of_completion || ''
      });
      
      setDataLoaded(true);
    } catch (err) {
      console.error('Error fetching student data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Entrance Exam Handlers
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
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please upload an Excel file (.xlsx or .xls)');
        e.target.value = '';
        return;
      }
      setUploadFile(file);
      setError('');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }

    if (!batch?.batch_id) {
      setError('Batch ID is missing');
      return;
    }

    setLoading(true);
    setError('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('batch_id', batch.batch_id);

      const response = await fetch('http://localhost:8000/api/student/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload file');
      }

      const result = await response.json();
      console.log('Upload result:', result);
      
      setUploadResult(result);
      
      if (result.success_count > 0) {
        alert(`Upload completed!\nSuccessfully added: ${result.success_count} students\nErrors: ${result.error_count}`);
        
        // If all successful, go back
        if (result.error_count === 0) {
          onSave(result);
          setTimeout(() => onBack(), 2000);
        }
      }
      
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Failed to upload file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/student/template');
      const data = await response.json();
      
      // Show template info
      const allColumns = [
        ...data.columns.required,
        ...data.columns.optional_student_info,
        ...data.columns.optional_parent_info,
        ...data.columns.optional_10th_marks,
        ...data.columns.optional_12th_marks,
        ...data.columns.optional_entrance_exam,
        ...data.columns.optional_counselling
      ];
      
      alert(`Excel Template Columns:\n\nRequired: ${data.columns.required.join(', ')}\n\nTotal columns available: ${allColumns.length}\n\nGenerate template using: python backend/generate_excel_template.py`);
    } catch (err) {
      console.error('Error fetching template info:', err);
      alert('Could not fetch template info. Generate template using:\npython backend/generate_excel_template.py');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Prepare data - convert empty strings to null and ensure correct types
      const prepareData = (data) => {
        const prepared = {};
        
        for (const [key, value] of Object.entries(data)) {
          if (value === '' || value === undefined) {
            prepared[key] = null;
          } else if (key.includes('year') || key.includes('marks') || key === 'enrollment_year' || key === 'counselling_round') {
            // Convert numeric fields to numbers
            prepared[key] = value ? parseInt(value) : null;
          } else {
            prepared[key] = value;
          }
        }
        
        return prepared;
      };

      const submissionData = prepareData(formData);
      
      // Remove student_id and batch_id from update payload
      if (editMode) {
        delete submissionData.student_id;
        delete submissionData.batch_id;
      }

      // Determine URL and method based on mode
      const url = editMode 
        ? `http://localhost:8000/api/student/${studentId}`
        : 'http://localhost:8000/api/student';
      
      const method = editMode ? 'PUT' : 'POST';

      // Make API call
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${editMode ? 'update' : 'add'} student`);
      }

      const result = await response.json();
      console.log(`Student ${editMode ? 'updated' : 'added'} successfully:`, result);
      
      // Call onSave callback with the response
      if (editMode) {
        onSave(result);
      } else {
        onSave(result.student);
      }
      
      // Show success message
      alert(`Student ${editMode ? 'updated' : 'added'} successfully!`);
      
      // Go back to batch detail
      onBack();
      
    } catch (err) {
      console.error(`Error ${editMode ? 'updating' : 'adding'} student:`, err);
      setError(err.message || `Failed to ${editMode ? 'update' : 'add'} student. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-student">
      <div className="add-student-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>{editMode ? `Edit Student: ${formData.student_name || studentId}` : `Add New Student to ${batch?.batch_name}`}</h2>
      </div>

      {/* Mode Toggle - Only show in add mode, not edit mode */}
      {!editMode && (
      <div className="mode-toggle" style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '10px'
      }}>
        <button
          type="button"
          onClick={() => setMode('manual')}
          style={{
            padding: '10px 20px',
            backgroundColor: mode === 'manual' ? '#5b5fc7' : '#f7f8fc',
            color: mode === 'manual' ? 'white' : '#4a5568',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: '600',
            borderBottom: mode === 'manual' ? '3px solid #5b5fc7' : 'none'
          }}
        >
          📝 Manual Entry
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          style={{
            padding: '10px 20px',
            backgroundColor: mode === 'upload' ? '#5b5fc7' : '#f7f8fc',
            color: mode === 'upload' ? 'white' : '#4a5568',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: '600',
            borderBottom: mode === 'upload' ? '3px solid #5b5fc7' : 'none'
          }}
        >
          📤 Upload Excel
        </button>
      </div>
      )}

      {mode === 'upload' && !editMode ? (
        /* Excel Upload Section */
        <div>
          <form onSubmit={handleFileUpload}>
            {/* Error Message */}
            {error && (
              <div className="error-message" style={{ 
                padding: '15px', 
                backgroundColor: '#fee', 
                color: '#c00', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #fcc'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Success Result */}
            {uploadResult && (
              <div style={{
                padding: '15px',
                backgroundColor: uploadResult.error_count === 0 ? '#d4edda' : '#fff3cd',
                color: uploadResult.error_count === 0 ? '#155724' : '#856404',
                borderRadius: '8px',
                marginBottom: '20px',
                border: `1px solid ${uploadResult.error_count === 0 ? '#c3e6cb' : '#ffeaa7'}`
              }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Upload Results:</h4>
                <p style={{ margin: '5px 0' }}>✅ Successfully added: {uploadResult.success_count} students</p>
                {uploadResult.error_count > 0 && (
                  <>
                    <p style={{ margin: '5px 0' }}>❌ Errors: {uploadResult.error_count}</p>
                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <strong>Error Details:</strong>
                        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                          {uploadResult.errors.map((err, idx) => (
                            <li key={idx}>
                              Row {err.row} - Student {err.student_id}: {err.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Batch Info Display */}
            {batch && (
              <div className="form-section" style={{ backgroundColor: '#f0f4ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#5b5fc7' }}>Batch Information</h4>
                <p style={{ margin: '5px 0' }}><strong>Batch:</strong> {batch.batch_name}</p>
                <p style={{ margin: '5px 0' }}><strong>Type:</strong> {batch.type || 'N/A'}</p>
                <p style={{ margin: '5px 0' }}><strong>Year:</strong> {batch.start_year}-{batch.end_year}</p>
              </div>
            )}

            {/* Upload Instructions */}
            <div className="form-section">
              <h3>Upload Excel File</h3>
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 10px 0' }}>📋 Instructions:</h4>
                <ol style={{ margin: '0', paddingLeft: '20px' }}>
                  <li>Download the Excel template by clicking "View Template Info" below</li>
                  <li>Fill in your student data (only student_id and student_name are required)</li>
                  <li>Upload the completed Excel file using the file input below</li>
                  <li>Click "Upload Students" to process the file</li>
                </ol>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  style={{
                    marginTop: '15px',
                    padding: '8px 16px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  📄 View Template Info
                </button>
              </div>

              {/* File Input */}
              <div className="form-group">
                <label>Select Excel File *</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                  style={{
                    padding: '10px',
                    border: '2px dashed #cbd5e0',
                    borderRadius: '8px',
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                {uploadFile && (
                  <p style={{ marginTop: '10px', color: '#5b5fc7', fontWeight: '600' }}>
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={onBack}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-submit"
                disabled={loading || !uploadFile}
              >
                {loading ? 'Uploading...' : '📤 Upload Students'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Manual Entry Form */
        <form onSubmit={handleSubmit}>
          {loading && editMode && !dataLoaded && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#5b5fc7',
              fontSize: '16px'
            }}>
              Loading student data...
            </div>
          )}
        {/* Error Message */}
        {error && (
          <div className="error-message" style={{ 
            padding: '15px', 
            backgroundColor: '#fee', 
            color: '#c00', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #fcc'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Batch Info Display */}
        {batch && (
          <div className="form-section" style={{ backgroundColor: '#f0f4ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#5b5fc7' }}>Batch Information</h4>
            <p style={{ margin: '5px 0' }}><strong>Batch:</strong> {batch.batch_name}</p>
            <p style={{ margin: '5px 0' }}><strong>Type:</strong> {batch.type || 'N/A'}</p>
            <p style={{ margin: '5px 0' }}><strong>Year:</strong> {batch.start_year}-{batch.end_year}</p>
            <input type="hidden" name="batch_id" value={formData.batch_id} />
          </div>
        )}

        {/* Personal Information Section */}
        <div className="form-section">
          <h3>Personal Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Student ID / Admission Number *</label>
              <input 
                type="text" 
                name="student_id" 
                value={formData.student_id} 
                onChange={handleChange} 
                required
                disabled={editMode}
                style={editMode ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {}}
                placeholder="e.g., S2024001" 
              />
            </div>
            <div className="form-group">
              <label>Student Name *</label>
              <input 
                type="text" 
                name="student_name" 
                value={formData.student_name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Date of Birth *</label>
              <input 
                type="date" 
                name="dob" 
                value={formData.dob} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Grade *</label>
              <input 
                type="text" 
                name="grade" 
                value={formData.grade} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Gender *</label>
              <select 
                name="gender" 
                value={formData.gender} 
                onChange={handleChange} 
                required
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="form-group">
              <label>Community</label>
              <input 
                type="text" 
                name="community" 
                value={formData.community} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Enrollment Year *</label>
              <input 
                type="number" 
                name="enrollment_year" 
                value={formData.enrollment_year} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Course *</label>
              <input 
                type="text" 
                name="course" 
                value={formData.course} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Branch</label>
              <input 
                type="text" 
                name="branch" 
                value={formData.branch} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Student Mobile Number</label>
              <input 
                type="tel" 
                name="student_mobile" 
                value={formData.student_mobile} 
                onChange={handleChange} 
                placeholder="+91 XXXXXXXXXX" 
              />
            </div>
            <div className="form-group">
              <label>Aadhar Number</label>
              <input 
                type="text" 
                name="aadhar_no" 
                value={formData.aadhar_no} 
                onChange={handleChange} 
                placeholder="XXXX-XXXX-XXXX" 
              />
            </div>
            <div className="form-group">
              <label>APAAR ID</label>
              <input 
                type="text" 
                name="apaar_id" 
                value={formData.apaar_id} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Email ID</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>School Name *</label>
              <input 
                type="text" 
                name="school_name" 
                value={formData.school_name} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>
        </div>

        {/* Parent & Family Details */}
        <div className="form-section">
          <h3>Parent & Family Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Guardian Name</label>
              <input 
                type="text" 
                name="guardian_name" 
                value={formData.guardian_name} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Guardian Occupation</label>
              <input 
                type="text" 
                name="guardian_occupation" 
                value={formData.guardian_occupation} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Guardian Mobile</label>
              <input 
                type="tel" 
                name="guardian_mobile" 
                value={formData.guardian_mobile} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Guardian Email</label>
              <input 
                type="email" 
                name="guardian_email" 
                value={formData.guardian_email} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Father Name *</label>
              <input 
                type="text" 
                name="father_name" 
                value={formData.father_name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Father Occupation</label>
              <input 
                type="text" 
                name="father_occupation" 
                value={formData.father_occupation} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Father Mobile *</label>
              <input 
                type="tel" 
                name="father_mobile" 
                value={formData.father_mobile} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Father Email</label>
              <input 
                type="email" 
                name="father_email" 
                value={formData.father_email} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Mother Name *</label>
              <input 
                type="text" 
                name="mother_name" 
                value={formData.mother_name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Mother Occupation</label>
              <input 
                type="text" 
                name="mother_occupation" 
                value={formData.mother_occupation} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Mother Mobile *</label>
              <input 
                type="tel" 
                name="mother_mobile" 
                value={formData.mother_mobile} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Mother Email</label>
              <input 
                type="email" 
                name="mother_email" 
                value={formData.mother_email} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Sibling Name</label>
              <input 
                type="text" 
                name="sibling_name" 
                value={formData.sibling_name} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Sibling Grade/Degree</label>
              <input 
                type="text" 
                name="sibling_grade" 
                value={formData.sibling_grade} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Sibling School</label>
              <input 
                type="text" 
                name="sibling_school" 
                value={formData.sibling_school} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Sibling College</label>
              <input 
                type="text" 
                name="sibling_college" 
                value={formData.sibling_college} 
                onChange={handleChange} 
              />
            </div>
          </div>
        </div>

        {/* 10th Standard Details */}
        <div className="form-section">
          <h3>10th Standard Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>School Name</label>
              <input 
                type="text" 
                name="tenth_school_name" 
                value={formData.tenth_school_name} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Year of Passing</label>
              <input 
                type="number" 
                name="tenth_year_of_passing" 
                value={formData.tenth_year_of_passing} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Board of Study</label>
              <input 
                type="text" 
                name="tenth_board_of_study" 
                value={formData.tenth_board_of_study} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <div className="marks-section">
            <h4>Marks Reached</h4>
            <div className="marks-grid">
              <div className="form-group">
                <label>English</label>
                <input 
                  type="number" 
                  name="tenth_english" 
                  value={formData.tenth_english} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Tamil</label>
                <input 
                  type="number" 
                  name="tenth_tamil" 
                  value={formData.tenth_tamil} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Hindi</label>
                <input 
                  type="number" 
                  name="tenth_hindi" 
                  value={formData.tenth_hindi} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Maths</label>
                <input 
                  type="number" 
                  name="tenth_maths" 
                  value={formData.tenth_maths} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Science</label>
                <input 
                  type="number" 
                  name="tenth_science" 
                  value={formData.tenth_science} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Social Science</label>
                <input 
                  type="number" 
                  name="tenth_social_science" 
                  value={formData.tenth_social_science} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Total</label>
                <input 
                  type="number" 
                  name="tenth_total_marks" 
                  value={formData.tenth_total_marks} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* 12th Standard Details */}
        <div className="form-section">
          <h3>12th Standard Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>School Name</label>
              <input 
                type="text" 
                name="twelfth_school_name" 
                value={formData.twelfth_school_name} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Year of Passing</label>
              <input 
                type="number" 
                name="twelfth_year_of_passing" 
                value={formData.twelfth_year_of_passing} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Board of Study</label>
              <input 
                type="text" 
                name="twelfth_board_of_study" 
                value={formData.twelfth_board_of_study} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <div className="marks-section">
            <h4>Marks Reached</h4>
            <div className="marks-grid">
              <div className="form-group">
                <label>English</label>
                <input 
                  type="number" 
                  name="twelfth_english" 
                  value={formData.twelfth_english} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Tamil</label>
                <input 
                  type="number" 
                  name="twelfth_tamil" 
                  value={formData.twelfth_tamil} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Physics</label>
                <input 
                  type="number" 
                  name="twelfth_physics" 
                  value={formData.twelfth_physics} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Chemistry</label>
                <input 
                  type="number" 
                  name="twelfth_chemistry" 
                  value={formData.twelfth_chemistry} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Maths</label>
                <input 
                  type="number" 
                  name="twelfth_maths" 
                  value={formData.twelfth_maths} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Biology</label>
                <input 
                  type="number" 
                  name="twelfth_biology" 
                  value={formData.twelfth_biology} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Computer Science</label>
                <input 
                  type="number" 
                  name="twelfth_computer_science" 
                  value={formData.twelfth_computer_science} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Total</label>
                <input 
                  type="number" 
                  name="twelfth_total_marks" 
                  value={formData.twelfth_total_marks} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Entrance Exam Marks */}
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
            <p style={{ color: '#666', fontStyle: 'italic' }}>No attempts added yet. Click "+ Add Attempt" to add exam details.</p>
          )}
        </div>

        {/* Counselling Details */}
        <div className="form-section">
          <h3>Counselling Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Proposed/Completed Forum</label>
              <input 
                type="text" 
                name="counselling_forum" 
                value={formData.counselling_forum} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Round</label>
              <input 
                type="number" 
                name="counselling_round" 
                value={formData.counselling_round} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>College Allotted</label>
              <input 
                type="text" 
                name="counselling_college_alloted" 
                value={formData.counselling_college_alloted} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group">
              <label>Year of Completion</label>
              <input 
                type="number" 
                name="counselling_year_of_completion" 
                value={formData.counselling_year_of_completion} 
                onChange={handleChange} 
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn-cancel" 
            onClick={onBack}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading || (editMode && !dataLoaded)}
          >
            {loading ? (editMode ? 'Updating...' : 'Adding Student...') : (editMode ? 'Update Student' : 'Add Student')}
          </button>
        </div>
      </form>
      )}
    </div>
  
  );
};

export default AddStudent;
