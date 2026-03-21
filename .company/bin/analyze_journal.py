import os
import sys
import json
import datetime
import shutil
import glob
from pathlib import Path
import google.generativeai as genai

# --- Configuration ---
ROOT_DIR = Path("C:/Users/zereh/Documents/gemini-company-git")
INBOX_DIR = ROOT_DIR / ".company/secretary/inbox/scans"
ARCHIVE_DIR = ROOT_DIR / "Archive/JournalScans"
USER_PROFILE_PATH = ROOT_DIR / ".company/state/user_profile.json"

def get_api_key():
    # 1. Check environment variable
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        return api_key

    # 2. Check Gemini CLI settings.json
    home = Path.home()
    settings_path = home / ".gemini/settings.json"
    if settings_path.exists():
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                settings = json.load(f)
                # Some versions might store api_key here
                if "api_key" in settings:
                    return settings["api_key"]
                if "apiKey" in settings:
                    return settings["apiKey"]
        except Exception:
            pass
            
    return None

def load_user_profile():
    if USER_PROFILE_PATH.exists():
        with open(USER_PROFILE_PATH, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_user_profile(profile):
    with open(USER_PROFILE_PATH, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)

def analyze_image(image_path):
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    # Prompt for OCR and analysis
    prompt = """
これは手書きの日記です。ユーザーの意図や感情、重要なキーワードを正確に抽出してください。
抽出した内容に基づき、以下の2つの項目を JSON 形式で出力してください。

1. current_focus: ユーザーが現在関心を持っていることや取り組んでいることのリスト（文字列の配列）。
2. learned_traits: ユーザーの新しい特性や価値観、好みの発見。以下の形式で記述してください（オブジェクトの配列）。
   - trait: 発見された特性や知見
   - context: その知見が得られた背景

出力は純粋な JSON 形式（コードブロックなし）で返してください。
例:
{
  "current_focus": ["プログラミングの学習", "健康管理"],
  "learned_traits": [
    {"trait": "朝の運動を好む", "context": "日記に朝のランニングが気持ちよかったと記載があるため"}
  ]
}
"""
    
    try:
        # Load image
        with open(image_path, "rb") as f:
            image_data = f.read()
        
        mime_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
        
        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": image_data}
        ])
        
        # Clean response text in case it includes markdown code blocks
        text = response.text.strip()
        if text.startswith("```"):
            # Remove ```json or ```
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        
        return json.loads(text)
    except Exception as e:
        print(f"Error analyzing image {image_path.name}: {e}")
        return None

def main():
    api_key = get_api_key()
    if not api_key:
        print("Error: Gemini API Key not found. Please set GEMINI_API_KEY environment variable.")
        sys.exit(1)

    genai.configure(api_key=api_key)

    if not INBOX_DIR.exists():
        print(f"Directory not found: {INBOX_DIR}")
        return

    image_files = list(INBOX_DIR.glob("*.png")) + list(INBOX_DIR.glob("*.jpg")) + list(INBOX_DIR.glob("*.jpeg"))
    
    if not image_files:
        print("No image files found in inbox scans.")
        return

    profile = load_user_profile()
    today = datetime.date.today().isoformat()

    # Ensure structure exists
    if "mental_model" not in profile:
        profile["mental_model"] = {}
    if "current_focus" not in profile["mental_model"]:
        profile["mental_model"]["current_focus"] = []
    if "learned_traits" not in profile:
        profile["learned_traits"] = []

    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

    for image_path in image_files:
        print(f"Analyzing {image_path.name}...")
        result = analyze_image(image_path)
        
        if result:
            # Update current_focus (deduplicate)
            new_foci = result.get("current_focus", [])
            if isinstance(new_foci, list):
                for focus in new_foci:
                    if focus not in profile["mental_model"]["current_focus"]:
                        profile["mental_model"]["current_focus"].append(focus)
            
            # Update learned_traits
            new_traits = result.get("learned_traits", [])
            if isinstance(new_traits, list):
                for trait_entry in new_traits:
                    if isinstance(trait_entry, dict):
                        trait_entry["date"] = today
                        profile["learned_traits"].append(trait_entry)
            
            # Move processed image
            dest_path = ARCHIVE_DIR / image_path.name
            if dest_path.exists():
                timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
                dest_path = ARCHIVE_DIR / f"{image_path.stem}_{timestamp}{image_path.suffix}"
            
            try:
                shutil.move(str(image_path), str(dest_path))
                print(f"Successfully processed and moved {image_path.name}")
            except Exception as e:
                print(f"Error moving file {image_path.name}: {e}")

    save_user_profile(profile)
    print("User profile updated successfully.")

if __name__ == "__main__":
    main()
