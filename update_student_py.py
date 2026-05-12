import re

p = r'v:\odyssey\sms\GRAAVITONS\backend\api\student.py'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('updates.branch', 'updates.board')
c = c.replace("'branch'", "'board'")
c = c.replace('"branch"', '"board"')

old_counselling_insert = """        # 6. Insert counselling details (if provided)
        if student_data.counselling_forum or student_data.counselling_college_alloted:
            cursor.execute(\"\"\"
                INSERT INTO counselling_detail (
                    student_no, forum, round, college_alloted, year_of_completion
                ) VALUES (%s, %s, %s, %s, %s);
            \"\"\", (
                student_no, student_data.counselling_forum,
                student_data.counselling_round, student_data.counselling_college_alloted,
                student_data.counselling_year_of_completion
            ))"""
new_counselling_insert = """        # 6. Insert counselling details (if provided)
        if (student_data.counselling_forum_1 or student_data.counselling_college_1 or
            student_data.counselling_forum_2 or student_data.counselling_college_2 or
            student_data.counselling_forum_3 or student_data.counselling_college_3):
            cursor.execute(\"\"\"
                INSERT INTO counselling_detail (
                    student_no, 
                    counselling_forum_1, counselling_round_1, all_india_rank_1, community_rank_1, counselling_college_1,
                    counselling_forum_2, counselling_round_2, all_india_rank_2, community_rank_2, counselling_college_2,
                    counselling_forum_3, counselling_round_3, all_india_rank_3, community_rank_3, counselling_college_3
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            \"\"\", (
                student_no, 
                student_data.counselling_forum_1, student_data.counselling_round_1, student_data.all_india_rank_1, student_data.community_rank_1, student_data.counselling_college_1,
                student_data.counselling_forum_2, student_data.counselling_round_2, student_data.all_india_rank_2, student_data.community_rank_2, student_data.counselling_college_2,
                student_data.counselling_forum_3, student_data.counselling_round_3, student_data.all_india_rank_3, student_data.community_rank_3, student_data.counselling_college_3
            ))"""
c = c.replace(old_counselling_insert, new_counselling_insert)

old_counselling_excel = """                    # Counselling
                    counselling_forum=safe_str(get_val('counselling_forum')),
                    counselling_round=safe_int(get_val('counselling_round')),
                    counselling_college_alloted=safe_str(get_val('counselling_college_alloted')),
                    counselling_year_of_completion=safe_int(get_val('counselling_year_of_completion'))"""
new_counselling_excel = """                    # Counselling
                    counselling_forum_1=safe_str(get_val('counselling_forum_1')),
                    counselling_round_1=safe_int(get_val('counselling_round_1')),
                    all_india_rank_1=safe_int(get_val('all_india_rank_1')),
                    community_rank_1=safe_int(get_val('community_rank_1')),
                    counselling_college_1=safe_str(get_val('counselling_college_1')),
                    counselling_forum_2=safe_str(get_val('counselling_forum_2')),
                    counselling_round_2=safe_int(get_val('counselling_round_2')),
                    all_india_rank_2=safe_int(get_val('all_india_rank_2')),
                    community_rank_2=safe_int(get_val('community_rank_2')),
                    counselling_college_2=safe_str(get_val('counselling_college_2')),
                    counselling_forum_3=safe_str(get_val('counselling_forum_3')),
                    counselling_round_3=safe_int(get_val('counselling_round_3')),
                    all_india_rank_3=safe_int(get_val('all_india_rank_3')),
                    community_rank_3=safe_int(get_val('community_rank_3')),
                    counselling_college_3=safe_str(get_val('counselling_college_3'))"""
c = c.replace(old_counselling_excel, new_counselling_excel)

old_counselling_fetch = """        # Fetch counselling details
        cursor.execute(\"\"\"
            SELECT forum, round, college_alloted, year_of_completion
            FROM counselling_detail WHERE student_no = %s
        \"\"\", (student_no,))
        
        counselling_row = cursor.fetchone()
        if counselling_row:
            student_data.update({
                "counselling_forum": counselling_row[0],
                "counselling_round": counselling_row[1],
                "counselling_college_alloted": counselling_row[2],
                "counselling_year_of_completion": counselling_row[3]
            })"""
new_counselling_fetch = """        # Fetch counselling details
        cursor.execute(\"\"\"
            SELECT counselling_forum_1, counselling_round_1, all_india_rank_1, community_rank_1, counselling_college_1,
                   counselling_forum_2, counselling_round_2, all_india_rank_2, community_rank_2, counselling_college_2,
                   counselling_forum_3, counselling_round_3, all_india_rank_3, community_rank_3, counselling_college_3
            FROM counselling_detail WHERE student_no = %s
        \"\"\", (student_no,))
        
        counselling_row = cursor.fetchone()
        if counselling_row:
            student_data.update({
                "counselling_forum_1": counselling_row[0],
                "counselling_round_1": counselling_row[1],
                "all_india_rank_1": counselling_row[2],
                "community_rank_1": counselling_row[3],
                "counselling_college_1": counselling_row[4],
                "counselling_forum_2": counselling_row[5],
                "counselling_round_2": counselling_row[6],
                "all_india_rank_2": counselling_row[7],
                "community_rank_2": counselling_row[8],
                "counselling_college_2": counselling_row[9],
                "counselling_forum_3": counselling_row[10],
                "counselling_round_3": counselling_row[11],
                "all_india_rank_3": counselling_row[12],
                "community_rank_3": counselling_row[13],
                "counselling_college_3": counselling_row[14]
            })"""
c = c.replace(old_counselling_fetch, new_counselling_fetch)

old_counselling_update = """    # Counselling details
    counselling_forum: Optional[str] = None
    counselling_round: Optional[int] = None
    counselling_college_alloted: Optional[str] = None
    counselling_year_of_completion: Optional[int] = None"""
new_counselling_update = """    # Counselling details
    counselling_forum_1: Optional[str] = None
    counselling_round_1: Optional[int] = None
    all_india_rank_1: Optional[int] = None
    community_rank_1: Optional[int] = None
    counselling_college_1: Optional[str] = None
    counselling_forum_2: Optional[str] = None
    counselling_round_2: Optional[int] = None
    all_india_rank_2: Optional[int] = None
    community_rank_2: Optional[int] = None
    counselling_college_2: Optional[str] = None
    counselling_forum_3: Optional[str] = None
    counselling_round_3: Optional[int] = None
    all_india_rank_3: Optional[int] = None
    community_rank_3: Optional[int] = None
    counselling_college_3: Optional[str] = None"""
c = c.replace(old_counselling_update, new_counselling_update)

old_counselling_map = """    # counselling_detail table
    "counselling_forum":           ("counselling_detail", "forum", "str"),
    "counselling_round":           ("counselling_detail", "round", "int"),
    "counselling_college_alloted": ("counselling_detail", "college_alloted", "str"),
    "counselling_year_of_completion":("counselling_detail", "year_of_completion", "int"),"""
new_counselling_map = """    # counselling_detail table
    "counselling_forum_1":           ("counselling_detail", "counselling_forum_1", "str"),
    "counselling_round_1":           ("counselling_detail", "counselling_round_1", "int"),
    "all_india_rank_1":              ("counselling_detail", "all_india_rank_1", "int"),
    "community_rank_1":              ("counselling_detail", "community_rank_1", "int"),
    "counselling_college_1":         ("counselling_detail", "counselling_college_1", "str"),
    "counselling_forum_2":           ("counselling_detail", "counselling_forum_2", "str"),
    "counselling_round_2":           ("counselling_detail", "counselling_round_2", "int"),
    "all_india_rank_2":              ("counselling_detail", "all_india_rank_2", "int"),
    "community_rank_2":              ("counselling_detail", "community_rank_2", "int"),
    "counselling_college_2":         ("counselling_detail", "counselling_college_2", "str"),
    "counselling_forum_3":           ("counselling_detail", "counselling_forum_3", "str"),
    "counselling_round_3":           ("counselling_detail", "counselling_round_3", "int"),
    "all_india_rank_3":              ("counselling_detail", "all_india_rank_3", "int"),
    "community_rank_3":              ("counselling_detail", "community_rank_3", "int"),
    "counselling_college_3":         ("counselling_detail", "counselling_college_3", "str"),"""
c = c.replace(old_counselling_map, new_counselling_map)

old_edit_cols = """    # counselling
    "counselling_forum", "counselling_round", "counselling_college_alloted",
    "counselling_year_of_completion","""
new_edit_cols = """    # counselling
    "counselling_forum_1", "counselling_round_1", "all_india_rank_1", "community_rank_1", "counselling_college_1",
    "counselling_forum_2", "counselling_round_2", "all_india_rank_2", "community_rank_2", "counselling_college_2",
    "counselling_forum_3", "counselling_round_3", "all_india_rank_3", "community_rank_3", "counselling_college_3","""
c = c.replace(old_edit_cols, new_edit_cols)

old_edit_fetch = """            # counselling_detail
            cursor.execute(\"\"\"
                SELECT forum, round, college_alloted, year_of_completion
                FROM counselling_detail WHERE student_no = %s
            \"\"\", (student_no,))
            co = cursor.fetchone()
            if co:
                for i, key in enumerate([
                    "counselling_forum", "counselling_round",
                    "counselling_college_alloted", "counselling_year_of_completion"
                ]):
                    row[key] = co[i]"""
new_edit_fetch = """            # counselling_detail
            cursor.execute(\"\"\"
                SELECT counselling_forum_1, counselling_round_1, all_india_rank_1, community_rank_1, counselling_college_1,
                       counselling_forum_2, counselling_round_2, all_india_rank_2, community_rank_2, counselling_college_2,
                       counselling_forum_3, counselling_round_3, all_india_rank_3, community_rank_3, counselling_college_3
                FROM counselling_detail WHERE student_no = %s
            \"\"\", (student_no,))
            co = cursor.fetchone()
            if co:
                for i, key in enumerate([
                    "counselling_forum_1", "counselling_round_1", "all_india_rank_1", "community_rank_1", "counselling_college_1",
                    "counselling_forum_2", "counselling_round_2", "all_india_rank_2", "community_rank_2", "counselling_college_2",
                    "counselling_forum_3", "counselling_round_3", "all_india_rank_3", "community_rank_3", "counselling_college_3"
                ]):
                    row[key] = co[i]"""
c = c.replace(old_edit_fetch, new_edit_fetch)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)

print('Done updating student.py')
