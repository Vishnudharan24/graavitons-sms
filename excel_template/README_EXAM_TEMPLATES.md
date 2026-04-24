# Exam Marks Upload Templates

This directory contains sample Excel templates for uploading exam marks to the GRAAVITONS Student Management System.

## Available Templates

### 1. Unit Test Template
**File:** `daily_test_template_sample.xlsx`

**Structure:**
- Column A: Admission Number
- Column B: Student Name
- Column C: Marks (out of specified total)

**Usage:**
1. When adding a unit test in the system, click "Download Excel Format" to get a template with your actual students
2. The template will be auto-generated with:
   - All students in the selected batch
   - Correct admission numbers
   - Total marks field customized to your exam
3. Fill in the marks for each student
4. Upload the completed file

**Notes:**
- Leave marks blank for absent students (will be skipped)
- Enter only numeric values
- Do not modify Admission Number or Student Name columns

### 2. Monthly Test Template
**File:** `mock_test_template_sample.xlsx`

**Structure:**
- Column A: Admission Number
- Column B: Student Name
- Column C: Maths Marks
- Column D: Physics Marks
- Column E: Biology Marks
- Column F: Chemistry Marks

**Usage:**
1. When adding a monthly test in the system, click "Download Excel Format" to get a template with your actual students
2. The template will be auto-generated with all students in the selected batch
3. Fill in marks for all four subjects for each student
4. Upload the completed file

**Notes:**
- All four subject marks should be filled for each student
- Empty marks will be treated as 0
- Total marks are calculated automatically (sum of all subjects)
- Do not modify Admission Number or Student Name columns

## Dynamic Template Generation

The system provides two ways to get templates:

### Method 1: Backend API (Recommended)
Download templates directly from the backend API with actual student data:

**Unit Test Template:**
```
GET http://localhost:8000/api/exam/template/daily-test/{batch_id}?total_marks=100
```

**Monthly Test Template:**
```
GET http://localhost:8000/api/exam/template/mock-test/{batch_id}
```

These endpoints generate Excel files with:
- ✅ All students from the specified batch
- ✅ Formatted headers with styling
- ✅ Instructions sheet
- ✅ Proper column widths
- ✅ Cell borders and formatting

### Method 2: Frontend Download Button
Simply click the "📥 Download Excel Format" button in the Add Exam form. This will:
- Call the backend API automatically
- Download a template with your batch's students
- Include all proper formatting

## File Format Requirements

### For Upload Success:
1. **File Format:** `.xlsx` or `.xls` (Excel format)
2. **Header Row:** Must match the template exactly
3. **Admission Numbers:** Must match existing students in the database
4. **Data Types:** Numeric values only for marks
5. **No Extra Columns:** Do not add additional columns

### Supported Operations:
- ✅ Manual data entry in Excel
- ✅ Copy-paste from other sources
- ✅ Formula calculations (will be converted to values on upload)
- ✅ Partial marks entry (for unit test)

## Troubleshooting

### Common Upload Issues:

1. **"Student not found" errors**
   - Ensure admission numbers match exactly with database
   - Check for extra spaces or special characters
   - Verify students belong to the selected batch

2. **"Invalid marks value" errors**
   - Ensure marks are numeric (no text)
   - Check for special characters (%, $, etc.)
   - Verify marks are within valid range

3. **"Failed students" in response**
   - Review the detailed error message for each failed student
   - Fix the issues in Excel file
   - Re-upload the corrected file

### Best Practices:

1. **Always download a fresh template** before entering marks
2. **Don't modify** the structure or student information
3. **Save frequently** while entering marks
4. **Keep a backup** of your filled template
5. **Verify data** before uploading

## Sample Data

The sample templates in this directory contain fictional data for reference only:
- STU001 - John Doe
- STU002 - Jane Smith
- STU003 - Alice Johnson

Replace this sample data with your actual students when using the templates.

## API Integration

For developers integrating with the exam API:

### Upload Endpoint (Unit Test):
```
POST http://localhost:8000/api/exam/daily-test
Content-Type: application/json

{
  "batch_id": 1,
  "examName": "Physics Test 1",
  "examDate": "2026-02-10",
  "subject": "Physics",
  "unitName": "Unit 1 - Mechanics",
  "totalMarks": 100,
  "examType": "daily test",
  "studentMarks": [
    {"id": "STU001", "marks": "85"}
  ]
}
```

### Upload Endpoint (Monthly Test):
```
POST http://localhost:8000/api/exam/mock-test
Content-Type: application/json

{
  "batch_id": 1,
  "examName": "NEET Monthly Test 1",
  "examDate": "2026-02-15",
  "examType": "mock test",
  "mathsUnitNames": "Unit 1, Unit 2",
  "physicsUnitNames": "Unit 1, Unit 2",
  "chemistryUnitNames": "Unit 1, Unit 2",
  "biologyUnitNames": "Unit 1, Unit 2",
  "studentMarks": [
    {
      "id": "STU001",
      "mathsMarks": "85",
      "physicsMarks": "90",
      "chemistryMarks": "88",
      "biologyMarks": "92"
    }
  ]
}
```

## Support

For issues or questions about exam marks upload:
1. Check this README first
2. Verify your Excel file matches the template format
3. Review API response for detailed error messages
4. Contact system administrator if issues persist

---
Last Updated: February 6, 2026
