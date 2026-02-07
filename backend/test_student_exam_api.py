"""
Test script for Student Exam Marks API endpoints
Tests fetching daily test and mock test marks for a student
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_get_student_daily_tests(student_id="STU001"):
    """Test fetching daily tests for a student"""
    print("\n" + "="*60)
    print(f"Testing Get Daily Tests for Student: {student_id}")
    print("="*60)
    
    try:
        url = f"{BASE_URL}/api/exam/daily-test/student/{student_id}"
        print(f"\nURL: {url}")
        
        response = requests.get(url)
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Successfully fetched daily tests!")
            print(f"\nTotal Tests: {data.get('total_tests', 0)}")
            
            if data.get('daily_tests'):
                print("\nDaily Tests:")
                for i, test in enumerate(data['daily_tests'][:5], 1):  # Show first 5
                    print(f"\n  Test #{i}:")
                    print(f"    Date: {test.get('test_date', 'N/A')}")
                    print(f"    Subject: {test.get('subject', 'N/A')}")
                    print(f"    Unit: {test.get('unit_name', 'N/A')}")
                    print(f"    Marks: {test.get('total_marks', 'N/A')}")
                
                if len(data['daily_tests']) > 5:
                    print(f"\n  ... and {len(data['daily_tests']) - 5} more tests")
            else:
                print("\n📝 No daily tests found for this student")
        else:
            print(f"\n❌ Failed to fetch daily tests")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to server. Make sure the server is running on port 8000")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


def test_get_student_mock_tests(student_id="STU001"):
    """Test fetching mock tests for a student"""
    print("\n" + "="*60)
    print(f"Testing Get Mock Tests for Student: {student_id}")
    print("="*60)
    
    try:
        url = f"{BASE_URL}/api/exam/mock-test/student/{student_id}"
        print(f"\nURL: {url}")
        
        response = requests.get(url)
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Successfully fetched mock tests!")
            print(f"\nTotal Tests: {data.get('total_tests', 0)}")
            
            if data.get('mock_tests'):
                print("\nMock Tests:")
                for i, test in enumerate(data['mock_tests'][:5], 1):  # Show first 5
                    print(f"\n  Test #{i}:")
                    print(f"    Date: {test.get('test_date', 'N/A')}")
                    print(f"    Maths: {test.get('maths_marks', 'N/A')}")
                    print(f"    Physics: {test.get('physics_marks', 'N/A')}")
                    print(f"    Chemistry: {test.get('chemistry_marks', 'N/A')}")
                    print(f"    Biology: {test.get('biology_marks', 'N/A')}")
                    print(f"    Total: {test.get('total_marks', 'N/A')}")
                    
                    # Show unit names if available
                    if test.get('maths_unit_names'):
                        print(f"    Units - Maths: {', '.join(test['maths_unit_names']) if isinstance(test['maths_unit_names'], list) else test['maths_unit_names']}")
                
                if len(data['mock_tests']) > 5:
                    print(f"\n  ... and {len(data['mock_tests']) - 5} more tests")
            else:
                print("\n📝 No mock tests found for this student")
        else:
            print(f"\n❌ Failed to fetch mock tests")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to server. Make sure the server is running on port 8000")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


def test_health_check():
    """Test the health check endpoint"""
    print("\n" + "="*60)
    print("Testing Health Check Endpoint")
    print("="*60)
    
    try:
        response = requests.get(f"{BASE_URL}/api/exam/health")
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("\n✅ Health check passed!")
        else:
            print(f"\n❌ Health check failed")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to server. Make sure the server is running on port 8000")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("GRAAVITONS SMS - Student Exam Marks API Test Suite")
    print("="*60)
    print("\nMake sure:")
    print("1. The backend server is running (python server.py)")
    print("2. The database has exam marks data")
    print("3. You have students with exam records")
    
    # Get student ID from user
    print("\n" + "="*60)
    student_id = input("\nEnter student ID to test [default: STU001]: ").strip() or "STU001"
    
    # Run tests
    test_health_check()
    test_get_student_daily_tests(student_id)
    test_get_student_mock_tests(student_id)
    
    print("\n" + "="*60)
    print("Test Suite Completed")
    print("="*60)
    print("\nNote: If no data is shown, make sure:")
    print("1. You have added exam marks for this student")
    print("2. The student ID is correct")
    print("3. The database connection is working")
    print("\n")
