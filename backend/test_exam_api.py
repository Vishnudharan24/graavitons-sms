"""
Test script for Exam API endpoints
Tests both daily test and mock test creation
"""

import requests
import json
from datetime import date

BASE_URL = "http://localhost:8000"

def test_daily_test():
    """Test creating a daily test"""
    print("\n" + "="*60)
    print("Testing Daily Test Creation")
    print("="*60)
    
    # Sample data for daily test
    data = {
        "batch_id": 1,  # Adjust based on your batch
        "examName": "Physics Daily Test 1",
        "examDate": "2026-02-10",
        "subject": "Physics",
        "unitName": "Unit 1 - Mechanics",
        "totalMarks": 100,
        "examType": "daily test",
        "studentMarks": [
            {"id": "STU001", "marks": "85"},
            {"id": "STU002", "marks": "92"},
            {"id": "STU003", "marks": "78"}
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/exam/daily-test",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 201:
            print("\n✅ Daily test created successfully!")
        else:
            print(f"\n❌ Failed to create daily test")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to server. Make sure the server is running on port 8000")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


def test_mock_test():
    """Test creating a mock test"""
    print("\n" + "="*60)
    print("Testing Mock Test Creation")
    print("="*60)
    
    # Sample data for mock test
    data = {
        "batch_id": 1,  # Adjust based on your batch
        "examName": "NEET Mock Test 1",
        "examDate": "2026-02-15",
        "examType": "mock test",
        "mathsUnitNames": "Unit 1, Unit 2, Unit 3",
        "physicsUnitNames": "Unit 1, Unit 2",
        "chemistryUnitNames": "Unit 1, Unit 2, Unit 3",
        "biologyUnitNames": "Unit 1, Unit 2",
        "studentMarks": [
            {
                "id": "STU001",
                "mathsMarks": "85",
                "physicsMarks": "90",
                "chemistryMarks": "88",
                "biologyMarks": "92"
            },
            {
                "id": "STU002",
                "mathsMarks": "78",
                "physicsMarks": "82",
                "chemistryMarks": "85",
                "biologyMarks": "80"
            },
            {
                "id": "STU003",
                "mathsMarks": "92",
                "physicsMarks": "88",
                "chemistryMarks": "90",
                "biologyMarks": "87"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/exam/mock-test",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 201:
            print("\n✅ Mock test created successfully!")
        else:
            print(f"\n❌ Failed to create mock test")
            
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
    print("GRAAVITONS SMS - Exam API Test Suite")
    print("="*60)
    print("\nMake sure:")
    print("1. The backend server is running (python server.py)")
    print("2. The database is set up with tables")
    print("3. You have at least one batch and students in the database")
    print("\nPress Enter to continue or Ctrl+C to cancel...")
    input()
    
    # Run tests
    test_health_check()
    test_daily_test()
    test_mock_test()
    
    print("\n" + "="*60)
    print("Test Suite Completed")
    print("="*60)
