"""
Excel Template Generator for Student Upload
Run this script to generate a sample Excel template with all columns
"""

import pandas as pd
from datetime import date

# Define all columns
columns = [
    # Required
    'student_id', 'student_name',
    
    # Student Info
    'dob', 'grade', 'community', 'enrollment_year', 'course', 'branch',
    'gender', 'student_mobile', 'aadhar_no', 'apaar_id', 'email', 'school_name',
    
    # Parent Info
    'guardian_name', 'guardian_occupation', 'guardian_mobile', 'guardian_email',
    'father_name', 'father_occupation', 'father_mobile', 'father_email',
    'mother_name', 'mother_occupation', 'mother_mobile', 'mother_email',
    'sibling_name', 'sibling_grade', 'sibling_school', 'sibling_college',
    
    # 10th Marks
    'tenth_school_name', 'tenth_year_of_passing', 'tenth_board_of_study',
    'tenth_english', 'tenth_tamil', 'tenth_hindi', 'tenth_maths',
    'tenth_science', 'tenth_social_science', 'tenth_total_marks',
    
    # 12th Marks
    'twelfth_school_name', 'twelfth_year_of_passing', 'twelfth_board_of_study',
    'twelfth_english', 'twelfth_tamil', 'twelfth_physics', 'twelfth_chemistry',
    'twelfth_maths', 'twelfth_biology', 'twelfth_computer_science', 'twelfth_total_marks',
    
    # Entrance Exam
    'entrance_exam_name', 'entrance_physics_marks', 'entrance_chemistry_marks',
    'entrance_maths_marks', 'entrance_biology_marks', 'entrance_total_marks',
    'entrance_overall_rank', 'entrance_community_rank',
    
    # Counselling
    'counselling_forum', 'counselling_round', 'counselling_college_alloted',
    'counselling_year_of_completion'
]

# Sample data
sample_data = {
    'student_id': ['S2024001', 'S2024002'],
    'student_name': ['Rajesh Kumar', 'Priya Sharma'],
    'dob': ['2005-03-15', '2005-06-20'],
    'grade': ['12', '12'],
    'community': ['OC', 'BC'],
    'enrollment_year': [2024, 2024],
    'course': ['NEET', 'NEET'],
    'branch': ['Biology', 'Biology'],
    'gender': ['Male', 'Female'],
    'student_mobile': ['9876543210', '9876543211'],
    'aadhar_no': ['1234-5678-9012', '1234-5678-9013'],
    'apaar_id': ['APAAR001', 'APAAR002'],
    'email': ['rajesh@example.com', 'priya@example.com'],
    'school_name': ['ABC Higher Secondary School', 'XYZ Matriculation School'],
    
    # Parent Info
    'guardian_name': ['', ''],
    'guardian_occupation': ['', ''],
    'guardian_mobile': ['', ''],
    'guardian_email': ['', ''],
    'father_name': ['Kumar Raj', 'Sharma Suresh'],
    'father_occupation': ['Engineer', 'Doctor'],
    'father_mobile': ['9876543220', '9876543221'],
    'father_email': ['kumar@example.com', 'sharma@example.com'],
    'mother_name': ['Lakshmi Kumar', 'Priya Sharma Sr.'],
    'mother_occupation': ['Teacher', 'Homemaker'],
    'mother_mobile': ['9876543230', '9876543231'],
    'mother_email': ['lakshmi@example.com', 'priyasr@example.com'],
    'sibling_name': ['Arun Kumar', ''],
    'sibling_grade': ['10th', ''],
    'sibling_school': ['ABC School', ''],
    'sibling_college': ['', ''],
    
    # 10th Marks
    'tenth_school_name': ['ABC School', 'XYZ School'],
    'tenth_year_of_passing': [2022, 2022],
    'tenth_board_of_study': ['State Board', 'CBSE'],
    'tenth_english': [85, 90],
    'tenth_tamil': [88, 85],
    'tenth_hindi': [0, 88],
    'tenth_maths': [92, 95],
    'tenth_science': [90, 92],
    'tenth_social_science': [87, 89],
    'tenth_total_marks': [442, 449],
    
    # 12th Marks
    'twelfth_school_name': ['ABC Higher Sec', 'XYZ Higher Sec'],
    'twelfth_year_of_passing': [2024, 2024],
    'twelfth_board_of_study': ['State Board', 'CBSE'],
    'twelfth_english': [85, 88],
    'twelfth_tamil': [80, 0],
    'twelfth_physics': [92, 95],
    'twelfth_chemistry': [90, 93],
    'twelfth_maths': [88, 0],
    'twelfth_biology': [95, 97],
    'twelfth_computer_science': [0, 0],
    'twelfth_total_marks': [530, 561],
    
    # Entrance Exam
    'entrance_exam_name': ['NEET', 'NEET'],
    'entrance_physics_marks': [140, 150],
    'entrance_chemistry_marks': [135, 145],
    'entrance_maths_marks': [0, 0],
    'entrance_biology_marks': [145, 155],
    'entrance_total_marks': [420, 450],
    'entrance_overall_rank': [15000, 8000],
    'entrance_community_rank': [5000, 2000],
    
    # Counselling
    'counselling_forum': ['TNEA', 'TNEA'],
    'counselling_round': [1, 1],
    'counselling_college_alloted': ['Govt Medical College', 'AIIMS'],
    'counselling_year_of_completion': [2030, 2030]
}

def generate_template():
    """Generate Excel template with sample data"""
    
    # Create DataFrame
    df = pd.DataFrame(sample_data)
    
    # Save to Excel
    filename = 'student_upload_template.xlsx'
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        # Write sample data
        df.to_excel(writer, sheet_name='Sample Data', index=False)
        
        # Write empty template
        empty_df = pd.DataFrame(columns=columns)
        empty_df.to_excel(writer, sheet_name='Empty Template', index=False)
        
        # Write instructions
        instructions = pd.DataFrame({
            'Instructions': [
                'REQUIRED COLUMNS:',
                '- student_id: Unique student identifier (e.g., S2024001)',
                '- student_name: Full name of the student',
                '',
                'OPTIONAL COLUMNS:',
                '- All other columns are optional',
                '- Leave empty cells for data you don\'t have',
                '',
                'DATE FORMAT:',
                '- dob: YYYY-MM-DD or DD/MM/YYYY (e.g., 2005-03-15)',
                '',
                'NUMERIC FIELDS:',
                '- All marks, years, and ranks should be numbers',
                '- Use 0 for subjects not applicable',
                '',
                'NOTES:',
                '- Only one entrance exam per row',
                '- batch_id is provided during upload, not in this file',
                '- For multiple exams, create separate rows with same student_id',
                '',
                'EXAMPLE:',
                'See "Sample Data" sheet for examples'
            ]
        })
        instructions.to_excel(writer, sheet_name='Instructions', index=False)
    
    print(f"✅ Template generated: {filename}")
    print("\nThe file contains 3 sheets:")
    print("1. Sample Data - Examples of filled data")
    print("2. Empty Template - Clean template for your data")
    print("3. Instructions - How to use the template")
    
    return filename

if __name__ == '__main__':
    generate_template()
