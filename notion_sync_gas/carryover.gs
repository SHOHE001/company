/**
 * Notion Task Carry-over System
 * 
 * 役割: 前日の未完了タスク（未着手・進行中）を、ステータスを維持したまま当日にコピーする。
 * トリガー設定: 毎日午前 4時〜5時 頃の実行を推奨。
 */

const NOTION_API_URL = "https://api.notion.com/v1";
const API_VERSION = "2022-06-28";

/**
 * 毎日実行されるメイン関数
 */
function runDailyCarryOver() {
  const props = PropertiesService.getScriptProperties();
  const NOTION_TOKEN = props.getProperty("NOTION_TOKEN");
  const TASK_DB_ID = props.getProperty("TASK_DB_ID");

  if (!NOTION_TOKEN || !TASK_DB_ID) {
    console.error("Properties 'NOTION_TOKEN' or 'TASK_DB_ID' not found.");
    return;
  }

  const yesterday = getFormattedDate(-1);
  const today = getFormattedDate(0);

  console.log(`Checking for incomplete tasks on: ${yesterday} to carry over to ${today}`);

  const incompleteTasks = getIncompleteTasks(NOTION_TOKEN, TASK_DB_ID, yesterday);
  console.log(`Found ${incompleteTasks.length} incomplete tasks.`);

  const currentTodayTasks = getAllTasksOnDate(NOTION_TOKEN, TASK_DB_ID, today);
  const existingNames = new Set(currentTodayTasks.map(t => getTaskTitle(t)));

  let carryCount = 0;
  incompleteTasks.forEach(task => {
    const taskTitle = getTaskTitle(task);
    
    // すでに今日分として存在する場合はスキップ
    if (existingNames.has(taskTitle)) {
      console.log(`Skipping duplicate: ${taskTitle}`);
      return;
    }

    const status = task.properties['ステータス'].status.name;
    const category = task.properties['テキスト'] ? task.properties['テキスト'].rich_text : [];

    const success = createNewTask(NOTION_TOKEN, TASK_DB_ID, today, taskTitle, status, category);
    if (success) carryCount++;
  });

  console.log(`Carry-over complete. ${carryCount} tasks moved.`);
}

/**
 * 指定した日の未完了タスク（ステータス != "完了"）を取得
 */
function getIncompleteTasks(token, dbId, dateStr) {
  const url = `${NOTION_API_URL}/databases/${dbId}/query`;
  const payload = {
    filter: {
      and: [
        { property: "日付", date: { equals: dateStr } },
        { property: "ステータス", status: { does_not_equal: "完了" } }
      ]
    }
  };

  const options = {
    method: "post",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": API_VERSION,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return data.results || [];
}

/**
 * 指定した日の全タスクを取得（重複チェック用）
 */
function getAllTasksOnDate(token, dbId, dateStr) {
  const url = `${NOTION_API_URL}/databases/${dbId}/query`;
  const payload = {
    filter: { property: "日付", date: { equals: dateStr } }
  };

  const options = {
    method: "post",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": API_VERSION,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return data.results || [];
}

/**
 * 新しいタスクを作成
 */
function createNewTask(token, dbId, dateStr, title, status, category) {
  const url = `${NOTION_API_URL}/pages`;
  const payload = {
    parent: { database_id: dbId },
    properties: {
      "名前": { title: [{ text: { content: title } }] },
      "ステータス": { status: { name: status } },
      "日付": { date: { start: dateStr } },
      "テキスト": { rich_text: category }
    }
  };

  const options = {
    method: "post",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": API_VERSION,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 200) {
    console.log(`Created: ${title} (${status})`);
    return true;
  } else {
    console.error(`Failed to create ${title}: ${response.getContentText()}`);
    return false;
  }
}

/**
 * タスクのタイトルを取得するヘルパー
 */
function getTaskTitle(task) {
  const titleProps = task.properties['名前'].title;
  return titleProps.length > 0 ? titleProps[0].plain_text : "Untitled";
}

/**
 * YYYY-MM-DD 形式で日付を取得 (offset: 0=今日, -1=昨日)
 */
function getFormattedDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const year = d.getFullYear();
  const month = ("0" + (d.getMonth() + 1)).slice(-2);
  const date = ("0" + d.getDate()).slice(-2);
  return `${year}-${month}-${date}`;
}
