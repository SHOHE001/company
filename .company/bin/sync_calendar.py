import os
import sys
import json
import datetime
from pathlib import Path

# --- Constants ---
SECRET_DIR = Path(".company/secret")
CREDENTIALS_FILE = SECRET_DIR / "credentials.json"
TOKEN_FILE = SECRET_DIR / "token.json"
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

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

def get_calendar_events():
    """Fetches all future Google Calendar events."""
    from googleapiclient.discovery import build
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_FILE.exists():
                return {
                    "status": "error",
                    "message": f"Credentials file not found at {CREDENTIALS_FILE}. Please download it from Google Cloud Console."
                }
            
            print("--- Authentication Required ---")
            print("A browser window will open for Google Calendar authentication.")
            print("Follow the prompts to grant access to Gemini CLI.")
            
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Save the credentials for the next run
        SECRET_DIR.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    try:
        service = build('calendar', 'v3', credentials=creds)

        # Call the Calendar API
        now = datetime.datetime.utcnow().isoformat() + 'Z'  # 'Z' indicates UTC time
        
        # timeMax を削除して全期間（未来）の予定を取得
        events_result = service.events().list(calendarId='primary', timeMin=now,
                                              singleEvents=True,
                                              orderBy='startTime').execute()
        events = events_result.get('items', [])

        output_events = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            output_events.append({
                "summary": event.get('summary', '(No Title)'),
                "start": start,
                "end": end,
                "location": event.get('location', 'N/A'),
                "description": event.get('description', '')
            })

        return {
            "status": "success",
            "query_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "events": output_events
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == '__main__':
    if not check_dependencies():
        sys.exit(1)
    
    result = get_calendar_events()
    print(json.dumps(result, indent=2, ensure_ascii=False))
