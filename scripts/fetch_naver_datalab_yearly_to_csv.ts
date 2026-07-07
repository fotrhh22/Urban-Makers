import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Error: NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not set in .env.local");
  process.exit(1);
}

async function fetchNaverDatalab(payload: any): Promise<any> {
  const url = 'https://openapi.naver.com/v1/datalab/search';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': CLIENT_ID!,
      'X-Naver-Client-Secret': CLIENT_SECRET!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Naver API request failed with status ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Backup existing files safely
function backupFile(srcRelativePath: string, destRelativePath: string) {
  const srcPath = path.resolve(srcRelativePath);
  const destPath = path.resolve(destRelativePath);
  if (fs.existsSync(srcPath)) {
    // Ensure destination directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log(`Backed up: ${srcRelativePath} -> ${destRelativePath}`);
  } else {
    console.log(`Skipped backup (File not found): ${srcRelativePath}`);
  }
}

async function main() {
  const configPath = path.resolve('config/naver_datalab_keywords/changsin_sungin.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }

  // Backup caches
  console.log("Backing up cache files...");
  backupFile('data/cache/naver_datalab/changsin_sungin_core.json', 'data/cache/naver_datalab/changsin_sungin_core.before_proxy_v4_no_sentiment.json');
  backupFile('data/cache/naver_datalab/changsin_sungin_reaction.json', 'data/cache/naver_datalab/changsin_sungin_context.before_proxy_v4_no_sentiment.json');

  // Backup CSVs and parse old proxy values
  console.log("Backing up processed CSV files...");
  const csv2Path = path.resolve('data/processed/naver_datalab/changsin_sungin_online_reaction_proxy_2012_2025.csv');
  const oldProxyValues: Record<number, string> = {};

  if (fs.existsSync(csv2Path)) {
    // Parse old proxy values for anchor_online_reaction_proxy before backup/overwrite
    const content = fs.readFileSync(csv2Path, 'utf8');
    const lines = content.split('\n');
    if (lines.length > 1) {
      const header = lines[0].split(',');
      const yearIdx = header.indexOf('year');
      const proxyIdx = header.indexOf('anchor_online_reaction_proxy');
      if (yearIdx !== -1 && proxyIdx !== -1) {
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length > Math.max(yearIdx, proxyIdx)) {
            const yearStr = parts[yearIdx].trim();
            const valStr = parts[proxyIdx].trim();
            const year = parseInt(yearStr, 10);
            if (!isNaN(year) && valStr !== '') {
              oldProxyValues[year] = valStr;
            }
          }
        }
      }
    }
  }

  backupFile('data/processed/naver_datalab/changsin_sungin_yearly_indices_2012_2025.csv', 'data/processed/naver_datalab/changsin_sungin_yearly_indices_2012_2025.before_proxy_v4_no_sentiment.csv');
  backupFile('data/processed/naver_datalab/changsin_sungin_online_reaction_proxy_2012_2025.csv', 'data/processed/naver_datalab/changsin_sungin_online_reaction_proxy_2012_2025.before_proxy_v4_no_sentiment.csv');
  backupFile('data/processed/naver_datalab/changsin_sungin_component_breakdown_2012_2025.csv', 'data/processed/naver_datalab/changsin_sungin_component_breakdown_2012_2025.before_proxy_v4_no_sentiment.csv');

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { urbanAreaId, urbanAreaName, district, apiStartDate, apiEndDate, timeUnit, calibrationGroupName, batches } = config;

  const cacheDir = path.resolve('data/cache/naver_datalab');
  fs.mkdirSync(cacheDir, { recursive: true });

  const batchResults: Record<string, any> = {};

  for (const batch of batches) {
    const payload = {
      startDate: apiStartDate,
      endDate: apiEndDate,
      timeUnit: timeUnit,
      keywordGroups: batch.keywordGroups.map((g: any) => ({
        groupName: g.groupName,
        keywords: g.keywords
      }))
    };

    console.log(`Fetching batch: ${batch.batchId}...`);
    const apiResponse = await fetchNaverDatalab(payload);

    // Save cache (Note: Batch 2 is changsin_sungin_context now)
    const cachePath = path.join(cacheDir, `${batch.batchId}.json`);
    const cacheData = {
      requestedAt: new Date().toISOString(),
      batchId: batch.batchId,
      requestPayload: payload,
      response: apiResponse
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
    console.log(`Saved cache to ${cachePath}`);

    batchResults[batch.batchId] = apiResponse;
  }

  // Calibration
  console.log("Calibrating results...");
  const coreResult = batchResults['changsin_sungin_core'];
  const contextResult = batchResults['changsin_sungin_context'];

  if (!coreResult || !contextResult) {
    throw new Error("Missing batch results for calibration.");
  }

  const coreCalData = coreResult.results.find((r: any) => r.title === calibrationGroupName);
  const contextCalData = contextResult.results.find((r: any) => r.title === calibrationGroupName);

  if (!coreCalData || !contextCalData) {
    throw new Error(`Calibration group "${calibrationGroupName}" not found in batch results.`);
  }

  const coreMap = new Map<string, number>();
  for (const d of coreCalData.data) {
    coreMap.set(d.period, d.ratio);
  }

  let sumCore = 0;
  let sumContext = 0;
  for (const d of contextCalData.data) {
    const cRatio = coreMap.get(d.period) || 0;
    sumCore += cRatio;
    sumContext += d.ratio;
  }

  const F = sumContext > 0 ? sumCore / sumContext : 1.0;
  console.log(`Calibration factor (F) = ${F.toFixed(4)} (SumCore: ${sumCore.toFixed(2)}, SumContext: ${sumContext.toFixed(2)})`);

  // Build unified monthly dataset
  const indicatorMap: Record<string, string> = {}; // groupName -> indicatorCode
  const indicatorFromBatch: Record<string, string> = {}; // indicatorCode -> batchId
  
  for (const batch of batches) {
    for (const group of batch.keywordGroups) {
      indicatorMap[group.groupName] = group.indicatorCode;
      indicatorFromBatch[group.indicatorCode] = batch.batchId;
    }
  }

  const monthlyRawData: Record<string, Record<string, number>> = {};
  const monthlyCalibratedData: Record<string, Record<string, number>> = {};

  const allIndicators = [
    'area_search_attention_index',
    'urban_regen_search_attention_index',
    'anchor_facility_search_interest_index',
    'visit_intent_search_index',
    'alley_landscape_search_index',
    'local_industry_search_index',
    'living_environment_search_index'
  ];

  for (const code of allIndicators) {
    monthlyRawData[code] = {};
    monthlyCalibratedData[code] = {};
  }

  // Fill in core indicators
  for (const res of coreResult.results) {
    const code = indicatorMap[res.title];
    if (code && allIndicators.includes(code)) {
      for (const d of res.data) {
        monthlyRawData[code][d.period] = d.ratio;
        monthlyCalibratedData[code][d.period] = d.ratio; // Core is raw, calibrated equals raw
      }
    }
  }

  // Fill in context indicators with calibration
  for (const res of contextResult.results) {
    const code = indicatorMap[res.title];
    // Calibration group itself in context batch is area_search_attention_index,
    // which we already populated from core batch. Skip context's area_search_attention_index.
    if (code && code !== 'area_search_attention_index' && allIndicators.includes(code)) {
      for (const d of res.data) {
        monthlyRawData[code][d.period] = d.ratio;
        monthlyCalibratedData[code][d.period] = d.ratio * F;
      }
    }
  }

  // Aggregate to Yearly Mean Ratio (2012 to 2025)
  const yearlyIndices: Record<number, Record<string, {
    rawMeanRatio: number | null,
    calibratedMeanRatio: number | null,
    validCount: number,
    coverageRate: number,
    coverageWarning: boolean
  }>> = {};

  for (let year = 2012; year <= 2025; year++) {
    yearlyIndices[year] = {};
    for (const code of allIndicators) {
      if (year >= 2012 && year <= 2015) {
        yearlyIndices[year][code] = {
          rawMeanRatio: null,
          calibratedMeanRatio: null,
          validCount: 0,
          coverageRate: 0.0,
          coverageWarning: true
        };
      } else {
        const rawRatios: number[] = [];
        const calRatios: number[] = [];
        for (let month = 1; month <= 12; month++) {
          const monthStr = month < 10 ? `0${month}` : `${month}`;
          const period = `${year}-${monthStr}-01`;
          
          const rawVal = monthlyRawData[code][period];
          if (rawVal !== undefined && rawVal !== null) {
            rawRatios.push(rawVal);
          }

          const calVal = monthlyCalibratedData[code][period];
          if (calVal !== undefined && calVal !== null) {
            calRatios.push(calVal);
          }
        }

        const validCount = rawRatios.length;
        const coverageRate = validCount / 12;
        const coverageWarning = coverageRate < 0.75;

        let rawMean: number | null = null;
        let calMean: number | null = null;

        if (rawRatios.length > 0) {
          rawMean = parseFloat((rawRatios.reduce((a, b) => a + b, 0) / rawRatios.length).toFixed(2));
        }
        if (calRatios.length > 0) {
          calMean = parseFloat((calRatios.reduce((a, b) => a + b, 0) / calRatios.length).toFixed(2));
        }

        yearlyIndices[year][code] = {
          rawMeanRatio: rawMean,
          calibratedMeanRatio: calMean,
          validCount,
          coverageRate: parseFloat(coverageRate.toFixed(4)),
          coverageWarning
        };
      }
    }
  }

  const processedDir = path.resolve('data/processed/naver_datalab');
  fs.mkdirSync(processedDir, { recursive: true });

  // 1. CSV 1: changsin_sungin_yearly_indices_2012_2025.csv
  const csv1Rows: string[] = [];
  csv1Rows.push('urbanAreaId,urbanAreaName,district,year,indicatorCode,groupName,yearlyMeanRatio,validMonthCount,coverageRate,coverageWarning,unit,isProxy,isSatisfaction,dataStatus,confidence,sourceName,note,batchId,rawRatio,calibratedRatio,calibrationGroupName,calibrationFactor,calibrationStatus');

  const indicatorMetadata = [
    { code: 'area_search_attention_index', name: '창신숭인_지역인지도' },
    { code: 'urban_regen_search_attention_index', name: '창신숭인_도시재생' },
    { code: 'anchor_facility_search_interest_index', name: '창신숭인_거점공간' },
    { code: 'visit_intent_search_index', name: '창신숭인_방문관광' },
    { code: 'alley_landscape_search_index', name: '창신숭인_골목경관' },
    { code: 'local_industry_search_index', name: '창신숭인_봉제산업' },
    { code: 'living_environment_search_index', name: '창신숭인_생활환경' }
  ];

  for (let year = 2012; year <= 2025; year++) {
    for (const meta of indicatorMetadata) {
      const data = yearlyIndices[year][meta.code];
      const dataStatus = year >= 2016 ? 'available' : 'unavailable_by_api_limit';
      const confidence = year >= 2016 ? 'search_interest_proxy' : 'not_available';
      const note = year >= 2016 ? '연도별 평균 ratio' : '네이버 데이터랩 API는 2016-01-01부터 조회 가능';
      const batchId = indicatorFromBatch[meta.code] || '';

      let rawRatioStr = '';
      let calibratedRatioStr = '';
      let yearlyMeanRatioStr = '';
      let calStatus = 'not_calibrated';
      let calGroupName = '';
      let calFactorStr = '';

      if (year >= 2016) {
        rawRatioStr = data.rawMeanRatio !== null ? data.rawMeanRatio.toFixed(2) : '';
        if (batchId === 'changsin_sungin_context') {
          if (meta.code !== 'area_search_attention_index') {
            calibratedRatioStr = data.calibratedMeanRatio !== null ? data.calibratedMeanRatio.toFixed(2) : '';
            yearlyMeanRatioStr = calibratedRatioStr;
            calStatus = 'calibrated';
            calGroupName = calibrationGroupName;
            calFactorStr = F.toFixed(4);
          } else {
            yearlyMeanRatioStr = rawRatioStr;
          }
        } else {
          yearlyMeanRatioStr = rawRatioStr;
        }
      }

      csv1Rows.push([
        urbanAreaId,
        urbanAreaName,
        district,
        year,
        meta.code,
        meta.name,
        yearlyMeanRatioStr,
        data.validCount,
        data.coverageRate.toFixed(2),
        data.coverageWarning ? 'true' : 'false',
        '0-100_relative_index',
        'true',
        'false',
        dataStatus,
        confidence,
        'naver_datalab',
        `"${note}"`,
        batchId,
        rawRatioStr,
        calibratedRatioStr,
        calGroupName,
        calFactorStr,
        calStatus
      ].join(','));
    }
  }
  fs.writeFileSync(path.join(processedDir, 'changsin_sungin_yearly_indices_2012_2025.csv'), csv1Rows.join('\n'), 'utf8');
  console.log(`Saved CSV 1 to ${path.join(processedDir, 'changsin_sungin_yearly_indices_2012_2025.csv')}`);

  // Weights mapping for new proxy (v4)
  const proxyComponentWeights: Record<string, number> = {
    anchor_facility_search_interest_index: 0.35,
    visit_intent_search_index: 0.30,
    alley_landscape_search_index: 0.25,
    local_industry_search_index: 0.10
  };

  // Weight list for Breakdown CSV
  const allComponentWeights: Record<string, number> = {
    area_search_attention_index: 0.00,
    urban_regen_search_attention_index: 0.00,
    anchor_facility_search_interest_index: 0.35,
    visit_intent_search_index: 0.30,
    alley_landscape_search_index: 0.25,
    local_industry_search_index: 0.10,
    living_environment_search_index: 0.00
  };

  // 2. CSV 2: changsin_sungin_online_reaction_proxy_2012_2025.csv
  const csv2Rows: string[] = [];
  csv2Rows.push('year,anchor_online_reaction_proxy,urban_regeneration_online_reaction_proxy,availableComponentCount,missingComponentCodes,formulaVersion,dataStatus,warning');

  // 3. CSV 3: changsin_sungin_component_breakdown_2012_2025.csv
  const csv3Rows: string[] = [];
  csv3Rows.push('urbanAreaId,urbanAreaName,district,year,componentCode,componentName,yearlyMeanRatio,weight,weightedValue,includedInProxy,dataStatus,confidence,formulaVersion');

  const proxyComponents = Object.keys(proxyComponentWeights);
  const allComponents = Object.keys(allComponentWeights);

  for (let year = 2012; year <= 2025; year++) {
    if (year >= 2012 && year <= 2015) {
      const missingCodes = proxyComponents.join(';');
      csv2Rows.push([
        year,
        oldProxyValues[year] || '', // Maintain old proxy if exists, else empty
        '', // urban_regeneration_online_reaction_proxy
        0,  // availableComponentCount
        missingCodes,
        'v4_content_proxy_no_sentiment',
        'unavailable_by_api_limit',
        '"네이버 데이터랩 API는 2016-01-01부터 조회 가능"'
      ].join(','));

      for (const code of allComponents) {
        const meta = indicatorMetadata.find(m => m.code === code)!;
        const weight = allComponentWeights[code];
        csv3Rows.push([
          urbanAreaId,
          urbanAreaName,
          district,
          year,
          code,
          meta.name,
          '', // yearlyMeanRatio
          weight.toFixed(2),
          '', // weightedValue
          'false',
          'unavailable_by_api_limit',
          'not_available',
          'v4_content_proxy_no_sentiment'
        ].join(','));
      }
    } else {
      const available: string[] = [];
      const missing: string[] = [];
      let sumWeightsAbs = 0;
      let weightedSum = 0;

      for (const code of proxyComponents) {
        const data = yearlyIndices[year][code];
        const val = data.calibratedMeanRatio;
        if (val !== null) {
          available.push(code);
          sumWeightsAbs += Math.abs(proxyComponentWeights[code]);
          weightedSum += val * proxyComponentWeights[code];
        } else {
          missing.push(code);
        }
      }

      let proxyValStr = '';
      if (available.length > 0 && sumWeightsAbs > 0) {
        const proxyVal = weightedSum / sumWeightsAbs;
        proxyValStr = proxyVal.toFixed(2);
      }

      let hasWarning = false;
      for (const code of proxyComponents) {
        if (yearlyIndices[year][code].coverageWarning) {
          hasWarning = true;
        }
      }
      const warningStr = hasWarning ? '"low_coverage_warning"' : '';

      csv2Rows.push([
        year,
        oldProxyValues[year] || '', // Maintain old proxy value
        proxyValStr, // urban_regeneration_online_reaction_proxy
        available.length,
        missing.join(';'),
        'v4_content_proxy_no_sentiment',
        'available',
        warningStr
      ].join(','));

      for (const code of allComponents) {
        const meta = indicatorMetadata.find(m => m.code === code)!;
        const data = yearlyIndices[year][code];
        const weight = allComponentWeights[code];
        const includedInProxy = proxyComponents.includes(code);
        
        let yearlyMeanRatioStr = '';
        let weightedValueStr = '';

        const val = data.calibratedMeanRatio;
        if (val !== null) {
          yearlyMeanRatioStr = val.toFixed(2);
          if (includedInProxy) {
            weightedValueStr = (val * weight).toFixed(2);
          }
        }

        csv3Rows.push([
          urbanAreaId,
          urbanAreaName,
          district,
          year,
          code,
          meta.name,
          yearlyMeanRatioStr,
          weight.toFixed(2),
          weightedValueStr,
          includedInProxy ? 'true' : 'false',
          'available',
          'search_interest_proxy',
          'v4_content_proxy_no_sentiment'
        ].join(','));
      }
    }
  }

  fs.writeFileSync(path.join(processedDir, 'changsin_sungin_online_reaction_proxy_2012_2025.csv'), csv2Rows.join('\n'), 'utf8');
  console.log("Saved CSV 2.");

  fs.writeFileSync(path.join(processedDir, 'changsin_sungin_component_breakdown_2012_2025.csv'), csv3Rows.join('\n'), 'utf8');
  console.log("Saved CSV 3.");

  console.log("Successfully completed ETL process.");
}

main().catch(err => {
  console.error("ETL process failed:", err);
  process.exit(1);
});
