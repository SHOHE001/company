import os
import sys
import json
import io
import datetime
from pathlib import Path

# --- Constants ---
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
SECRET_DIR = ROOT_DIR / ".company/secret"
CREDENTIALS_FILE = SECRET_DIR / "credentials.json"
TOKEN_FILE = SECRET_DIR / "token.json"
DEST_DIR = ROOT_DIR / ".company/secretary/inbox/scans"

# Include calendar scope to maintain compatibility with other scripts
SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive'
]

SCAN_FOLDER_NAME = 'Gemini_Journal_Scans'
ARCHIVE_FOLDER_NAME = 'Gemini_Journal_Archive'

def check_dependencies():
    """Check if required Google libraries are installed."""
    try:
        import googleapiclient.discovery
        import google_auth_oauthlib.flow
        import google.auth.transport.requests
        return True
    except ImportError:
        print("Error: Missing required libraries.")
        print("Please install them using the following command:")
        print("  pip install --upgrade google-api-python-client google-auth-httplib2 google-auth-oauthlib")
        return False

def get_service():
    """Authenticates and returns the Drive service."""
    from googleapiclient.discovery import build
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        
        # Check if all scopes are present
        if creds and creds.scopes:
            missing_scopes = set(SCOPES) - set(creds.scopes)
            if missing_scopes:
                print(f"Missing scopes: {missing_scopes}. Re-authentication required.")
                creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Token refresh failed: {e}. Re-authentication required.")
                creds = None
        
        if not creds:
            if not CREDENTIALS_FILE.exists():
                print(f"Error: Credentials file not found at {CREDENTIALS_FILE}.")
                sys.exit(1)
            
            print("--- Authentication Required ---")
            print("A browser window will open for Google Drive authentication.")
            print("Follow the prompts to grant access to Gemini CLI.")
            
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
            
            # Save the credentials
            SECRET_DIR.mkdir(parents=True, exist_ok=True)
            with open(TOKEN_FILE, 'w') as token:
                token.write(creds.to_json())

    return build('drive', 'v3', credentials=creds)

def find_folder(service, folder_name):
    """Finds a folder by name and returns its ID."""
    results = service.files().list(
        q=f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        spaces='drive',
        fields='files(id, name)'
    ).execute()
    items = results.get('files', [])
    return items[0]['id'] if items else None

def create_folder(service, folder_name):
    """Creates a folder and returns its ID."""
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    file = service.files().create(body=file_metadata, fields='id').execute()
    return file.get('id')

def main():
    if not check_dependencies():
        sys.exit(1)

    service = get_service()

    # Find the scan folder
    scan_folder_id = find_folder(service, SCAN_FOLDER_NAME)
    if not scan_folder_id:
        print("日記はありません")
        return

    # Find or create the archive folder
    archive_folder_id = find_folder(service, ARCHIVE_FOLDER_NAME)
    if not archive_folder_id:
        print(f"Creating archive folder: {ARCHIVE_FOLDER_NAME}")
        archive_folder_id = create_folder(service, ARCHIVE_FOLDER_NAME)

    # Search for images in the scan folder
    q = f"'{scan_folder_id}' in parents and (mimeType = 'image/png' or mimeType = 'image/jpeg') and trashed = false"
    results = service.files().list(
        q=q,
        fields='files(id, name, mimeType)'
    ).execute()
    files = results.get('files', [])

    if not files:
        print("日記はありません")
        return

    # Ensure destination directory exists
    DEST_DIR.mkdir(parents=True, exist_ok=True)

    from googleapiclient.http import MediaIoBaseDownload

    for file in files:
        file_id = file['id']
        file_name = file['name']
        print(f"Downloading {file_name}...")

        # Download file content
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
        
        # Save to local destination
        dest_path = DEST_DIR / file_name
        # Handle filename collisions
        if dest_path.exists():
            timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
            dest_path = DEST_DIR / f"{dest_path.stem}_{timestamp}{dest_path.suffix}"
        
        with open(dest_path, "wb") as f:
            f.write(fh.getvalue())

        # Move to archive folder on Drive
        # This involves adding the archive folder as a parent and removing the scan folder
        try:
            service.files().update(
                fileId=file_id,
                addParents=archive_folder_id,
                removeParents=scan_folder_id,
                fields='id, parents'
            ).execute()
            print(f"Successfully archived {file_name} on Drive.")
        except Exception as e:
            print(f"Error archiving {file_name} on Drive: {e}")

    print(f"Synchronized {len(files)} journal(s).")

if __name__ == '__main__':
    main()
