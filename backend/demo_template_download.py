"""
Demo script to test Excel template download functionality
"""

import requests

BASE_URL = "http://localhost:8000"

def download_daily_test_template(batch_id=1, total_marks=100):
    """Download daily test template"""
    print(f"\n{'='*60}")
    print(f"Downloading Daily Test Template for Batch {batch_id}")
    print(f"{'='*60}")
    
    try:
        url = f"{BASE_URL}/api/exam/template/daily-test/{batch_id}?total_marks={total_marks}"
        print(f"\nURL: {url}")
        
        response = requests.get(url)
        
        if response.status_code == 200:
            # Save the file
            filename = f"daily_test_template_batch_{batch_id}_downloaded.xlsx"
            with open(filename, 'wb') as f:
                f.write(response.content)
            print(f"\n✅ Template downloaded successfully!")
            print(f"📁 Saved as: {filename}")
            print(f"📊 File size: {len(response.content)} bytes")
        else:
            print(f"\n❌ Failed to download template")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to server. Make sure the server is running on port 8000")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


def download_mock_test_template(batch_id=1):
    """Download mock test template"""
    print(f"\n{'='*60}")
    print(f"Downloading Mock Test Template for Batch {batch_id}")
    print(f"{'='*60}")
    
    try:
        url = f"{BASE_URL}/api/exam/template/mock-test/{batch_id}"
        print(f"\nURL: {url}")
        
        response = requests.get(url)
        
        if response.status_code == 200:
            # Save the file
            filename = f"mock_test_template_batch_{batch_id}_downloaded.xlsx"
            with open(filename, 'wb') as f:
                f.write(response.content)
            print(f"\n✅ Template downloaded successfully!")
            print(f"📁 Saved as: {filename}")
            print(f"📊 File size: {len(response.content)} bytes")
        else:
            print(f"\n❌ Failed to download template")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to server. Make sure the server is running on port 8000")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")


def demonstrate_template_usage():
    """Demonstrate how to use the templates"""
    print(f"\n{'='*60}")
    print("Exam Template Usage Demonstration")
    print(f"{'='*60}")
    
    print("\n📋 STEP 1: Download Template")
    print("   - Use the API endpoint or frontend button")
    print("   - Template will contain all students from your batch")
    
    print("\n✏️  STEP 2: Fill in Marks")
    print("   - Open the downloaded Excel file")
    print("   - Fill marks in the appropriate columns")
    print("   - Don't modify student names or admission numbers")
    
    print("\n💾 STEP 3: Save the File")
    print("   - Save as .xlsx format")
    print("   - Keep the original structure")
    
    print("\n📤 STEP 4: Upload to System")
    print("   - Go to Add Exam form")
    print("   - Select 'Excel Upload' mode")
    print("   - Upload your filled template")
    
    print("\n✅ STEP 5: Verify")
    print("   - Check the preview after upload")
    print("   - Submit if everything looks correct")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("GRAAVITONS SMS - Exam Template Download Demo")
    print("="*60)
    
    print("\n⚠️  Prerequisites:")
    print("1. Backend server must be running (python server.py)")
    print("2. Database must have at least one batch with students")
    print("3. Default batch_id is 1 (modify if needed)")
    
    # Show usage demonstration
    demonstrate_template_usage()
    
    # Ask user if they want to download templates
    print("\n" + "="*60)
    choice = input("\nWould you like to download templates now? (yes/no): ").lower()
    
    if choice == 'yes':
        batch_id = input("\nEnter batch ID [default: 1]: ").strip() or "1"
        try:
            batch_id = int(batch_id)
        except ValueError:
            print("Invalid batch ID. Using default: 1")
            batch_id = 1
        
        # Download daily test template
        total_marks = input("Enter total marks for daily test [default: 100]: ").strip() or "100"
        try:
            total_marks = int(total_marks)
        except ValueError:
            print("Invalid total marks. Using default: 100")
            total_marks = 100
            
        download_daily_test_template(batch_id, total_marks)
        
        # Download mock test template
        download_mock_test_template(batch_id)
        
        print("\n" + "="*60)
        print("✅ Download Complete!")
        print("="*60)
        print("\nYou can now:")
        print("1. Open the downloaded files in Excel")
        print("2. Fill in the marks for your students")
        print("3. Upload them through the frontend application")
        
    else:
        print("\nDemo cancelled. You can run this script anytime to download templates.")
    
    print("\n" + "="*60)
