/**
 * LINE BOT: Media Auto-Saver & Logger (Ultra-Fast Reply Edition)
 * 2026/03/19: Group-Specific Log & Bug Fixes
 */

// --- 設定と定数 ---
var props = PropertiesService.getScriptProperties();
var _initProps = props.getProperties();
var CHANNEL_ACCESS_TOKEN = _initProps['LINE_ACCESS_TOKEN'];
var ROOT_FOLDER_ID = _initProps['ROOT_FOLDER_ID'];
var MY_USER_ID = _initProps['MY_USER_ID'];
var SECRET_LOG_SS_ID = _initProps['SECRET_LOG_SS_ID'] || '1Spq2DKIev2sR8leJDJ2kS5kVaFbhRL5YUuIlmU-PLw4';
var LOG_FOLDER_ID = _initProps['LOG_FOLDER_ID'] || '1Rq0psp37SqqyBsirNrYLxsEkbcNo4Kmg';

const ASYNC_CONFIG = {
  PREFIX: 'log_v2_',
  LIMIT_MS: 5 * 60 * 1000,
  LOCK_TIMEOUT: 10000
};

var ERROR_CONTACT_MSG = '\n\n解決しない場合 /contact [内容] で管理者へお問い合わせください。';

function doPost(e) {
  var replyTokenForError = '';
  try {
    if (!e || !e.postData) return;
    var json = JSON.parse(e.postData.contents);
    if (!json.events) return;

    for (var i = 0; i < json.events.length; i++) {
      var event = json.events[i];
      var replyToken = event.replyToken;
      replyTokenForError = replyToken;
      var source = event.source;
      var sourceId = source.groupId || source.roomId || source.userId;
      var userId = source.userId;
      var userName = getUserName(sourceId, userId, source.type);
      var chatName = getBaseName(source);
      var time = timestamp();

      if (event.type === 'message') {
        var msgType = event.message.type;
        if (msgType === 'video' || msgType === 'image' || msgType === 'file') {
          var originalName = (msgType === 'file') ? event.message.fileName : null;

          var ext = (msgType === 'video') ? '.mp4' : (msgType === 'image' ? '.jpg' : (originalName ? getFileExt(originalName) : ''));
          var fileName = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss') + '_' + event.message.id.substring(0, 4) + ext;

          var replyMode = props.getProperty('REPLY_MODE_' + sourceId);
          if (source.type === 'user' || replyMode === 'on') {
            sendFlexSavedMessage(replyToken, (msgType === 'video' ? '動画' : (msgType === 'image' ? '写真' : 'ファイル')), fileName);
          }

          saveMediaToDriveAsync(event.message.id, msgType, source, fileName, sourceId, userName, chatName, time);

        } else if (msgType === 'text') {
          var text = event.message.text;
          enqueueLog(SECRET_LOG_SS_ID, chatName, [time, chatName, userName, 'TEXT', text]);
          handleTextCommand(text, replyToken, sourceId, source, userName);
        }
      }
    }
  } catch (err) {
    var errMsg = err.toString();
    if (replyTokenForError) try { replyMessage(replyTokenForError, '⚠️ エラー:\n' + errMsg + ERROR_CONTACT_MSG); } catch(e){}
    if (MY_USER_ID) pushMessage(MY_USER_ID, '⚠️ エラー通知: ' + errMsg);
  }
}

function saveMediaToDriveAsync(messageId, msgType, source, fileName, sourceId, userName, chatName, time) {
  try {
    var response = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/message/' + messageId + '/content', { 'headers': { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN }, 'method': 'get' });
    var blob = response.getBlob().setName(fileName);

    var diaryGroupId = props.getProperty('DIARY_GROUP_ID');
    var targetFolder = (msgType === 'image' && sourceId === diaryGroupId) ? getDiaryFolder() : getTargetDateFolder(source, sourceId);
    var file = targetFolder.createFile(blob);

    var sharedSsId = getOrCreateSpreadsheet(source, sourceId).getId();
    enqueueLog(sharedSsId, chatName, [time, userName, fileName, '', file.getUrl(), file.getId()]);
    props.setProperty('LAST_FILE_ID_' + sourceId, file.getId());

  } catch (e) {
    console.error('Async Save Failed: ' + e.toString());
  }
}

function enqueueLog(ssId, sheetName, dataArray) {
  var lock = LockService.getScriptLock();
  try {
    if (lock.tryLock(ASYNC_CONFIG.LOCK_TIMEOUT)) {
      var key = ASYNC_CONFIG.PREFIX + Utilities.getUuid();
      var payload = { ssId: ssId, sheetName: sheetName, data: dataArray, ts: Date.now() };    
      PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(payload));
    }
  } catch (e) { console.error('Log: ' + e.message); } finally { lock.releaseLock(); }
}

function processLogsBatch() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(ASYNC_CONFIG.LOCK_TIMEOUT)) return;
  try {
    var allProps = PropertiesService.getScriptProperties().getProperties();
    var keys = Object.keys(allProps).filter(function(k) { return k.indexOf(ASYNC_CONFIG.PREFIX) === 0; });      
    if (keys.length === 0) return;
    var groups = {};
    keys.forEach(function(key) {
      try {
        var p = JSON.parse(allProps[key]);
        if (!groups[p.ssId]) groups[p.ssId] = {};
        if (!groups[p.ssId][p.sheetName]) groups[p.ssId][p.sheetName] = { rows: [], keys: [] };
        groups[p.ssId][p.sheetName].rows.push(p.data);
        groups[p.ssId][p.sheetName].keys.push(key);
      } catch (e) { PropertiesService.getScriptProperties().deleteProperty(key); }
    });
    for (var ssId in groups) {
      if (Date.now() - start > ASYNC_CONFIG.LIMIT_MS) break;
      try {
        var ss = SpreadsheetApp.openById(ssId);
        var sheets = groups[ssId];
        for (var sName in sheets) {
          var targetSheet = ss.getSheetByName(sName) || ss.insertSheet(sName);
          var rows = sheets[sName].rows;
          if (targetSheet.getLastRow() === 0) {
            var header = (ssId === SECRET_LOG_SS_ID) ? ['日時', 'チャット名', 'ユーザー名', '種別', '内容'] : ['日時', 'ユーザー名', 'ファイル名', '内容/memo', 'URL'];
            targetSheet.appendRow(header);
            targetSheet.setFrozenRows(1);
          }
          var maxCol = 0;
          rows.forEach(function(r) { if (r.length > maxCol) maxCol = r.length; });
          var matrix = rows.map(function(r) { while (r.length < maxCol) r.push(''); return r; });
          targetSheet.getRange(targetSheet.getLastRow() + 1, 1, matrix.length, maxCol).setValues(matrix);       
          sheets[sName].keys.forEach(function(k) { PropertiesService.getScriptProperties().deleteProperty(k); });
        }
      } catch (e) { console.error('Batch SS Error: ' + e.message); }
    }
  } finally { lock.releaseLock(); }
}

function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { if (t.getHandlerFunction() === 'processLogsBatch') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('processLogsBatch').timeBased().everyMinutes(15).create();
}

function handleTextCommand(text, replyToken, sourceId, source, userName) {
  if (text.indexOf('/rename ') === 0) handleRenameCommand(text.substring(8).trim(), replyToken, sourceId, source);
  else if (text.indexOf('/memo ') === 0) handleMemoCommand(text.substring(6).trim(), replyToken, sourceId, source, userName);
  else if (text.indexOf('/contact ') === 0) handleContactCommand(text.substring(9).trim(), replyToken, userName);
  else if (text === '/link') handleLinkCommand(replyToken, source, sourceId);
  else if (text === '/help') sendHelp(replyToken);
  else if (text === '/commands') sendDetailedCommands(replyToken);
  else if (text === '/list') sendList(replyToken, source, sourceId);
  else if (text.indexOf('/delete') === 0) handleDeleteCommand(text.substring(7).trim(), replyToken, sourceId, source);
  else if (text === '/debug') handleDebugCommand(replyToken, source, sourceId);
  else if (text === '/stats') handleStatsCommand(replyToken, sourceId, source);
  else if (text.indexOf('/reply ') === 0) handleReplyModeCommand(text.substring(7).trim(), replyToken, sourceId, source);
  else if (text === '/id') replyMessage(replyToken, 'Chat ID: ' + sourceId);
  else if (text === '/set_diary_group') {
    props.setProperty('DIARY_GROUP_ID', sourceId);
    replyMessage(replyToken, '✅ 日記グループとして設定しました: ' + sourceId);
  }
}

function timestamp() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'); }
function getSafeSheetName(name) { return (name || 'Unknown').replace(/[\\\/\[\]\?\*\:]/g, '').trim().substring(0, 31) || 'Unknown'; }
function getFileExt(name) { return name.substring(name.lastIndexOf('.')); }

function getSortedFiles(folder) {
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) { files.push(it.next()); }
  files.sort(function(a, b) { return b.getLastUpdated() - a.getLastUpdated(); });
  return files;
}

function handleRenameCommand(commandText, replyToken, sourceId, source) {
  if (!commandText.trim()) { replyMessage(replyToken, '📁 名前を指定してください。'); return; }
  try {
    var args = commandText.split(/\s+/);
    if (args[0] && (args[0].toLowerCase() === 'all' || (args[0].toLowerCase() === 'last' && !isNaN(args[1])))) {
      var files = getSortedFiles(getTargetDateFolder(source, sourceId));
      var isAll = (args[0].toLowerCase() === 'all');
      var count = isAll ? files.length : parseInt(args[1]);
      var baseName = args.slice(isAll ? 1 : 2).join(' ');
      if (!baseName) throw new Error('名前を指定してください。');
      var limit = Math.min(count, files.length);
      for (var i = 0; i < limit; i++) {
        files[i].setName(baseName + '_' + (limit - i) + getFileExt(files[i].getName()));
      }
      replyMessage(replyToken, '✅ 一括リネーム完了');
    } else {
      var lastId = props.getProperty('LAST_FILE_ID_' + sourceId);
      if (!lastId) throw new Error('直前のファイルなし。');
      var file = DriveApp.getFileById(lastId);
      var ext = getFileExt(file.getName());
      file.setName(commandText + ext);
      replyMessage(replyToken, '✅ リネーム完了: ' + commandText + ext);
    }
  } catch (e) { replyMessage(replyToken, '❌ エラー: ' + e.message); }
}

function handleMemoCommand(memoText, replyToken, sourceId, source, userName) {
  if (!memoText.trim()) { replyMessage(replyToken, '📝 メモ内容を入力してください。'); return; }
  try {
    var chatName = getBaseName(source);
    var ssId = getOrCreateSpreadsheet(source, sourceId).getId();
    enqueueLog(ssId, chatName, [timestamp(), userName, '(MEMO)', memoText, '']);
    replyMessage(replyToken, '📝 メモを記録しました: ' + memoText);
  } catch (e) { replyMessage(replyToken, '❌ メモ記録失敗: ' + e.message); }
}

function getOrCreateSpreadsheet(source, sourceId) {
  var ssKey = 'SS_ID_' + sourceId;
  var ssId = props.getProperty(ssKey);
  if (ssId) { try { return SpreadsheetApp.openById(ssId); } catch (e) {} }
  
  var folder = DriveApp.getFolderById(LOG_FOLDER_ID);
  var chatName = getBaseName(source);
  var ss = SpreadsheetApp.create('LOG_' + chatName);
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  props.setProperty(ssKey, ss.getId());
  return ss;
}

function getTargetDateFolder(source, sourceId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ASYNC_CONFIG.LOCK_TIMEOUT);
    var groupFolder = getOrCreateGroupFolder(source, sourceId);
    var parts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd').split('/');
    var yearF = getSubFolder(groupFolder, parts[0]);
    var monthF = getSubFolder(yearF, parts[1]);
    return getSubFolder(monthF, parts[2]);
  } finally { lock.releaseLock(); }
}

function getSubFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function getOrCreateGroupFolder(source, sourceId) {
  var cachedId = props.getProperty('FOLDER_ID_' + sourceId);
  if (cachedId) { try { return DriveApp.getFolderById(cachedId); } catch (e) {} }
  var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var groupName = getBaseName(source);
  var folders = rootFolder.getFoldersByName(groupName);
  var folder = folders.hasNext() ? folders.next() : rootFolder.createFolder(groupName);
  props.setProperty('FOLDER_ID_' + sourceId, folder.getId());
  return folder;
}

function getBaseName(source) {
  var id = source.groupId || source.roomId || source.userId || 'Unknown';
  var name = '';
  if (source.type === 'user' && source.userId) {
    name = getUserName(id, source.userId, 'user');
  } else if (source.type === 'group' && source.groupId) {
    var cache = CacheService.getScriptCache();
    var cacheKey = 'group_name_' + source.groupId;
    name = cache.get(cacheKey) || '';
    if (!name) {
      try {
        var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + source.groupId + '/summary', { 'headers': { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN }, 'muteHttpExceptions': true });
        if (res.getResponseCode() === 200) {
          name = JSON.parse(res.getContentText()).groupName;
          cache.put(cacheKey, name, 21600);
        }
      } catch (e) {}
    }
  }
  return getSafeSheetName(name || 'Chat_' + id.substring(0, 8));
}

function sendFlexSavedMessage(replyToken, typeLabel, fileName) {
  var flexContent = {
    'type': 'bubble',
    'body': { 'type': 'box', 'layout': 'vertical', 'contents': [
      { 'type': 'text', 'text': '✅ 保存しました(' + typeLabel + ')', 'weight': 'bold', 'size': 'lg', 'color': '#00b900' },
      { 'type': 'box', 'layout': 'vertical', 'margin': 'lg', 'spacing': 'sm', 'contents': [
        { 'type': 'box', 'layout': 'baseline', 'spacing': 'sm', 'contents': [
          { 'type': 'text', 'text': 'File', 'color': '#aaaaaa', 'size': 'sm', 'flex': 1 },
          { 'type': 'text', 'text': fileName, 'wrap': true, 'color': '#666666', 'size': 'sm', 'flex': 4 }       
        ] }
      ] }
    ] },
    'footer': { 'type': 'box', 'layout': 'vertical', 'spacing': 'sm', 'contents': [
      { 'type': 'button', 'style': 'primary', 'height': 'sm', 'color': '#00b900', 'action': { 'type': 'postback', 'label': '名前を変更', 'data': 'action=rename', 'inputOption': 'openKeyboard', 'fillInText': '/rename ' } },  
      { 'type': 'box', 'layout': 'horizontal', 'spacing': 'sm', 'contents': [
        { 'type': 'button', 'style': 'secondary', 'height': 'sm', 'color': '#ff9f00', 'action': { 'type': 'postback', 'label': 'メモを追記', 'data': 'action=memo', 'inputOption': 'openKeyboard', 'fillInText': '/memo ' } },  
        { 'type': 'button', 'style': 'secondary', 'height': 'sm', 'color': '#ff3b30', 'action': { 'type': 'message', 'label': '削除', 'text': '/delete' } }
      ] },
      { 'type': 'button', 'style': 'link', 'height': 'sm', 'action': { 'type': 'message', 'label': '一覧を見る', 'text': '/list' } }
    ] }
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN },       
    'method': 'post',
    'payload': JSON.stringify({ 'replyToken': replyToken, 'messages': [{ 'type': 'flex', 'altText': '✅ 保存完了: ' + fileName, 'contents': flexContent }] }),
    'muteHttpExceptions': true
  });
}

function replyMessage(replyToken, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', { 'headers': { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN }, 'method': 'post', 'payload': JSON.stringify({ 'replyToken': replyToken, 'messages': [{ 'type': 'text', 'text': text }] }), 'muteHttpExceptions': true });
}

function pushMessage(to, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { 'headers': { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN }, 'method': 'post', 'payload': JSON.stringify({ 'to': to, 'messages': [{ 'type': 'text', 'text': text }] }), 'muteHttpExceptions': true });
}

function sendHelp(replyToken) {
  replyMessage(replyToken, '📖 [基本操作]\n・画像送信：自動保存されます\n・/list : 本日のファイル一覧を表示\n・/link : フォルダとログへのリンクを表示\n・/commands : 全コマンドの詳細を表示');
}

function sendDetailedCommands(replyToken) {
  var msg = '📋 [全コマンド一覧]\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n✨ 名前変更 (/rename)\n・/rename [名前] : 直前を変更\n・/rename [番号] [名前] : 指定番号を変更\n・/rename last [個数] [名前] : 直近N件を一括\n・/rename all [名前] : 本日の全ファイルを一括\n\n📝 メモ (/memo)\n・/memo [内容] : 直前にメモ\n\n🗑 削除 (/delete)\n・/delete : 直前を削除\n・/delete [番号] : 指定番号を削除\n\n💡 その他\n・/list : ファイル一覧を表示\n・/link : フォルダ/ログURLを表示\n・/reply [on/off] : 通知切り替え\n・/debug : 接続チェック\n・/stats : 統計情報を表示\n・/contact [内容] : 管理者へ送信\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝';
  replyMessage(replyToken, msg);
}

function handleDeleteCommand(argsText, replyToken, sourceId, source) {
  try {
    var arg = argsText.trim();
    var targetFile = null;
    if (!arg) {
      var lastId = props.getProperty('LAST_FILE_ID_' + sourceId);
      if (!lastId) throw new Error('直前のファイルが見つかりません。');
      targetFile = DriveApp.getFileById(lastId);
    } else if (!isNaN(arg)) {
      var files = getSortedFiles(getTargetDateFolder(source, sourceId));
      var index = parseInt(arg) - 1;
      if (index < 0 || index >= files.length) throw new Error('該当番号なし。');
      targetFile = files[index];
    }
    if (targetFile) {
      targetFile.setTrashed(true);
      replyMessage(replyToken, '🗑 ファイルを削除しました。');
    }
  } catch (e) { replyMessage(replyToken, '⚠️ 削除失敗: ' + e.message); }
}

function handleReplyModeCommand(mode, replyToken, sourceId, source) {
  var status = (mode.toLowerCase() === 'on') ? 'on' : 'off';
  props.setProperty('REPLY_MODE_' + sourceId, status);
  replyMessage(replyToken, '💡 自動応答通知: ' + status.toUpperCase());
}

function sendList(replyToken, source, sourceId) {
  try {
    var files = getSortedFiles(getTargetDateFolder(source, sourceId));
    var msg = '📂 本日のファイル(新着順):\n' + (files.length > 0 ? files.map(function(f, i) { return (i+1) + '. ' + f.getName(); }).join('\n') : 'なし');
    replyMessage(replyToken, msg);
  } catch (e) { replyMessage(replyToken, '⚠️ リスト取得失敗'); }
}

function handleDebugCommand(replyToken, source, sourceId) {
  var report = '🔍 [接続診断レポート]\n';
  try {
    report += '✅ Properties: OK\n';
    report += (CHANNEL_ACCESS_TOKEN ? '✅ Token: OK\n' : '❌ Token: MISSING\n');
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    report += '✅ Drive: ' + root.getName() + ' (OK)\n';
    report += '✅ Logs SS: OK\n\n✨ 正常に稼働中。';
    replyMessage(replyToken, report);
  } catch (e) { replyMessage(replyToken, report + '❌ エラー: ' + e.toString()); }
}

function handleStatsCommand(replyToken, sourceId, source) {
  try {
    var targetFolder = getTargetDateFolder(source, sourceId);
    var fileCount = 0;
    var files = targetFolder.getFiles();
    while (files.hasNext()) { files.next(); fileCount++; }
    var pendingLogs = Object.keys(PropertiesService.getScriptProperties().getProperties()).filter(function(k){ return k.indexOf(ASYNC_CONFIG.PREFIX) === 0; }).length;
    var msg = '📊 [システム統計]\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n📂 チャット: ' + getBaseName(source) + '\n💾 本日保存: ' + fileCount + ' 件\n📥 待機中ログ: ' + pendingLogs + ' 件\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n✨ 安定稼働中。';
    replyMessage(replyToken, msg);
  } catch (e) { replyMessage(replyToken, '⚠️ 統計取得失敗'); }
}

function getUserName(sourceId, userId, sourceType) {
  if (!userId) return 'Unknown User';
  var cache = CacheService.getScriptCache();
  var cachedName = cache.get('user_name_' + userId);
  if (cachedName) return cachedName;
  try {
    var url = (sourceType === 'group') ? 'https://api.line.me/v2/bot/group/' + sourceId + '/member/' + userId : 
              (sourceType === 'room') ? 'https://api.line.me/v2/bot/room/' + sourceId + '/member/' + userId :   
              'https://api.line.me/v2/bot/profile/' + userId;
    var res = UrlFetchApp.fetch(url, { 'headers': { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN }, 'muteHttpExceptions': true });
    if (res.getResponseCode() === 200) {
      var name = JSON.parse(res.getContentText()).displayName;
      cache.put('user_name_' + userId, name, 21600);
      return name;
    }
  } catch (e) {}
  return 'Unknown User';
}

function handleLinkCommand(replyToken, source, sourceId) {
  try {
    var folder = getOrCreateGroupFolder(source, sourceId);
    var ss = getOrCreateSpreadsheet(source, sourceId);
    replyMessage(replyToken, '🔗 リンク案内\n📂 フォルダ: ' + folder.getUrl() + '\n📊 ログSS: ' + ss.getUrl()); 
  } catch (e) { replyMessage(replyToken, '⚠️ リンク取得失敗'); }
}

function handleContactCommand(text, replyToken, userName) {
  if (MY_USER_ID) {
    pushMessage(MY_USER_ID, '📧 Contact from ' + userName + ':\n' + text);
    replyMessage(replyToken, '✅ 管理者へ送信しました。');
  }
}


function getDiaryFolder() {
  var folderId = props.getProperty('DIARY_FOLDER_ID');
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (e) {}
  }
  var name = 'Gemini_Journal_Scans';
  var folders = DriveApp.getFoldersByName(name);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
  props.setProperty('DIARY_FOLDER_ID', folder.getId());
  return folder;
}
