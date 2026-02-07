# Quick Reference: Excel Upload for Exam Marks

## 🚀 Quick Start

### Step 1: Download Template
**Frontend:**
- Open Add Exam form
- Select exam type (daily test/mock test)
- Fill exam details
- Click "📥 Download Excel Format"

**Direct API:**
```bash
# Daily Test Template
curl -O http://localhost:8000/api/exam/template/daily-test/1?total_marks=100

# Mock Test Template
curl -O http://localhost:8000/api/exam/template/mock-test/1
```

### Step 2: Fill Marks in Excel
**Daily Test:**
```
| Admission Number | Student Name  | Marks (out of 100) |
|------------------|---------------|---------------------|
| STU001          | John Doe      | 85                  |
| STU002          | Jane Smith    | 92                  |
```

**Mock Test:**
```
| Admission Number | Student Name | Maths | Physics | Biology | Chemistry |
|------------------|--------------|-------|---------|---------|-----------|
| STU001          | John Doe     | 85    | 90      | 88      | 92        |
| STU002          | Jane Smith   | 78    | 82      | 85      | 80        |
```

### Step 3: Upload File
- Switch to "Excel Upload" mode
- Click "📤 Upload Completed Excel"
- Select your filled file
- Review preview
- Submit

## 📋 Template Format

### Daily Test Columns
1. **Admission Number** - Don't modify
2. **Student Name** - Don't modify  
3. **Marks** - Enter numeric value

### Mock Test Columns
1. **Admission Number** - Don't modify
2. **Student Name** - Don't modify
3. **Maths Marks** - Enter value
4. **Physics Marks** - Enter value
5. **Biology Marks** - Enter value
6. **Chemistry Marks** - Enter value

## ✅ Best Practices

1. **Always download fresh template** for each exam
2. **Don't rename columns** or change structure
3. **Use numeric values only** for marks
4. **Leave blank** for absent students (daily test)
5. **Fill all subjects** for mock test
6. **Save as .xlsx** format
7. **Keep backup** of filled file

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Student not found | Wrong admission number | Verify against database |
| Invalid marks | Non-numeric value | Use numbers only |
| File read error | Wrong format | Save as .xlsx |
| Empty upload | No marks entered | Fill at least one mark |

## 🔗 API Endpoints

### Get Templates
```
GET /api/exam/template/daily-test/{batch_id}?total_marks=100
GET /api/exam/template/mock-test/{batch_id}
```

### Upload Marks
```
POST /api/exam/daily-test
POST /api/exam/mock-test
```

## 📝 Sample Files

Location: `excel_template/`
- `daily_test_template_sample.xlsx`
- `mock_test_template_sample.xlsx`

## 💡 Pro Tips

1. **Use Excel formulas** before saving (will convert to values)
2. **Sort by admission number** for easy verification
3. **Color code** problem entries before fixing
4. **Check preview** carefully before submitting
5. **Download template includes your actual students** - no manual entry needed!

## 🐛 Troubleshooting

**Template won't download:**
- Check backend server is running
- Verify batch has students
- Check browser console for errors

**Upload fails:**
- Verify file format (.xlsx)
- Check column headers match
- Ensure admission numbers are correct
- Review error message details

**Wrong students in template:**
- Verify correct batch_id
- Check students are assigned to batch
- Refresh student list

## 📞 Need Help?

1. Check `README_EXAM_TEMPLATES.md` for detailed guide
2. Review `IMPLEMENTATION_EXCEL_UPLOAD.md` for technical details
3. Run `demo_template_download.py` for examples
4. Check API docs at `http://localhost:8000/docs`

---
Generated: February 6, 2026
