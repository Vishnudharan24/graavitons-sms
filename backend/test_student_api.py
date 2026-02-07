#!/usr/bin/env python3
"""
Test script for Student API
Run this after starting the server to test the student creation endpoint
"""

import requests
import json
from datetime import date

# API URL
BASE_URL = "http://localhost:8000/api/student"

# Sample student data
student_data = {
    "student_id": "S2024001",
    "batch_id": 1,  # Make sure this batch exists in your database
    "student_name": "Rajesh Kumar",
    "dob": "2005-03-15",
    "grade": "12",
    "community": "OC",
    "enrollment_year": 2024,
    "course": "NEET",
    "branch": "Biology",
    "gender": "Male",
    "student_mobile": "9876543210",
    "aadhar_no": "1234-5678-9012",
    "apaar_id": "APAAR001",
    "email": "rajesh@example.com",
    "school_name": "ABC Higher Secondary School",
    
    # Parent info
    "father_name": "Kumar Raj",
    "father_occupation": "Engineer",
    "father_mobile": "9876543220",
    "father_email": "kumar@example.com",
    "mother_name": "Lakshmi Kumar",
    "mother_occupation": "Teacher",
    "mother_mobile": "9876543230",
    "mother_email": "lakshmi@example.com",
    
    # 10th marks
    "tenth_school_name": "ABC School",
    "tenth_year_of_passing": 2022,
    "tenth_board_of_study": "State Board",
    "tenth_english": 85,
    "tenth_tamil": 88,
    "tenth_maths": 92,
    "tenth_science": 90,
    "tenth_social_science": 87,
    "tenth_total_marks": 442,
    
    # 12th marks
    "twelfth_school_name": "ABC Higher Sec",
    "twelfth_year_of_passing": 2024,
    "twelfth_board_of_study": "State Board",
    "twelfth_english": 85,
    "twelfth_physics": 92,
    "twelfth_chemistry": 90,
    "twelfth_biology": 95,
    "twelfth_total_marks": 530,
    
    # Entrance exams
    "entrance_exams": [
        {
            "exam_name": "NEET",
            "physics_marks": 140,
            "chemistry_marks": 135,
            "biology_marks": 145,
            "total_marks": 420,
            "overall_rank": 15000,
            "community_rank": 5000
        }
    ],
    
    # Counselling
    "counselling_forum": "TNEA",
    "counselling_round": 1,
    "counselling_college_alloted": "Govt Medical College",
    "counselling_year_of_completion": 2030
}

def test_create_student():
    """Test creating a student"""
    print("=" * 60)
    print("Testing Student Creation API")
    print("=" * 60)
    
    try:
        print(f"\nSending POST request to: {BASE_URL}")
        print(f"Student ID: {student_data['student_id']}")
        print(f"Student Name: {student_data['student_name']}")
        print(f"Batch ID: {student_data['batch_id']}")
        
        response = requests.post(
            BASE_URL,
            json=student_data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"\nResponse Status Code: {response.status_code}")
        
        if response.status_code == 201:
            result = response.json()
            print("\n✅ SUCCESS!")
            print(f"Message: {result.get('message')}")
            print(f"\nStudent Details:")
            student = result.get('student', {})
            for key, value in student.items():
                print(f"  {key}: {value}")
        else:
            print("\n❌ ERROR!")
            try:
                error = response.json()
                print(f"Error: {error.get('detail', 'Unknown error')}")
            except:
                print(f"Error: {response.text}")
                
    except requests.exceptions.ConnectionError:
        print("\n❌ CONNECTION ERROR!")
        print("Make sure the server is running on http://localhost:8000")
        print("Start the server with: python backend/server.py")
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR!")
        print(f"Error: {str(e)}")

def test_get_template():
    """Test getting template info"""
    print("\n" + "=" * 60)
    print("Testing Template Info API")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/template")
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ Template Info Retrieved!")
            print(f"\nRequired Columns: {', '.join(result['columns']['required'])}")
            print(f"\nTotal Optional Columns: {sum(len(v) for k, v in result['columns'].items() if k != 'required')}")
        else:
            print(f"\n❌ Error: {response.status_code}")
            
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")

if __name__ == "__main__":
    print("\n🚀 Starting Student API Tests\n")
    
    # Test 1: Get template info
    test_get_template()
    
    # Test 2: Create student
    print("\n")
    confirmation = input("Do you want to test student creation? (yes/no): ")
    if confirmation.lower() == 'yes':
        test_create_student()
    
    print("\n" + "=" * 60)
    print("Tests Completed!")
    print("=" * 60)
