window.setFileLabel = function (input, label) {
  if (!input || !label) return;
  const file = input.files && input.files[0];
  label.textContent = file ? file.name : "No file selected";
  label.classList.toggle("has-file", Boolean(file));
  label.title = file ? file.name : "";
};

(function () {
  "use strict";

  const OFF_VALUES = new Set([
    "", "no", "inactive", "disabled", "empty", "off", "blank", "blanck", "none", "null", "nan", "(blank)"
  ]);
  const EMPTY_LABEL = "(blank)";

  // TikTok Header Aliases (Identity Type & Business Center ID EXCLUDED)
  const HEADER_ALIASES = {
    campaign: ["campaign name", "campaign"],
    adGroup: ["ad group name", "adgroup name", "ad group", "ad set name", "adset name", "ad set"],
    ad: ["ad name", "advertisement name"],
    buildStatus: ["build status", "ad status", "status"],
    tikTokStatus: ["ad status", "campaign status", "ad group status", "delivery info", "delivery status", "status"],
    creativeLink: ["creative link", "asset link", "creative url"],
    creativeFile: ["image name", "video name", "carousel name", "auto ad - image name", "auto ad - video name", "creative file name", "creative filename", "asset file name", "asset filename"],
    videoName: ["video name", "auto ad - video name"],
    imageName: ["image name", "carousel name", "auto ad - image name"],
    text: ["text", "auto ad - text", "body primary text", "primary text", "body copy", "body"],
    cta: ["call to action", "cta", "auto ad - call to action"],
    url: [
      "web url ( with utms included *use for tiktok*)",
      "web url with utms included use for tiktok",
      "web url",
      "destination url",
      "website url"
    ],
    utm: ["utm for tiktok", "utm for meta", "utm", "url parameters", "tracking parameters"],
    onlyShowAsAd: ["only show as ad"],
    creativeEnhancements: ["creative automatic enhancements", "creative enhancements"],
    adMusicId: ["ad music id", "music id"]
  };

  const REQUIRED_HEADER_GROUPS = [HEADER_ALIASES.campaign, HEADER_ALIASES.adGroup, HEADER_ALIASES.ad];

  // TikTok Field Definitions
  const FIELD_DEFINITIONS = [
    { id: "campaign", label: "Campaign Name", traffic: ["campaign"], tiktok: ["campaign"], type: "name" },
    { id: "adGroup", label: "Ad Group Name", traffic: ["adGroup"], tiktok: ["adGroup"], type: "name" },
    { id: "ad", label: "Ad Name", traffic: ["ad"], tiktok: ["ad"], type: "name" },
    { id: "status", label: "Build Status / Ad Status", traffic: ["buildStatus"], tiktok: ["tikTokStatus"], type: "statusMapping" },
    { id: "onlyShowAsAd", label: "Only Show As Ad", traffic: ["onlyShowAsAd"], tiktok: ["onlyShowAsAd"], type: "offState" },
    { id: "text", label: "Text (Ad Copy)", traffic: ["text"], tiktok: ["text"], type: "adCopyText" },
    { id: "cta", label: "Call to Action", traffic: ["cta"], tiktok: ["cta"], type: "cta" },
    { id: "url", label: "Destination / Web URL", traffic: ["url"], tiktok: ["url"], type: "url" },
    { id: "creativeEnhancements", label: "Creative Automatic Enhancements", traffic: ["creativeEnhancements"], tiktok: ["creativeEnhancements"], type: "text" },
    { id: "creative", label: "Creative Asset / Image / Video Name", traffic: ["creativeFile", "creativeLink"], tiktok: ["creativeFile"], type: "tiktokCreativeFilename" },
    { id: "adMusicId", label: "Ad Music ID", traffic: ["adMusicId"], tiktok: ["adMusicId"], type: "musicIdConditional" }
  ];

  let currentAnalysis = null;
  let isCompactView = false;

  function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(text);
  }

  function hasCopyOf(value) {
    if (value === null || value === undefined) return false;
    return /^(copy\s+of\s+)+/i.test(String(value).trim());
  }

  function stripCopyOf(value) {
    if (value === null || value === undefined) return "";
    let text = String(value).trim().replace(/^(copy\s+of\s+)+/i, "");
    return normalizeWhitespace(text).toLowerCase();
  }

  function normalizeAdCopyText(value) {
    if (value === null || value === undefined) return "";
    let text = String(value).replace(/[\[\]]/g, "").trim();
    return normalizeWhitespace(text);
  }

  function normalizeTikTokCreativeFilename(value) {
    if (value === null || value === undefined) return "";
    let text = String(value).replace(/[\[\]]/g, "").trim();
    if (!text || OFF_VALUES.has(text.toLowerCase())) return "";
    
    let clean = text.split(/[?#]/)[0].replace(/\\/g, "/");
    try { clean = decodeURIComponent(clean); } catch (e) {}
    clean = clean.split("/").pop().trim();
    
    const extMatch = clean.match(/(\.[a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "";
    let base = ext ? clean.slice(0, -ext.length) : clean;
    
    if (base.includes("_")) {
      const parts = base.split("_");
      base = parts.slice(0, -1).join("_");
    }
    
    return (base + ext).trim().toLowerCase();
  }

  function normalizeTrafficCreativeFilename(value) {
    if (value === null || value === undefined) return "";
    let text = String(value).replace(/[\[\]]/g, "").trim();
    if (!text || OFF_VALUES.has(text.toLowerCase())) return "";
    
    let clean = text.split(/[?#]/)[0].replace(/\\/g, "/");
    try { clean = decodeURIComponent(clean); } catch (e) {}
    clean = clean.split("/").pop().trim();
    
    return clean.trim().toLowerCase();
  }

  function keyParameterMatchCount(trafficRecord, tiktokRecord, trafficColumns, tiktokColumns) {
    let matches = 0;
    let total = 0;

    const trCopy = normalizeAdCopyText(firstMeaningfulValue(trafficRecord.row, trafficColumns.text || []));
    const tkCopy = normalizeAdCopyText(firstMeaningfulValue(tiktokRecord.row, tiktokColumns.text || []));
    if (trCopy && tkCopy) {
      total += 1;
      if (trCopy === tkCopy) matches += 1;
    }

    const trUrl = normalizeUrl(firstMeaningfulValue(trafficRecord.row, trafficColumns.url || []));
    const tkUrl = normalizeUrl(firstMeaningfulValue(tiktokRecord.row, tiktokColumns.url || []));
    if (trUrl && tkUrl) {
      total += 1;
      if (trUrl === tkUrl) matches += 1;
    }

    const trCreative = normalizeTrafficCreativeFilename(firstMeaningfulValue(trafficRecord.row, trafficColumns.creativeFile || []));
    const tkCreative = normalizeTikTokCreativeFilename(firstMeaningfulValue(tiktokRecord.row, tiktokColumns.creativeFile || []));
    if (trCreative && tkCreative) {
      total += 1;
      if (trCreative === tkCreative) matches += 1;
    }

    return { matches: matches, total: total };
  }

  function isVideoAd(row, tiktokColumns) {
    const vidIndices = tiktokColumns.videoName || [];
    for (let i = 0; i < vidIndices.length; i++) {
      const val = row[vidIndices[i]];
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        const norm = String(val).trim().toLowerCase();
        if (!OFF_VALUES.has(norm)) return true;
      }
    }
    const creativeIndices = tiktokColumns.creativeFile || [];
    for (let i = 0; i < creativeIndices.length; i++) {
      const val = row[creativeIndices[i]];
      if (val !== null && val !== undefined) {
        const str = String(val).trim().toLowerCase();
        if (/\.(mp4|mov|avi|m4v|webm|mkv)(\?|#|$)/i.test(str)) return true;
      }
    }
    return false;
  }

  function jaroWinkler(s1, s2) {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    let m = 0;
    let range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    let s1Matches = new Array(s1.length);
    let s2Matches = new Array(s2.length);

    for (let i = 0; i < s1.length; i++) {
      let low = i >= range ? i - range : 0;
      let high = i + range <= s2.length - 1 ? i + range : s2.length - 1;
      for (let j = low; j <= high; j++) {
        if (!s1Matches[i] && !s2Matches[j] && s1[i] === s2[j]) {
          m++;
          s1Matches[i] = true;
          s2Matches[j] = true;
          break;
        }
      }
    }

    if (m === 0) return 0;

    let k = 0, numTrans = 0;
    for (let i = 0; i < s1.length; i++) {
      if (s1Matches[i]) {
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) numTrans++;
        k++;
      }
    }

    let weight = (m / s1.length + m / s2.length + (m - numTrans / 2) / m) / 3;
    let l = 0, p = 0.1;

    if (weight > 0.7) {
      while (s1[l] === s2[l] && l < 4) l++;
      weight = weight + l * p * (1 - weight);
    }
    return weight;
  }

  function normalizeHeader(value) {
    const text = String(value == null ? "" : value).trim();
    if (/\bid\b/i.test(text) && !/name/i.test(text) && !/identity/i.test(text) && !/business center/i.test(text) && !/music/i.test(text)) return "__ignore_id__";
    
    return text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function headerMatches(value, aliases) {
    const normalized = normalizeHeader(value);
    if (normalized === "__ignore_id__") return false;

    for (let i = 0; i < aliases.length; i++) {
      if (normalized === normalizeHeader(aliases[i])) return true;
    }

    return aliases.some(function (alias) {
      const candidate = normalizeHeader(alias);
      return candidate.length >= 5 && normalized.includes(candidate);
    });
  }

  function rowHeaderScore(row) {
    if (!Array.isArray(row)) return 0;
    let score = 0;
    REQUIRED_HEADER_GROUPS.forEach(function (aliases) {
      if (row.some(function (cell) { return headerMatches(cell, aliases); })) score += 8;
    });
    const allAliases = Object.keys(HEADER_ALIASES).reduce(function (items, key) {
      return items.concat(HEADER_ALIASES[key]);
    }, []);
    row.forEach(function (cell) {
      if (headerMatches(cell, allAliases)) score += 1;
    });
    return score;
  }

  function detectHeaderRow(rows) {
    let bestIndex = -1;
    let bestScore = -1;
    const searchLimit = Math.min(rows.length, 80);
    for (let index = 0; index < searchLimit; index += 1) {
      const score = rowHeaderScore(rows[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0 || bestScore < 8) {
      throw new Error("Could not find a header row containing Campaign Name, Ad Group Name (or Ad Set Name), and Ad Name.");
    }
    return bestIndex;
  }

  function selectWorksheet(workbook) {
    let best = null;
    workbook.SheetNames.forEach(function (sheetName) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet || !worksheet["!ref"]) return;
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true, blankrows: true });
      let headerIndex = -1;
      let score = -1;
      try {
        headerIndex = detectHeaderRow(rows);
        score = rowHeaderScore(rows[headerIndex]);
      } catch (error) {
        score = -1;
      }
      if (!best || score > best.score) {
        best = { name: sheetName, worksheet: worksheet, rows: rows, headerIndex: headerIndex, score: score };
      }
    });
    if (!best || best.headerIndex < 0) {
      throw new Error("No worksheet in the uploaded file has the required TikTok headers.");
    }
    best.range = XLSX.utils.decode_range(best.worksheet["!ref"]);
    return best;
  }

  function readWorkbook(file) {
    return file.arrayBuffer().then(function (buffer) {
      try {
        return XLSX.read(buffer, { type: "array", cellStyles: true, cellDates: true, dense: false });
      } catch (error) {
        throw new Error("Unable to read “" + file.name + "”. Confirm it is a valid Excel or CSV file.");
      }
    });
  }

  function createColumnMap(headerRow) {
    const map = {};
    Object.keys(HEADER_ALIASES).forEach(function (key) {
      map[key] = [];
      
      headerRow.forEach(function (cell, columnIndex) {
        const normCell = normalizeHeader(cell);
        const exactMatch = HEADER_ALIASES[key].some(a => normalizeHeader(a) === normCell);
        if (exactMatch) map[key].push(columnIndex);
      });

      if (map[key].length === 0) {
        headerRow.forEach(function (cell, columnIndex) {
          if (headerMatches(cell, HEADER_ALIASES[key])) map[key].push(columnIndex);
        });
      }
    });
    return map;
  }

  function uniqueNumbers(values) {
    return values.filter(function (value, index, array) {
      return Number.isInteger(value) && array.indexOf(value) === index;
    });
  }

  function indicesForKeys(columnMap, keys) {
    return uniqueNumbers(keys.reduce(function (indices, key) {
      return indices.concat(columnMap[key] || []);
    }, []));
  }

  function firstMeaningfulValue(row, indices) {
    for (let index = 0; index < indices.length; index += 1) {
      const value = row[indices[index]];
      if (value !== null && value !== undefined && String(value).trim() !== "") return value;
    }
    return indices.length ? row[indices[0]] : "";
  }

  function meaningfulIndices(row, indices) {
    const populated = indices.filter(function (columnIndex) {
      const value = row[columnIndex];
      return value !== null && value !== undefined && String(value).trim() !== "";
    });
    return populated.length ? populated : indices.slice(0, 1);
  }

  function normalizeWhitespace(value) {
    return String(value == null ? "" : value)
      .replace(/\r\n/g, "\n")
      .replace(/[\t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
  }

  function normalizeKeyPart(value) {
    return normalizeWhitespace(value).toLocaleLowerCase();
  }

  function normalizeOffState(value) {
    const normalized = normalizeWhitespace(value).toLowerCase();
    return OFF_VALUES.has(normalized) ? "__off__" : normalized;
  }

  function normalizeCta(value) {
    return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function normalizeUrl(value) {
    const text = normalizeWhitespace(value);
    if (!text) return "";
    try {
      const parsed = new URL(text);
      parsed.hostname = parsed.hostname.toLowerCase();
      if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
      return parsed.toString().replace(/\/$/, "");
    } catch (e) {
      return text.replace(/\/+$/, "");
    }
  }

  function isStatusMatch(trafficStatus, tiktokStatus) {
    const tNorm = normalizeWhitespace(trafficStatus).toLowerCase();
    const tkNorm = normalizeWhitespace(tiktokStatus).toLowerCase();

    if (tNorm === "live" || tNorm === "on") {
      return tkNorm === "active" || tkNorm === "on";
    } else {
      return tkNorm === "paused" || tkNorm === "pause" || tkNorm === "off" || OFF_VALUES.has(tkNorm);
    }
  }

  function valuesMatch(type, trafficValue, tiktokValue) {
    if (OFF_VALUES.has(normalizeWhitespace(trafficValue).toLowerCase()) && 
        OFF_VALUES.has(normalizeWhitespace(tiktokValue).toLowerCase())) {
      return true;
    }

    if (type === "statusMapping") return isStatusMatch(trafficValue, tiktokValue);
    if (type === "offState") return normalizeOffState(trafficValue) === normalizeOffState(tiktokValue);
    if (type === "cta") return normalizeCta(trafficValue) === normalizeCta(tiktokValue);
    if (type === "url") return normalizeUrl(trafficValue) === normalizeUrl(tiktokValue);
    if (type === "adCopyText") return normalizeAdCopyText(trafficValue) === normalizeAdCopyText(tiktokValue);

    if (type === "tiktokCreativeFilename") {
      return normalizeTrafficCreativeFilename(trafficValue) === normalizeTikTokCreativeFilename(tiktokValue);
    }

    return normalizeWhitespace(trafficValue) === normalizeWhitespace(tiktokValue);
  }

  function displayValue(value) {
    const text = normalizeWhitespace(value);
    return text || EMPTY_LABEL;
  }

  function isRowEmpty(row) {
    return !row.some(function (cell) { return normalizeWhitespace(cell) !== ""; });
  }

  function recordName(row, columnMap, key) {
    return displayValue(firstMeaningfulValue(row, columnMap[key] || []));
  }

  function splitAdGroups(value) {
    if (value === null || value === undefined) return [EMPTY_LABEL];
    const text = String(value).trim();
    if (!text) return [EMPTY_LABEL];
    const parts = text.split(/[\r\n|;]+/).map(p => p.trim()).filter(Boolean);
    return parts.length ? parts : [EMPTY_LABEL];
  }

  function buildRecords(sheetData, columnMap) {
    const records = [];
    for (let rowIndex = sheetData.headerIndex + 1; rowIndex < sheetData.rows.length; rowIndex += 1) {
      const row = sheetData.rows[rowIndex];
      if (!row || isRowEmpty(row)) continue;
      const campaign = recordName(row, columnMap, "campaign");
      const adGroupRaw = firstMeaningfulValue(row, columnMap["adGroup"] || []);
      const ad = recordName(row, columnMap, "ad");
      if (campaign === EMPTY_LABEL && adGroupRaw === "" && ad === EMPTY_LABEL) continue;

      const adGroups = splitAdGroups(adGroupRaw);
      adGroups.forEach(function (adGroupSingle) {
        records.push({
          row: row,
          arrayRowIndex: rowIndex,
          sourceRow0: sheetData.range.s.r + rowIndex,
          campaign: campaign,
          adGroup: displayValue(adGroupSingle),
          ad: ad
        });
      });
    }
    return records;
  }

  // Multi-pass Ad Matching Engine
  function findBestTikTokMatch(trafficRecord, tiktokRecords, matchedTikTokIndices, trafficColumns, tiktokColumns) {
    const tAdRaw = normalizeWhitespace(trafficRecord.ad).toLowerCase();
    const tAdStripped = stripCopyOf(trafficRecord.ad);
    const tGroup = normalizeKeyPart(trafficRecord.adGroup);

    // Pass 1: Exact Ad Name & Exact Ad Group Name
    for (let idx = 0; idx < tiktokRecords.length; idx++) {
      if (matchedTikTokIndices.has(idx)) continue;
      const tk = tiktokRecords[idx];
      const tkAdRaw = normalizeWhitespace(tk.ad).toLowerCase();
      const tkAdStripped = stripCopyOf(tk.ad);
      const tkGroup = normalizeKeyPart(tk.adGroup);

      if ((tAdRaw === tkAdRaw || tAdStripped === tkAdStripped) && tGroup === tkGroup) {
        return { match: tk, index: idx };
      }
    }

    // Pass 2: Exact Ad Name & Contained / Fuzzy Ad Group Name
    for (let idx = 0; idx < tiktokRecords.length; idx++) {
      if (matchedTikTokIndices.has(idx)) continue;
      const tk = tiktokRecords[idx];
      const tkAdRaw = normalizeWhitespace(tk.ad).toLowerCase();
      const tkAdStripped = stripCopyOf(tk.ad);
      const tkGroup = normalizeKeyPart(tk.adGroup);

      if ((tAdRaw === tkAdRaw || tAdStripped === tkAdStripped) && 
          (tGroup.includes(tkGroup) || tkGroup.includes(tGroup) || jaroWinkler(tGroup, tkGroup) >= 0.88)) {
        return { match: tk, index: idx };
      }
    }

    // Pass 3: Template Duplication ("Copy of [Old_Ad]" in the SAME Ad Group)
    for (let idx = 0; idx < tiktokRecords.length; idx++) {
      if (matchedTikTokIndices.has(idx)) continue;
      const tk = tiktokRecords[idx];
      const tkAdRaw = normalizeWhitespace(tk.ad).toLowerCase();
      const tkGroup = normalizeKeyPart(tk.adGroup);

      if ((tGroup === tkGroup || tGroup.includes(tkGroup) || tkGroup.includes(tGroup)) && hasCopyOf(tkAdRaw)) {
        const pm = keyParameterMatchCount(trafficRecord, tk, trafficColumns, tiktokColumns);
        if (pm.matches >= 2 || (pm.total >= 2 && pm.matches >= 2)) {
          return { match: tk, index: idx };
        }
      }
    }

    return { match: null, index: -1 };
  }

  function compareSheets(trafficData, tiktokData) {
    const trafficColumns = createColumnMap(trafficData.rows[trafficData.headerIndex]);
    const tiktokColumns = createColumnMap(tiktokData.rows[tiktokData.headerIndex]);
    const trafficRecords = buildRecords(trafficData, trafficColumns);
    const tiktokRecords = buildRecords(tiktokData, tiktokColumns);
    const matchedTikTokIndices = new Set();
    const notices = [];

    const resolvedFields = FIELD_DEFINITIONS.map(function (field) {
      return Object.assign({}, field, {
        trafficIndices: indicesForKeys(trafficColumns, field.traffic),
        tiktokIndices: indicesForKeys(tiktokColumns, field.tiktok)
      });
    });

    resolvedFields.forEach(function (field) {
      if (!field.trafficIndices.length) notices.push("Trafficking column not found: " + field.label + ". Check skipped.");
    });

    const flagged = [];

    trafficRecords.forEach(function (trafficRecord) {
      const matchResult = findBestTikTokMatch(trafficRecord, tiktokRecords, matchedTikTokIndices, trafficColumns, tiktokColumns);
      const bestMatch = matchResult.match;

      const issues = [];
      const highlightColumns = new Set();

      if (!bestMatch) {
        issues.push({ field: "Record match", traffic: "Present", tiktok: "Ad not found in TikTok export" });
        ["campaign", "adGroup", "ad"].forEach(function (key) {
          indicesForKeys(trafficColumns, [key]).forEach(function (column) { highlightColumns.add(column); });
        });
      } else {
        if (matchResult.index >= 0) {
          matchedTikTokIndices.add(matchResult.index);
        }

        const isVideo = isVideoAd(bestMatch.row, tiktokColumns);

        resolvedFields.forEach(function (field) {
          if (!field.trafficIndices.length && field.id !== "adGroup" && field.id !== "campaign" && field.id !== "ad") return;

          if (field.type === "musicIdConditional" && isVideo) {
            return;
          }

          let trafficValue, tiktokValue;

          if (field.id === "adGroup") {
            trafficValue = trafficRecord.adGroup;
            tiktokValue = bestMatch.adGroup || firstMeaningfulValue(bestMatch.row, field.tiktokIndices);
          } else if (field.id === "campaign") {
            trafficValue = trafficRecord.campaign;
            tiktokValue = bestMatch.campaign || firstMeaningfulValue(bestMatch.row, field.tiktokIndices);
          } else if (field.id === "ad") {
            trafficValue = trafficRecord.ad;
            tiktokValue = bestMatch.ad || firstMeaningfulValue(bestMatch.row, field.tiktokIndices);
          } else {
            trafficValue = firstMeaningfulValue(trafficRecord.row, field.trafficIndices);
            tiktokValue = firstMeaningfulValue(bestMatch.row, field.tiktokIndices);
          }

          if (!field.tiktokIndices.length && field.id !== "adGroup" && field.id !== "campaign" && field.id !== "ad") {
            const trafficIsOff = OFF_VALUES.has(normalizeWhitespace(trafficValue).toLowerCase());
            if (!trafficIsOff) {
              issues.push({ field: field.label, traffic: displayValue(trafficValue), tiktok: "(column not found)" });
              meaningfulIndices(trafficRecord.row, field.trafficIndices).forEach(function (column) { highlightColumns.add(column); });
            }
            return;
          }

          if (!valuesMatch(field.type, trafficValue, tiktokValue)) {
            issues.push({ field: field.label, traffic: displayValue(trafficValue), tiktok: displayValue(tiktokValue) });
            meaningfulIndices(trafficRecord.row, field.trafficIndices).forEach(function (column) { highlightColumns.add(column); });
          }
        });
      }

      if (issues.length) {
        flagged.push({
          record: trafficRecord,
          campaign: trafficRecord.campaign,
          adGroup: trafficRecord.adGroup,
          ad: trafficRecord.ad,
          issues: issues,
          highlightColumns: Array.from(highlightColumns)
        });
      }
    });

    const tiktokOnly = tiktokRecords.filter(function (record, idx) { return !matchedTikTokIndices.has(idx); });
    tiktokOnly.forEach(function (record) {
      flagged.push({
        record: null,
        campaign: record.campaign,
        adGroup: record.adGroup,
        ad: record.ad,
        issues: [{ field: "Record match", traffic: "Ad not found in trafficking sheet", tiktok: "Present" }],
        highlightColumns: [],
        tiktokOnly: true
      });
    });

    return {
      trafficData: trafficData,
      trafficColumns: trafficColumns,
      tiktokColumns: tiktokColumns,
      trafficRecords: trafficRecords,
      tiktokRecords: tiktokRecords,
      resolvedFields: resolvedFields,
      flagged: flagged,
      reportRows: flagged.filter(function (item) { return Boolean(item.record); }),
      tiktokOnlyCount: tiktokOnly.length,
      notices: notices
    };
  }

  function groupFlaggedRows(flagged) {
    const campaigns = new Map();
    flagged.forEach(function (item) {
      if (!campaigns.has(item.campaign)) campaigns.set(item.campaign, new Map());
      const adGroups = campaigns.get(item.campaign);
      if (!adGroups.has(item.adGroup)) adGroups.set(item.adGroup, []);
      adGroups.get(item.adGroup).push(item);
    });
    return campaigns;
  }

  function issueTotal(items) {
    return items.reduce(function (total, item) { return total + item.issues.length; }, 0);
  }

  function el(tagName, className, textValue) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textValue !== undefined) element.textContent = textValue;
    return element;
  }

  function detailsGroup(className, label, count) {
    const details = el("details", className);
    details.open = true;
    const summary = el("summary");
    summary.appendChild(el("span", "summary-name", label));
    summary.appendChild(el("span", "summary-count", count + (count === 1 ? " issue" : " issues")));
    details.appendChild(summary);
    return details;
  }

  function renderIssue(issue) {
    const item = el("li", "mismatch-item");
    item.appendChild(el("span", "mismatch-field", issue.field));

    const trafficBlock = el("span", "value-block");
    trafficBlock.appendChild(el("span", "value-source", "Trafficking"));
    trafficBlock.appendChild(el("span", "value-text", issue.traffic));
    item.appendChild(trafficBlock);

    const arrow = el("span", "value-arrow");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    item.appendChild(arrow);

    const tiktokBlock = el("span", "value-block");
    tiktokBlock.appendChild(el("span", "value-source", "TikTok export"));
    tiktokBlock.appendChild(el("span", "value-text", issue.tiktok));
    item.appendChild(tiktokBlock);
    return item;
  }

  function renderResults(analysis) {
    const resultsList = document.getElementById("resultsList");
    const resultsView = document.getElementById("resultsView");
    if (resultsList) resultsList.replaceChildren();
    
    const issueCount = issueTotal(analysis.flagged);

    let totalEvaluatedChecks = 0;
    analysis.trafficRecords.forEach(function (record) {
      let bestMatch = null;
      let highestScore = 0;

      analysis.tiktokRecords.forEach(function (tiktokRecord) {
        let cScore = jaroWinkler(normalizeKeyPart(record.campaign), normalizeKeyPart(tiktokRecord.campaign));
        let gScore = jaroWinkler(normalizeKeyPart(record.adGroup), normalizeKeyPart(tiktokRecord.adGroup));
        let aScore = jaroWinkler(stripCopyOf(record.ad), stripCopyOf(tiktokRecord.ad));
        let score = (cScore * 0.20) + (gScore * 0.20) + (aScore * 0.60);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = tiktokRecord;
        }
      });

      const isVideo = bestMatch ? isVideoAd(bestMatch.row, analysis.tiktokColumns) : false;

      analysis.resolvedFields.forEach(function (field) {
        if (!field.trafficIndices.length) return;
        if (field.type === "musicIdConditional" && isVideo) return;
        totalEvaluatedChecks += 1;
      });
    });

    let scorePct = 100;
    if (totalEvaluatedChecks > 0) {
      scorePct = Math.max(0, Math.round(((totalEvaluatedChecks - issueCount) / totalEvaluatedChecks) * 100));
      if (issueCount > 0 && scorePct >= 100) {
        scorePct = 99;
      }
    }

    const scoreCircle = document.getElementById("scoreCircle");
    const scoreValueEl = document.getElementById("scoreValue");
    const scoreIconEl = document.getElementById("scoreIcon");
    const scoreLabelEl = document.getElementById("scoreLabel");
    const successStage = document.getElementById("successStage");
    const resultsControls = document.getElementById("resultsControls");
    const downloadBtn = document.getElementById("downloadButton");

    if (scorePct === 100 && issueCount === 0) {
      if (resultsView) resultsView.classList.add("no-issues");
      if (scoreCircle) scoreCircle.hidden = true;
      if (resultsControls) resultsControls.hidden = true;
      if (successStage) successStage.hidden = false;
      if (downloadBtn) downloadBtn.hidden = true;
    } else {
      if (resultsView) resultsView.classList.remove("no-issues");
      if (successStage) successStage.hidden = true;
      if (scoreCircle) {
        scoreCircle.hidden = false;
        scoreCircle.className = "score-circle is-lower";
        if (scoreValueEl) scoreValueEl.textContent = scorePct + "%";
        if (scoreIconEl) scoreIconEl.innerHTML = '<i data-lucide="x-circle" aria-hidden="true"></i>';
        if (scoreLabelEl) scoreLabelEl.textContent = issueCount + (issueCount === 1 ? " ISSUE" : " ISSUES");
      }
      if (resultsControls) resultsControls.hidden = false;
      if (downloadBtn) downloadBtn.hidden = false;
    }

    setElementText("adsChecked", analysis.trafficRecords.length);
    setElementText("adsFlagged", analysis.flagged.length);
    setElementText("issueCount", issueCount);
    setElementText("resultsSubtitle", analysis.flagged.length
      ? "Discrepancies are grouped by campaign, ad group, and ad. TikTok values are shown as delivered."
      : "Every comparable ad-level value matches the TikTok export.");

    const notice = document.getElementById("analysisNotice");
    if (notice) {
      const noticeParts = analysis.notices.slice();
      if (analysis.tiktokOnlyCount) {
        noticeParts.push(analysis.tiktokOnlyCount + " TikTok-only ad" + (analysis.tiktokOnlyCount === 1 ? " was" : "s were") + " found.");
      }
      notice.hidden = noticeParts.length === 0;
      notice.textContent = noticeParts.join(" ");
    }

    if (analysis.flagged.length > 0) {
      const campaigns = groupFlaggedRows(analysis.flagged);
      campaigns.forEach(function (adGroups, campaignName) {
        const campaignItems = Array.from(adGroups.values()).reduce(function (items, rows) { return items.concat(rows); }, []);
        const campaignGroup = detailsGroup("campaign-group", campaignName, issueTotal(campaignItems));
        const campaignBody = el("div", "group-body");

        adGroups.forEach(function (ads, adGroupName) {
          const adGroupGroup = detailsGroup("adgroup-group", adGroupName, issueTotal(ads));
          const adGroupBody = el("div", "group-body");

          ads.forEach(function (adItem) {
            const adGroup = detailsGroup("ad-group", adItem.ad, adItem.issues.length);
            const list = el("ul", "mismatch-list");
            adItem.issues.forEach(function (issue) { list.appendChild(renderIssue(issue)); });
            adGroup.appendChild(list);
            adGroupBody.appendChild(adGroup);
          });

          adGroupGroup.appendChild(adGroupBody);
          campaignBody.appendChild(adGroupGroup);
        });

        campaignGroup.appendChild(campaignBody);
        if (resultsList) resultsList.appendChild(campaignGroup);
      });
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      try { window.lucide.createIcons(); } catch (e) {}
    }
  }

  function toggleDetailsView() {
    const resultsList = document.getElementById("resultsList");
    const toggleBtnText = document.getElementById("toggleDetailsText");
    const toggleBtnIcon = document.querySelector("#toggleDetailsBtn i");

    isCompactView = !isCompactView;

    if (resultsList) {
      if (isCompactView) {
        resultsList.classList.add("compact-mode");
        if (toggleBtnText) toggleBtnText.textContent = "Expand";
        if (toggleBtnIcon) toggleBtnIcon.setAttribute("data-lucide", "maximize-2");
      } else {
        resultsList.classList.remove("compact-mode");
        if (toggleBtnText) toggleBtnText.textContent = "Compact";
        if (toggleBtnIcon) toggleBtnIcon.setAttribute("data-lucide", "minimize-2");
      }
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      try { window.lucide.createIcons(); } catch (e) {}
    }
  }

  function cloneObject(value) {
    if (!value) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function copySourceCell(sourceSheet, sourceRow0, columnIndex) {
    const sourceAddress = XLSX.utils.encode_cell({ r: sourceRow0, c: columnIndex });
    const sourceCell = sourceSheet[sourceAddress];
    if (!sourceCell) return { t: "s", v: "" };
    const copied = {};
    ["t", "v", "w", "z", "s", "l"].forEach(function (key) {
      if (sourceCell[key] !== undefined) copied[key] = key === "s" || key === "l" ? cloneObject(sourceCell[key]) : sourceCell[key];
    });
    if (copied.v === undefined) copied.v = "";
    if (!copied.t) copied.t = typeof copied.v === "number" ? "n" : "s";
    return copied;
  }

  function mergeStyle(base, addition) {
    const merged = cloneObject(base) || {};
    Object.keys(addition).forEach(function (key) {
      if (typeof addition[key] === "object" && addition[key] !== null && !Array.isArray(addition[key])) {
        merged[key] = Object.assign({}, merged[key] || {}, addition[key]);
      } else {
        merged[key] = addition[key];
      }
    });
    return merged;
  }

  function buildReportWorkbook(analysis) {
    const source = analysis.trafficData.worksheet;
    const headerRow = analysis.trafficData.rows[analysis.trafficData.headerIndex];
    const columnCount = headerRow.length;
    const reportSheet = {};
    const sourceHeaderRow0 = analysis.trafficData.range.s.r + analysis.trafficData.headerIndex;

    const headerStyle = {
      fill: { patternType: "solid", fgColor: { rgb: "FF0050" } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true }
    };

    const mismatchStyle = {
      fill: { patternType: "solid", fgColor: { rgb: "FFC7CE" } },
      font: { color: { rgb: "9C0006" }, bold: true }
    };

    for (let column = 0; column < columnCount; column += 1) {
      const targetAddress = XLSX.utils.encode_cell({ r: 0, c: column });
      const cell = copySourceCell(source, sourceHeaderRow0, column);
      cell.s = mergeStyle(cell.s, headerStyle);
      reportSheet[targetAddress] = cell;
    }

    analysis.reportRows.forEach(function (flaggedRow, reportIndex) {
      const targetRow0 = reportIndex + 1;
      for (let column = 0; column < columnCount; column += 1) {
        const targetAddress = XLSX.utils.encode_cell({ r: targetRow0, c: column });
        const cell = copySourceCell(source, flaggedRow.record.sourceRow0, column);

        if (flaggedRow.highlightColumns.includes(column)) {
          cell.s = mergeStyle(cell.s, mismatchStyle);
        }
        reportSheet[targetAddress] = cell;
      }
    });

    reportSheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, analysis.reportRows.length), c: Math.max(0, columnCount - 1) } });
    if (source["!cols"]) reportSheet["!cols"] = cloneObject(source["!cols"]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, reportSheet, "TikTok QA Discrepancies");
    return workbook;
  }

  function downloadReport() {
    try {
      if (!currentAnalysis) throw new Error("Run an analysis before downloading the report.");
      if (typeof XLSX === "undefined") throw new Error("The Excel library did not load.");
      const workbook = buildReportWorkbook(currentAnalysis);
      XLSX.writeFile(workbook, "Report_QA_TikTok.xlsx", { compression: true, cellStyles: true });
    } catch (error) {
      window.alert("Download failed: " + (error && error.message ? error.message : "Unknown error"));
    }
  }

  function switchView(from, to) {
    from.classList.add("is-leaving");
    window.setTimeout(function () {
      from.hidden = true;
      from.classList.remove("is-leaving");
      to.hidden = false;
      to.classList.add("is-entering");
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { to.classList.remove("is-entering"); });
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 320);
  }

  function bindFileInput(input, label) {
    if (!input || !label) return;
    ["change", "input"].forEach(function (eventType) {
      input.addEventListener(eventType, function () {
        window.setFileLabel(input, label);
      });
    });
  }

  function restart() {
    const mainView = document.getElementById("mainView");
    const resultsView = document.getElementById("resultsView");
    
    const trafficInput = document.getElementById("trafficFile");
    const tiktokInput = document.getElementById("tiktokFile");
    const trafficLabel = document.getElementById("trafficFileName");
    const tiktokLabel = document.getElementById("tiktokFileName");
    
    if (trafficInput) {
      trafficInput.value = "";
      window.setFileLabel(trafficInput, trafficLabel);
    }
    if (tiktokInput) {
      tiktokInput.value = "";
      window.setFileLabel(tiktokInput, tiktokLabel);
    }
    
    const progress = document.getElementById("progressRegion");
    if (progress) progress.hidden = true;

    const analyzeBtn = document.getElementById("analyzeButton");
    if (analyzeBtn) analyzeBtn.disabled = false;

    currentAnalysis = null;
    isCompactView = false;

    const resultsList = document.getElementById("resultsList");
    if (resultsList) resultsList.classList.remove("compact-mode");

    switchView(resultsView, mainView);
  }

  function analyze() {
    const trafficInput = document.getElementById("trafficFile");
    const tiktokInput = document.getElementById("tiktokFile");
    const analyzeButton = document.getElementById("analyzeButton");
    const progress = document.getElementById("progressRegion");
    const trafficFile = trafficInput && trafficInput.files && trafficInput.files[0];
    const tiktokFile = tiktokInput && tiktokInput.files && tiktokInput.files[0];

    if (!trafficFile || !tiktokFile) {
      window.alert("Please select both the Trafficking Sheet and Exported TikTok Sheet.");
      return;
    }

    if (analyzeButton) analyzeButton.disabled = true;
    if (progress) progress.hidden = false;

    window.setTimeout(function () {
      Promise.all([readWorkbook(trafficFile), readWorkbook(tiktokFile)])
        .then(function (workbooks) {
          try {
            const trafficData = selectWorksheet(workbooks[0]);
            const tiktokData = selectWorksheet(workbooks[1]);
            currentAnalysis = compareSheets(trafficData, tiktokData);
            renderResults(currentAnalysis);
            switchView(document.getElementById("mainView"), document.getElementById("resultsView"));
          } catch (error) {
            window.alert("Analysis Error: " + (error && error.message ? error.message : "Unknown error"));
          }
        })
        .catch(function (error) {
          window.alert("File Read Failed: " + (error && error.message ? error.message : "Unknown error"));
        })
        .finally(function () {
          if (analyzeButton) analyzeButton.disabled = false;
          if (progress) progress.hidden = true;
        });
    }, 80);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const trafficInput = document.getElementById("trafficFile");
    const tiktokInput = document.getElementById("tiktokFile");
    const trafficLabel = document.getElementById("trafficFileName");
    const tiktokLabel = document.getElementById("tiktokFileName");

    bindFileInput(trafficInput, trafficLabel);
    bindFileInput(tiktokInput, tiktokLabel);
    
    const btnAnalyze = document.getElementById("analyzeButton");
    if (btnAnalyze) btnAnalyze.addEventListener("click", analyze);
    
    const btnToggleDetails = document.getElementById("toggleDetailsBtn");
    if (btnToggleDetails) btnToggleDetails.addEventListener("click", toggleDetailsView);

    const btnDownload = document.getElementById("downloadButton");
    if (btnDownload) btnDownload.addEventListener("click", downloadReport);
    
    const btnRestart = document.getElementById("restartButton");
    if (btnRestart) btnRestart.addEventListener("click", restart);

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      try { window.lucide.createIcons(); } catch (e) {}
    }
  });
})();
