import json
import os
import requests
import sys
import time
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set, Tuple
from requests.exceptions import RequestException, Timeout, ConnectionError, HTTPError
from logger_util import setup_logger
from sync_calendar import add_calendar_event, get_calendar_events

# --- Constants & Configuration ---
NOTION_API_VERSION = "2022-06-28"
RATE_LIMIT_DELAY = 0.34  # Seconds between requests
MAX_RETRIES = 3
TIMEOUT = 30
logger = setup_logger("SyncNotion")

# Mandate 6: Path Configuration
PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "../.."))
SYNC_LOG_PATH = os.path.join(PROJECT_ROOT, ".company/state/sync_error.log")

def _write_local_error_log(severity: str, category: str, message: str, detail: str = "") -> None:
    """Mandate 6: High-resolution persistent logging."""
    try:
        os.makedirs(os.path.dirname(SYNC_LOG_PATH), exist_ok=True)
        with open(SYNC_LOG_PATH, "a", encoding="utf-8") as f:
            ts = datetime.now().isoformat()
            f.write(f"[{ts}] [{severity}] [{category}] {message} | {detail}\n")
    except Exception as e:
        logger.error(f"Failed to write to sync_error.log: {e}")

def extract_date(text: str) -> Optional[str]:
    """Extract date from text (formats: YYYY-MM-DD, MM/DD, etc.)"""
    # Specifically look for dates following @ or inside brackets/parentheses
    match = re.search(r'(?:@|\[|\()\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*(?:\]|\))?', text)
    if not match: return None
    
    raw_date = match.group(1).replace('/', '-')
    if len(raw_date) <= 5: # MM-DD format
        raw_date = f"{datetime.now().year}-{raw_date}"
    
    try:
        dt = datetime.strptime(raw_date, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None

def clean_task_name(text: str) -> str:
    """Remove date patterns and priority markers for a clean title."""
    # Remove explicit date markers
    text = re.sub(r'(?:@|\[|\()\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*(?:\]|\))?', '', text)
    # Remove priority markers like (優先度：高)
    text = re.sub(r'\(優先度：.*?\)', '', text)
    # Remove any trailing/leading symbols left over
    return text.strip(' \t-:')

class NotionSync:
    """High-performance bulk-fetching Notion sync engine with integrated Calendar support."""

    def __init__(self, config_path: str) -> None:
        self.config = self._load_config(config_path)
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.config.get('NOTION_TOKEN', '')}",
            "Content-Type": "application/json",
            "Notion-Version": NOTION_API_VERSION
        })
        self._task_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._calendar_cache: Dict[str, List[Dict[str, Any]]] = {}

    def _load_config(self, path: str) -> Dict[str, Any]:
        if not os.path.exists(path):
            _write_local_error_log("CRITICAL", "CONFIG", f"Missing: {path}")
            logger.critical(f"Configuration file missing at {path}")
            sys.exit(1)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            _write_local_error_log("CRITICAL", "CONFIG", f"Invalid JSON in {path}: {e}")
            logger.critical(f"Configuration file {path} contains invalid JSON.")
            sys.exit(1)

    def _request(self, method: str, url: str, **kwargs) -> Optional[requests.Response]:
        """Unified request wrapper with exponential backoff and rate-limit handling."""
        for attempt in range(MAX_RETRIES):
            time.sleep(RATE_LIMIT_DELAY * (2 ** attempt)) # Exponential backoff for rate limits
            try:
                res = self.session.request(method, url, timeout=TIMEOUT, **kwargs)
                
                if res.status_code == 429:
                    logger.warning(f"Rate limit hit (429). Retrying {attempt + 1}/{MAX_RETRIES}...")
                    time.sleep(5)
                    continue
                
                if res.status_code >= 500:
                    logger.warning(f"Server error {res.status_code}. Retrying {attempt + 1}/{MAX_RETRIES}...")
                    continue
                
                res.raise_for_status()
                return res
                
            except (Timeout, ConnectionError) as e:
                logger.warning(f"Network error on attempt {attempt + 1}: {type(e).__name__}")
                if attempt == MAX_RETRIES - 1:
                    _write_local_error_log("HIGH", "NETWORK", f"{type(e).__name__}: {url}")
            except HTTPError as e:
                msg = f"STATUS_{res.status_code}: {url}"
                _write_local_error_log("MEDIUM", "HTTP", msg, detail=res.text[:500])
                logger.error(f"HTTPError: {msg} - {res.text[:200]}")
                break # Do not retry 4xx errors (except 429 handled above)
            except RequestException as e:
                _write_local_error_log("MEDIUM", "UNKNOWN", str(e))
                logger.error(f"RequestException: {e}")
                break
                
        return None

    def query_tasks(self, date_str: str = None, filter_done: bool = True, use_cache: bool = False) -> List[Dict[str, Any]]:
        """Paginated query with optional caching."""
        cache_key = f"{date_str}_{filter_done}"
        if use_cache and cache_key in self._task_cache:
            return self._task_cache[cache_key]

        if 'TASK_DB_ID' not in self.config:
            logger.error("TASK_DB_ID not found in config.")
            return []

        url = f"https://api.notion.com/v1/databases/{self.config['TASK_DB_ID']}/query"
        filter_conditions = []
        if date_str:
            filter_conditions.append({"property": "日付", "date": {"equals": date_str}})
        if filter_done:
            filter_conditions.append({"property": "ステータス", "status": {"does_not_equal": "完了"}})
        
        all_results = []
        start_cursor = None
        while True:
            payload = {"filter": {"and": filter_conditions} if filter_conditions else {}}
            if start_cursor:
                payload["start_cursor"] = start_cursor
            
            res = self._request("POST", url, json=payload)
            if not res: 
                break
            
            try:
                data = res.json()
                all_results.extend(data.get('results', []))
                if not data.get('has_more'): 
                    break
                start_cursor = data.get('next_cursor')
            except json.JSONDecodeError:
                logger.error("Failed to decode JSON from Notion API response.")
                break
        
        if use_cache:
            self._task_cache[cache_key] = all_results
        return all_results

    def _get_calendar_events_cached(self, date_str: str) -> List[Dict[str, Any]]:
        """Cached calendar fetch to avoid redundant API calls."""
        if date_str in self._calendar_cache:
            return self._calendar_cache[date_str]
        
        res = get_calendar_events(date_str=date_str)
        events = res.get("events", []) if res and res.get("status") == "success" else []
        self._calendar_cache[date_str] = events
        return events

    def add_task(self, name: str, status: str = "未着手", due_date: str = None, category: str = "General", use_cache: bool = False) -> bool:
        """Add or update task and sync with Google Calendar. Returns True if successful."""
        date_str = due_date if due_date else datetime.now().strftime("%Y-%m-%d")
        results = self.query_tasks(date_str=date_str, filter_done=False, use_cache=use_cache)
        
        # 1. Notion Sync
        existing = None
        for p in results:
            title_props = p.get('properties', {}).get('名前', {}).get('title', [])
            if title_props and title_props[0].get('plain_text') == name:
                existing = p
                break
        
        success = False
        if existing:
            current_status = existing.get('properties', {}).get('ステータス', {}).get('status', {}).get('name')
            if current_status != status:
                url = f"https://api.notion.com/v1/pages/{existing['id']}"
                res = self._request("PATCH", url, json={"properties": {"ステータス": {"status": {"name": status}}}})
                success = res is not None
            else:
                success = True # Already in desired state
        else:
            payload = {
                "parent": {"database_id": self.config['TASK_DB_ID']},
                "properties": {
                    "名前": {"title": [{"text": {"content": name}}]},
                    "ステータス": {"status": {"name": status}},
                    "日付": {"date": {"start": date_str}},
                    "テキスト": {"rich_text": [{"text": {"content": category}}]}
                }
            }
            res = self._request("POST", "https://api.notion.com/v1/pages", json=payload)
            success = res is not None

        # 2. Calendar Sync
        if success and due_date and status != "完了":
            events = self._get_calendar_events_cached(due_date)
            exists_in_cal = any(e['summary'] == name and e['start'].startswith(due_date) for e in events)
            
            if not exists_in_cal:
                logger.info(f"Syncing to Calendar: {name} ({due_date})")
                start_dt = f"{due_date}T09:00:00"
                end_dt = f"{due_date}T10:00:00"
                add_calendar_event(name, start_dt, end_dt, description=f"Source: {category} (Notion Task)")
                # Invalidate cache since we added an event
                if due_date in self._calendar_cache:
                    del self._calendar_cache[due_date]

        return success

    def sync_from_active_md(self, file_path: str, category: str = "General") -> None:
        """Parse MD and sync tasks with optimized caching."""
        if not os.path.exists(file_path): 
            logger.warning(f"File not found: {file_path}")
            return
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            logger.error(f"Failed to read {file_path}: {e}")
            return
        
        today = datetime.now().strftime("%Y-%m-%d")
        self.query_tasks(date_str=today, filter_done=False, use_cache=True)

        current_category = category
        for line in lines:
            line = line.strip()
            if not (line.startswith("- [ ]") or line.startswith("- [x]")):
                if line.startswith("##"):
                    current_category = f"{category}: {line.replace('#', '').strip()}"
                continue

            status = "完了" if "[x]" in line else "未着手"
            raw_name = line[5:].strip()
            if not raw_name: continue
            
            due_date = extract_date(raw_name)
            clean_name = clean_task_name(raw_name)
            
            if clean_name:
                self.add_task(clean_name, status=status, due_date=due_date, category=current_category, use_cache=True)

    def sync_all_departments(self) -> None:
        """Scan all department directories for todo.md files."""
        ignore_dirs = {"bin", "state", "secret", "node_modules", "logs", "skills", "Archive", "MorningNotes", "gemini-app", ".git", ".idx", ".obsidian", ".company"}
        
        logger.info("Starting sync_all_departments")
        company_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
        
        if not os.path.exists(company_dir):
            logger.error(f"Company directory does not exist: {company_dir}")
            return
            
        for item in os.listdir(company_dir):
            full_path = os.path.join(company_dir, item)
            if os.path.isdir(full_path) and not item.startswith(".") and item not in ignore_dirs:
                todo_path = os.path.join(full_path, "todo.md")
                if os.path.exists(todo_path):
                    logger.info(f"Scanning {item}/todo.md")
                    self.sync_from_active_md(todo_path, category=item.capitalize())

    def carry_over_tasks(self, from_date: str, to_date: str) -> None:
        """Optimized historical task carry-over maintaining original status."""
        logger.info(f"Carrying over tasks from {from_date} to {to_date}")
        # Fetch tasks that are NOT '完了'
        source_tasks = self.query_tasks(date_str=from_date, filter_done=True)
        if not source_tasks:
            logger.info(f"No incomplete tasks found on {from_date} to carry over.")
            return

        self.query_tasks(date_str=to_date, filter_done=False, use_cache=True)
        target_tasks = self.query_tasks(date_str=to_date, filter_done=False, use_cache=True)
        
        already_carried_urls = {
            t.get('properties', {}).get('carryover_from', {}).get('rich_text', [{}])[0].get('text', {}).get('content')
            for t in target_tasks if t.get('properties', {}).get('carryover_from', {}).get('rich_text')
        }

        count = 0
        for task in source_tasks:
            task_url = task.get('url')
            if task_url in already_carried_urls: 
                continue
            
            props = task.get('properties', {})
            # Get original status name
            original_status = props.get('ステータス', {}).get('status', {}).get('name', '未着手')
            
            logger.info(f"Carrying over task: {props.get('名前', {}).get('title', [{}])[0].get('plain_text', 'Unknown')} with status: {original_status}")
            
            payload = {
                "parent": {"database_id": self.config.get('TASK_DB_ID')},
                "properties": {
                    "名前": {"title": props.get('名前', {}).get('title', [])},
                    "ステータス": {"status": {"name": original_status}},
                    "日付": {"date": {"start": to_date}},
                    "テキスト": {"rich_text": props.get('テキスト', {}).get('rich_text', [])},
                    "AIメモ": {"rich_text": props.get('AIメモ', {}).get('rich_text', [])},
                    "carryover_from": {"rich_text": [{"text": {"content": task_url}}]}
                }
            }
            if self._request("POST", "https://api.notion.com/v1/pages", json=payload):
                count += 1
        logger.info(f"Carry-over complete: {count} tasks moved with status preserved.")

if __name__ == "__main__":
    config_file = os.path.normpath(os.path.join(os.path.dirname(__file__), "../secret/notion.json"))
    syncer = NotionSync(config_file)
    
    if len(sys.argv) == 1 or "--all" in sys.argv:
        syncer.sync_all_departments()
    elif "--add" in sys.argv:
        try:
            name_arg = sys.argv[sys.argv.index("--add") + 1]
            date_arg = sys.argv[sys.argv.index("--add") + 2] if len(sys.argv) > sys.argv.index("--add") + 2 else None
            cat_arg = sys.argv[sys.argv.index("--add") + 3] if len(sys.argv) > sys.argv.index("--add") + 3 else "General"
            syncer.add_task(name_arg, due_date=date_arg, category=cat_arg)
            print(f"Task added: {name_arg} in {cat_arg}")
        except IndexError:
            print("Usage: --add <name> [date] [category]")
    elif "--carryover" in sys.argv:
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        today_date = datetime.now().strftime("%Y-%m-%d")
        syncer.carry_over_tasks(yesterday, today_date)
