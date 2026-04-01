/**
 * Mutual Fund Tracker (Google Apps Script)
 *
 * Supports:
 * - Monthly portfolio buy/sell diff from Value Research factsheet pages
 * - Monthly sector weight changes
 * - Alerts for fund manager/category/objective changes
 * - Google News aggregation per fund (Google News RSS)
 * - Scheme performance vs category average and index (when present in source HTML)
 * - Manual sync and daily trigger setup
 *
 * IMPORTANT:
 * 1) Add funds in the "Funds" sheet with Value Research URLs.
 * 2) HTML structures can change. Update parsing helpers if needed.
 */

var SHEET_FUNDS = 'Funds';
var SHEET_SNAPSHOTS = 'Snapshots';
var SHEET_HOLDINGS = 'Holdings';
var SHEET_SECTORS = 'Sectors';
var SHEET_ALERTS = 'Alerts';
var SHEET_NEWS = 'News';

function doGet() {
  setupSheets_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Mutual Fund Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_FUNDS, [
    'fundCode', 'fundName', 'googleNewsQuery', 'overviewUrl', 'portfolioUrl', 'sectorUrl', 'active'
  ]);
  ensureSheet_(ss, SHEET_SNAPSHOTS, [
    'timestamp', 'fundCode', 'fundName', 'manager', 'category', 'objective',
    'schemeReturn', 'categoryAvgReturn', 'indexReturn', 'overviewUrl'
  ]);
  ensureSheet_(ss, SHEET_HOLDINGS, [
    'timestamp', 'fundCode', 'stockName', 'weight'
  ]);
  ensureSheet_(ss, SHEET_SECTORS, [
    'timestamp', 'fundCode', 'sectorName', 'weight'
  ]);
  ensureSheet_(ss, SHEET_ALERTS, [
    'timestamp', 'fundCode', 'alertType', 'message'
  ]);
  ensureSheet_(ss, SHEET_NEWS, [
    'timestamp', 'fundCode', 'title', 'source', 'publishedAt', 'url'
  ]);
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function getDashboardData() {
  setupSheets_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  return {
    funds: readTable_(ss.getSheetByName(SHEET_FUNDS)),
    latestSnapshots: getLatestSnapshots_(),
    latestAlerts: getLatestRows_(ss.getSheetByName(SHEET_ALERTS), 30),
    latestNews: getLatestRows_(ss.getSheetByName(SHEET_NEWS), 50)
  };
}

function manualSync() {
  var result = syncAllFunds_();
  return {
    ok: true,
    message: 'Sync completed',
    summary: result
  };
}

function setupDailyTrigger() {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'dailySync';
  });
  if (existing.length) {
    return 'Daily trigger already exists.';
  }

  ScriptApp.newTrigger('dailySync')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  return 'Daily trigger created (runs around 07:00 script timezone).';
}

function dailySync() {
  syncAllFunds_();
}

function syncAllFunds_() {
  setupSheets_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fundRows = readTable_(ss.getSheetByName(SHEET_FUNDS)).filter(function (r) {
    return String(r.active || 'TRUE').toUpperCase() !== 'FALSE';
  });

  var summary = [];

  fundRows.forEach(function (fund) {
    try {
      var snapshot = fetchFundSnapshot_(fund);
      persistSnapshot_(snapshot);
      evaluateAndStoreAlerts_(snapshot);
      storeGoogleNews_(fund, snapshot.timestamp);
      summary.push({ fundCode: fund.fundCode, status: 'ok' });
    } catch (err) {
      summary.push({ fundCode: fund.fundCode, status: 'error', error: String(err) });
      appendRow_(ss.getSheetByName(SHEET_ALERTS), [
        new Date(), fund.fundCode, 'SYNC_ERROR', String(err)
      ]);
    }
  });

  return summary;
}

function fetchFundSnapshot_(fund) {
  var timestamp = new Date();
  var overviewHtml = fetchHtml_(fund.overviewUrl);
  var portfolioHtml = fetchHtml_(fund.portfolioUrl);
  var sectorHtml = fetchHtml_(fund.sectorUrl);

  var manager = parseLabeledValue_(overviewHtml, 'Fund Manager') || parseLabeledValue_(overviewHtml, 'Fund manager');
  var category = parseLabeledValue_(overviewHtml, 'Category');
  var objective = parseLabeledValue_(overviewHtml, 'Investment Objective') || parseLabeledValue_(overviewHtml, 'Objective');

  var schemeReturn = parsePerformanceMetric_(overviewHtml, 'Scheme');
  var categoryAvgReturn = parsePerformanceMetric_(overviewHtml, 'Category Average') || parsePerformanceMetric_(overviewHtml, 'Category avg');
  var indexReturn = parsePerformanceMetric_(overviewHtml, 'Benchmark') || parsePerformanceMetric_(overviewHtml, 'Index');

  var holdings = parseNameWeightTable_(portfolioHtml);
  var sectors = parseNameWeightTable_(sectorHtml);

  return {
    timestamp: timestamp,
    fundCode: fund.fundCode,
    fundName: fund.fundName,
    manager: manager,
    category: category,
    objective: objective,
    schemeReturn: schemeReturn,
    categoryAvgReturn: categoryAvgReturn,
    indexReturn: indexReturn,
    overviewUrl: fund.overviewUrl,
    holdings: holdings,
    sectors: sectors,
    newsQuery: fund.googleNewsQuery || fund.fundName
  };
}

function fetchHtml_(url) {
  if (!url) throw new Error('Missing URL in Funds sheet');
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() >= 400) throw new Error('Failed URL: ' + url + ' code=' + res.getResponseCode());
  return res.getContentText();
}

function parseLabeledValue_(html, label) {
  var plain = stripTags_(html).replace(/\s+/g, ' ');
  var re = new RegExp(label + '\\s*[:\\-]\\s*([^|\\n\\r]{1,180})', 'i');
  var m = plain.match(re);
  return m ? m[1].trim() : '';
}

function parsePerformanceMetric_(html, label) {
  var plain = stripTags_(html).replace(/\s+/g, ' ');
  var re = new RegExp(label + '[^0-9\\-]*(-?\\d+(?:\\.\\d+)?)\\s*%?', 'i');
  var m = plain.match(re);
  return m ? Number(m[1]) : '';
}

function parseNameWeightTable_(html) {
  var rows = [];
  var trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  trMatches.forEach(function (tr) {
    var cells = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 2) return;

    var name = cleanupCell_(cells[0]);
    var weightText = cleanupCell_(cells[cells.length - 1]);

    if (!name || /name|stock|sector|holding/i.test(name) && /weight|%/i.test(weightText)) return;

    var weightMatch = weightText.match(/-?\d+(?:\.\d+)?/);
    if (!weightMatch) return;

    rows.push({ name: name, weight: Number(weightMatch[0]) });
  });

  // Deduplicate by name (keep highest weight if duplicated due to responsive tables)
  var byName = {};
  rows.forEach(function (r) {
    if (!byName[r.name] || byName[r.name].weight < r.weight) byName[r.name] = r;
  });

  return Object.keys(byName).map(function (k) { return byName[k]; });
}

function cleanupCell_(htmlCell) {
  return stripTags_(htmlCell)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags_(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function persistSnapshot_(snapshot) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  appendRow_(ss.getSheetByName(SHEET_SNAPSHOTS), [
    snapshot.timestamp,
    snapshot.fundCode,
    snapshot.fundName,
    snapshot.manager,
    snapshot.category,
    snapshot.objective,
    snapshot.schemeReturn,
    snapshot.categoryAvgReturn,
    snapshot.indexReturn,
    snapshot.overviewUrl
  ]);

  snapshot.holdings.forEach(function (h) {
    appendRow_(ss.getSheetByName(SHEET_HOLDINGS), [snapshot.timestamp, snapshot.fundCode, h.name, h.weight]);
  });

  snapshot.sectors.forEach(function (s) {
    appendRow_(ss.getSheetByName(SHEET_SECTORS), [snapshot.timestamp, snapshot.fundCode, s.name, s.weight]);
  });

  generateHoldingAndSectorDiffAlerts_(snapshot);
}

function generateHoldingAndSectorDiffAlerts_(snapshot) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var prevDate = getPreviousSnapshotDate_(snapshot.fundCode, snapshot.timestamp);
  if (!prevDate) return;

  var currentHoldings = snapshot.holdings;
  var previousHoldings = getItemsByDate_(SHEET_HOLDINGS, snapshot.fundCode, prevDate);
  var holdingDiff = diffItems_(previousHoldings, currentHoldings);

  if (holdingDiff.bought.length || holdingDiff.sold.length) {
    appendRow_(ss.getSheetByName(SHEET_ALERTS), [
      snapshot.timestamp,
      snapshot.fundCode,
      'HOLDINGS_CHANGE',
      'Bought: ' + holdingDiff.bought.join(', ') + ' | Sold: ' + holdingDiff.sold.join(', ')
    ]);
  }

  var currentSectors = snapshot.sectors;
  var previousSectors = getItemsByDate_(SHEET_SECTORS, snapshot.fundCode, prevDate);
  var sectorMoves = diffWeights_(previousSectors, currentSectors);

  if (sectorMoves.length) {
    appendRow_(ss.getSheetByName(SHEET_ALERTS), [
      snapshot.timestamp,
      snapshot.fundCode,
      'SECTOR_WEIGHT_CHANGE',
      sectorMoves.slice(0, 12).join(' | ')
    ]);
  }
}

function getPreviousSnapshotDate_(fundCode, currentTimestamp) {
  var rows = readTable_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SNAPSHOTS))
    .filter(function (r) {
      return r.fundCode === fundCode && new Date(r.timestamp).getTime() < new Date(currentTimestamp).getTime();
    })
    .sort(function (a, b) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  return rows.length ? rows[0].timestamp : null;
}

function getItemsByDate_(sheetName, fundCode, ts) {
  var dateKey = normalizeDateKey_(ts);
  var rows = readTable_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName));
  return rows.filter(function (r) {
    return r.fundCode === fundCode && normalizeDateKey_(r.timestamp) === dateKey;
  }).map(function (r) {
    return {
      name: r.stockName || r.sectorName,
      weight: Number(r.weight || 0)
    };
  });
}

function normalizeDateKey_(d) {
  var dt = new Date(d);
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function diffItems_(oldItems, newItems) {
  var oldSet = {};
  var newSet = {};
  oldItems.forEach(function (i) { oldSet[i.name] = true; });
  newItems.forEach(function (i) { newSet[i.name] = true; });

  var bought = Object.keys(newSet).filter(function (n) { return !oldSet[n]; });
  var sold = Object.keys(oldSet).filter(function (n) { return !newSet[n]; });

  return { bought: bought, sold: sold };
}

function diffWeights_(oldItems, newItems) {
  var oldMap = {};
  oldItems.forEach(function (i) { oldMap[i.name] = Number(i.weight || 0); });

  var out = [];
  newItems.forEach(function (i) {
    var oldW = oldMap.hasOwnProperty(i.name) ? oldMap[i.name] : 0;
    var delta = Number(i.weight || 0) - oldW;
    if (Math.abs(delta) >= 0.5) {
      out.push(i.name + ': ' + oldW.toFixed(2) + '% → ' + Number(i.weight || 0).toFixed(2) + '% (' + signed_(delta.toFixed(2)) + '%)');
    }
  });

  return out.sort();
}

function signed_(n) {
  return Number(n) > 0 ? '+' + n : n;
}

function evaluateAndStoreAlerts_(snapshot) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rows = readTable_(ss.getSheetByName(SHEET_SNAPSHOTS))
    .filter(function (r) { return r.fundCode === snapshot.fundCode; })
    .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

  if (!rows.length) return;
  var prev = rows[0];

  if ((prev.manager || '') !== (snapshot.manager || '')) {
    appendRow_(ss.getSheetByName(SHEET_ALERTS), [snapshot.timestamp, snapshot.fundCode, 'FUND_MANAGER_CHANGE', 'Manager changed: "' + prev.manager + '" → "' + snapshot.manager + '"']);
  }
  if ((prev.category || '') !== (snapshot.category || '')) {
    appendRow_(ss.getSheetByName(SHEET_ALERTS), [snapshot.timestamp, snapshot.fundCode, 'CATEGORY_CHANGE', 'Category changed: "' + prev.category + '" → "' + snapshot.category + '"']);
  }
  if ((prev.objective || '') !== (snapshot.objective || '')) {
    appendRow_(ss.getSheetByName(SHEET_ALERTS), [snapshot.timestamp, snapshot.fundCode, 'OBJECTIVE_CHANGE', 'Objective changed']);
  }
}

function storeGoogleNews_(fund, ts) {
  var query = encodeURIComponent(fund.googleNewsQuery || fund.fundName || fund.fundCode);
  var url = 'https://news.google.com/rss/search?q=' + query + '&hl=en-IN&gl=IN&ceid=IN:en';
  var xmlText = UrlFetchApp.fetch(url).getContentText();
  var doc = XmlService.parse(xmlText);
  var channel = doc.getRootElement().getChild('channel');
  if (!channel) return;

  var items = channel.getChildren('item').slice(0, 8);
  var newsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NEWS);

  items.forEach(function (item) {
    appendRow_(newsSheet, [
      ts,
      fund.fundCode,
      textOf_(item, 'title'),
      textOf_(item, 'source'),
      textOf_(item, 'pubDate'),
      textOf_(item, 'link')
    ]);
  });
}

function textOf_(node, childName) {
  var c = node.getChild(childName);
  return c ? c.getText() : '';
}

function appendRow_(sheet, arr) {
  sheet.appendRow(arr);
}

function readTable_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getLatestRows_(sheet, limit) {
  var rows = readTable_(sheet);
  return rows
    .sort(function (a, b) { return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(); })
    .slice(0, limit || 20);
}

function getLatestSnapshots_() {
  var rows = readTable_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SNAPSHOTS));
  var seen = {};
  rows.sort(function (a, b) { return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(); });

  return rows.filter(function (r) {
    if (seen[r.fundCode]) return false;
    seen[r.fundCode] = true;
    return true;
  });
}
