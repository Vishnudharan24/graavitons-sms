import re
import os

p = r'v:\odyssey\sms\GRAAVITONS\backend\api\student.py'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add safe_float
safe_float_code = """
def safe_float(value):
    if value is None or str(value).strip() == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
"""
if "def safe_float" not in c:
    c = c.replace("def safe_int", safe_float_code.strip() + "\n\ndef safe_int")

# 2. Remove EntranceExam class
c = re.sub(r'class EntranceExam\(BaseModel\):\n.*?overall_rank: Optional\[int\] = None\n\n\n', '', c, flags=re.DOTALL)

# 3. Update StudentCreate
old_sc_entrance = """    # Entrance exams (array)
    entrance_exams: Optional[List[EntranceExam]] = []"""
new_sc_entrance = """    # Entrance exams
    entrance_exam_1: Optional[str] = None
    entrance_exam_1_percentile: Optional[float] = None
    entrance_exam_1_mark: Optional[int] = None
    entrance_exam_2: Optional[str] = None
    entrance_exam_2_percentile: Optional[float] = None
    entrance_exam_2_mark: Optional[int] = None
    entrance_exam_3: Optional[str] = None
    entrance_exam_3_percentile: Optional[float] = None
    entrance_exam_3_mark: Optional[int] = None"""
c = c.replace(old_sc_entrance, new_sc_entrance)

# 4. Update StudentUpdate
old_su_counselling = """    # Counselling details"""
new_su_counselling = """    # Entrance exams
    entrance_exam_1: Optional[str] = None
    entrance_exam_1_percentile: Optional[float] = None
    entrance_exam_1_mark: Optional[int] = None
    entrance_exam_2: Optional[str] = None
    entrance_exam_2_percentile: Optional[float] = None
    entrance_exam_2_mark: Optional[int] = None
    entrance_exam_3: Optional[str] = None
    entrance_exam_3_percentile: Optional[float] = None
    entrance_exam_3_mark: Optional[int] = None
    
    # Counselling details"""
c = c.replace(old_su_counselling, new_su_counselling, 1)

# 5. Insert logic
old_insert_entrance = """        # 5. Insert entrance exams (if provided)
        if student_data.entrance_exams:
            for exam in student_data.entrance_exams:
                cursor.execute(\"\"\"
                    INSERT INTO entrance_exams (
                        student_no, exam_name, physics_marks, chemistry_marks,
                        maths_marks, biology_marks, total_marks, community_rank, overall_rank
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                \"\"\", (
                    student_no, exam.exam_name, exam.physics_marks,
                    exam.chemistry_marks, exam.maths_marks, exam.biology_marks,
                    exam.total_marks, exam.community_rank, exam.overall_rank
                ))"""
new_insert_entrance = """        # 5. Insert entrance exams (if provided)
        if (student_data.entrance_exam_1 or student_data.entrance_exam_2 or student_data.entrance_exam_3):
            cursor.execute(\"\"\"
                INSERT INTO entrance_exams (
                    student_no, 
                    entrance_exam_1, entrance_exam_1_percentile, entrance_exam_1_mark,
                    entrance_exam_2, entrance_exam_2_percentile, entrance_exam_2_mark,
                    entrance_exam_3, entrance_exam_3_percentile, entrance_exam_3_mark
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            \"\"\", (
                student_no, 
                student_data.entrance_exam_1, student_data.entrance_exam_1_percentile, student_data.entrance_exam_1_mark,
                student_data.entrance_exam_2, student_data.entrance_exam_2_percentile, student_data.entrance_exam_2_mark,
                student_data.entrance_exam_3, student_data.entrance_exam_3_percentile, student_data.entrance_exam_3_mark
            ))"""
c = c.replace(old_insert_entrance, new_insert_entrance)

# 6. Bulk Upload Logic
old_upload_prep = """                # Prepare entrance exams if columns exist
                entrance_exams = []
                if get_val('entrance_exam_name') is not None:
                    entrance_exams.append(EntranceExam(
                        exam_name=safe_str(get_val('entrance_exam_name')),
                        physics_marks=safe_int(get_val('entrance_physics_marks')),
                        chemistry_marks=safe_int(get_val('entrance_chemistry_marks')),
                        maths_marks=safe_int(get_val('entrance_maths_marks')),
                        biology_marks=safe_int(get_val('entrance_biology_marks')),
                        total_marks=safe_int(get_val('entrance_total_marks')),
                        overall_rank=safe_int(get_val('entrance_overall_rank')),
                        community_rank=safe_int(get_val('entrance_community_rank'))
                    ))"""
c = c.replace(old_upload_prep, "")

old_upload_kwargs = """                    # Entrance exams
                    entrance_exams=entrance_exams,"""
new_upload_kwargs = """                    # Entrance exams
                    entrance_exam_1=safe_str(get_val('entrance_exam_1')),
                    entrance_exam_1_percentile=safe_float(get_val('entrance_exam_1_percentile')),
                    entrance_exam_1_mark=safe_int(get_val('entrance_exam_1_mark')),
                    entrance_exam_2=safe_str(get_val('entrance_exam_2')),
                    entrance_exam_2_percentile=safe_float(get_val('entrance_exam_2_percentile')),
                    entrance_exam_2_mark=safe_int(get_val('entrance_exam_2_mark')),
                    entrance_exam_3=safe_str(get_val('entrance_exam_3')),
                    entrance_exam_3_percentile=safe_float(get_val('entrance_exam_3_percentile')),
                    entrance_exam_3_mark=safe_int(get_val('entrance_exam_3_mark')),"""
c = c.replace(old_upload_kwargs, new_upload_kwargs)

# 7. Fetch logic
old_fetch_entrance = """        # Fetch entrance exams
        cursor.execute(\"\"\"
            SELECT exam_name, physics_marks, chemistry_marks, maths_marks,
                   biology_marks, total_marks, community_rank, overall_rank
            FROM entrance_exams WHERE student_no = %s
        \"\"\", (student_no,))
        
        entrance_rows = cursor.fetchall()
        if entrance_rows:
            entrance_exams = []
            for exam_row in entrance_rows:
                entrance_exams.append({
                    "exam_name": exam_row[0],
                    "physics_marks": exam_row[1],
                    "chemistry_marks": exam_row[2],
                    "maths_marks": exam_row[3],
                    "biology_marks": exam_row[4],
                    "total_marks": exam_row[5],
                    "community_rank": exam_row[6],
                    "overall_rank": exam_row[7]
                })
            student_data["entrance_exams"] = entrance_exams"""
new_fetch_entrance = """        # Fetch entrance exams
        cursor.execute(\"\"\"
            SELECT entrance_exam_1, entrance_exam_1_percentile, entrance_exam_1_mark,
                   entrance_exam_2, entrance_exam_2_percentile, entrance_exam_2_mark,
                   entrance_exam_3, entrance_exam_3_percentile, entrance_exam_3_mark
            FROM entrance_exams WHERE student_no = %s
        \"\"\", (student_no,))
        
        entrance_row = cursor.fetchone()
        if entrance_row:
            student_data.update({
                "entrance_exam_1": entrance_row[0],
                "entrance_exam_1_percentile": float(entrance_row[1]) if entrance_row[1] is not None else None,
                "entrance_exam_1_mark": entrance_row[2],
                "entrance_exam_2": entrance_row[3],
                "entrance_exam_2_percentile": float(entrance_row[4]) if entrance_row[4] is not None else None,
                "entrance_exam_2_mark": entrance_row[5],
                "entrance_exam_3": entrance_row[6],
                "entrance_exam_3_percentile": float(entrance_row[7]) if entrance_row[7] is not None else None,
                "entrance_exam_3_mark": entrance_row[8]
            })"""
c = c.replace(old_fetch_entrance, new_fetch_entrance)

# 8. Update logic UPSERT for entrance_exams
old_upsert_counselling_marker = """        # Update counselling_detail table (UPSERT logic)"""
new_upsert_entrance = """        # Update entrance_exams table (UPSERT logic)
        entrance_fields = {
            'entrance_exam_1': updates.entrance_exam_1,
            'entrance_exam_1_percentile': updates.entrance_exam_1_percentile,
            'entrance_exam_1_mark': updates.entrance_exam_1_mark,
            'entrance_exam_2': updates.entrance_exam_2,
            'entrance_exam_2_percentile': updates.entrance_exam_2_percentile,
            'entrance_exam_2_mark': updates.entrance_exam_2_mark,
            'entrance_exam_3': updates.entrance_exam_3,
            'entrance_exam_3_percentile': updates.entrance_exam_3_percentile,
            'entrance_exam_3_mark': updates.entrance_exam_3_mark
        }
        
        entrance_updates = {k: v for k, v in entrance_fields.items() if v is not None}
        
        if entrance_updates:
            cursor.execute("SELECT student_no FROM entrance_exams WHERE student_no = %s", (student_no,))
            entrance_exists = cursor.fetchone()
            
            if entrance_exists:
                set_clause = ", ".join([f"{k} = %s" for k in entrance_updates.keys()])
                query = f"UPDATE entrance_exams SET {set_clause} WHERE student_no = %s"
                cursor.execute(query, list(entrance_updates.values()) + [student_no])
            else:
                columns = ['student_no'] + list(entrance_updates.keys())
                placeholders = ', '.join(['%s'] * len(columns))
                query = f"INSERT INTO entrance_exams ({', '.join(columns)}) VALUES ({placeholders})"
                cursor.execute(query, [student_no] + list(entrance_updates.values()))
                
        # Update counselling_detail table (UPSERT logic)"""
c = c.replace(old_upsert_counselling_marker, new_upsert_entrance)

# 9. Bulk Edit Maps
old_bulk_map_counselling_marker = """    # counselling_detail table"""
new_bulk_map_entrance = """    # entrance_exams table
    "entrance_exam_1":           ("entrance_exams", "entrance_exam_1", "str"),
    "entrance_exam_1_percentile":("entrance_exams", "entrance_exam_1_percentile", "float"),
    "entrance_exam_1_mark":      ("entrance_exams", "entrance_exam_1_mark", "int"),
    "entrance_exam_2":           ("entrance_exams", "entrance_exam_2", "str"),
    "entrance_exam_2_percentile":("entrance_exams", "entrance_exam_2_percentile", "float"),
    "entrance_exam_2_mark":      ("entrance_exams", "entrance_exam_2_mark", "int"),
    "entrance_exam_3":           ("entrance_exams", "entrance_exam_3", "str"),
    "entrance_exam_3_percentile":("entrance_exams", "entrance_exam_3_percentile", "float"),
    "entrance_exam_3_mark":      ("entrance_exams", "entrance_exam_3_mark", "int"),
    # counselling_detail table"""
c = c.replace(old_bulk_map_counselling_marker, new_bulk_map_entrance)

old_all_edit_cols = """    # 12th marks"""
new_all_edit_cols = """    # entrance exams
    "entrance_exam_1", "entrance_exam_1_percentile", "entrance_exam_1_mark",
    "entrance_exam_2", "entrance_exam_2_percentile", "entrance_exam_2_mark",
    "entrance_exam_3", "entrance_exam_3_percentile", "entrance_exam_3_mark",
    # 12th marks"""
c = c.replace(old_all_edit_cols, new_all_edit_cols)

# 10. Update download_edit_template logic
old_template_fetch_counselling = """            # counselling_detail"""
new_template_fetch_entrance = """            # entrance_exams
            cursor.execute(\"\"\"
                SELECT entrance_exam_1, entrance_exam_1_percentile, entrance_exam_1_mark,
                       entrance_exam_2, entrance_exam_2_percentile, entrance_exam_2_mark,
                       entrance_exam_3, entrance_exam_3_percentile, entrance_exam_3_mark
                FROM entrance_exams WHERE student_no = %s
            \"\"\", (student_no,))
            en = cursor.fetchone()
            if en:
                for i, key in enumerate([
                    "entrance_exam_1", "entrance_exam_1_percentile", "entrance_exam_1_mark",
                    "entrance_exam_2", "entrance_exam_2_percentile", "entrance_exam_2_mark",
                    "entrance_exam_3", "entrance_exam_3_percentile", "entrance_exam_3_mark"
                ]):
                    row[key] = en[i]

            # counselling_detail"""
c = c.replace(old_template_fetch_counselling, new_template_fetch_entrance)

# 11. Type coercion for float
old_type_coercion = """                    elif col_type == "date":"""
new_type_coercion = """                    elif col_type == "float":
                        try:
                            val = float(val)
                        except (ValueError, TypeError):
                            errors.append({"row": row_num, "student_id": sid, "error": f"{excel_col}: expected a decimal number, got '{val}'"})
                            continue
                    elif col_type == "date":"""
c = c.replace(old_type_coercion, new_type_coercion)

# 12. Fix /api/student/template route
old_template_columns = """        "optional_entrance_exam": [
            "entrance_exam_name", "entrance_physics_marks", "entrance_chemistry_marks",
            "entrance_maths_marks", "entrance_biology_marks", "entrance_total_marks",
            "entrance_overall_rank", "entrance_community_rank"
        ],"""
new_template_columns = """        "optional_entrance_exam": [
            "entrance_exam_1", "entrance_exam_1_percentile", "entrance_exam_1_mark",
            "entrance_exam_2", "entrance_exam_2_percentile", "entrance_exam_2_mark",
            "entrance_exam_3", "entrance_exam_3_percentile", "entrance_exam_3_mark"
        ],"""
c = c.replace(old_template_columns, new_template_columns)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)

print('Done')
