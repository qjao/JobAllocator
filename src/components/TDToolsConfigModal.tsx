import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Check, Copy, ShieldCheck, Loader2, AlertCircle, Key, Server, RefreshCw, FileText, Database, ArrowRight } from 'lucide-react';

interface TDToolsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onSyncSuccess?: () => void;
}

export default function TDToolsConfigModal({ isOpen, onClose, isAdmin, onSyncSuccess }: TDToolsConfigModalProps) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [tokenPreview, setTokenPreview] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Testing connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    responseTimeMs?: number;
    error?: string;
    catalog?: {
      success: boolean;
      totalJobs: number;
      counts?: { ltp?: number; stp?: number; headcodes?: number; total_jobs?: number };
      sampleJobs?: string[];
      headcodesCount?: number;
      dbErrors?: any;
      tablesFound?: string[];
      rawError?: any;
    };
    lookup?: {
      success: boolean;
      driverName?: string;
      depot?: string;
      pdfname?: string;
      page?: string;
      rawError?: any;
    };
  } | null>(null);

  // Copy PHP state
  const [copiedPhp, setCopiedPhp] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'php'>('config');

  useEffect(() => {
    if (!isOpen) return;
    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    setSaveError(null);
    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch('/api/settings/tdtools', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUrl(data.url || '');
        setHasToken(data.hasToken);
        setTokenPreview(data.tokenPreview || '');
      }
    } catch (e: any) {
      console.warn('Failed to load TDtools settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    setTestResult(null);

    const targetUrlStr = url.trim();
    if (!targetUrlStr) {
      setSaveError('Please enter the full TDtools API URL');
      setSaving(false);
      return;
    }

    try {
      const authToken = localStorage.getItem('token');
      // Save settings and run live test & sync in one go
      const res = await fetch('/api/settings/tdtools/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          url: targetUrlStr,
          token: token.trim() || undefined,
          saveOnSuccess: true
        })
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        setSaveSuccess(true);
        setToken('');
        loadSettings();
        if (onSyncSuccess) onSyncSuccess();
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError(data.error || 'Failed to connect to TDtools API.');
      }
    } catch (e: any) {
      setSaveError(e.message || 'Error communicating with server');
    } finally {
      setSaving(false);
    }
  };

  const phpSnippet = `<?php
/**
 * TDtools Unified Diagrams, Roster & Driver Allocation API
 * File: api_diagram.php (place in your roster/ directory e.g. roster/api_diagram.php)
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Api-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 1. Shared Secret Token
define('TDTOOLS_API_SECRET', '${token.trim() || 'tdtools_allocator_secure_token_2025'}');

// 2. Authenticate Allocator Request
$authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
$token = '';
if (preg_match('/Bearer\\s+(\\S+)/i', $authHeader, $matches)) {
    $token = $matches[1];
} elseif (isset($_GET['token'])) {
    $token = $_GET['token'];
} elseif (isset($_SERVER['HTTP_X_API_TOKEN'])) {
    $token = $_SERVER['HTTP_X_API_TOKEN'];
}

if (empty($token) || !hash_equals(TDTOOLS_API_SECRET, $token)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

// 3. Treat Allocator as Admin on TDtools side for accessing allocations
global $_admin, $link;
$_admin = true;

// 4. Load TDtools core
$type = "open";
if (file_exists(__DIR__ . '/autoload.php')) {
    require_once __DIR__ . '/autoload.php';
} elseif (file_exists(__DIR__ . '/../autoload.php')) {
    require_once __DIR__ . '/../autoload.php';
}
$_admin = true;

// Fallback check for alternative database connection names
if (empty($link)) {
    if (isset($GLOBALS['link'])) $link = $GLOBALS['link'];
    elseif (isset($GLOBALS['db']) && $GLOBALS['db'] instanceof mysqli) $link = $GLOBALS['db'];
    elseif (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) $link = $GLOBALS['conn'];
}

// 5. Action Routing:
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

// --- A. Full Diagram Catalog (r_jobs, r_jobs_stp, r_jobs_headcodes) ---
if ($action === 'diagrams' || $action === 'jobs' || $action === 'all' || (!isset($_GET['name']) && !isset($_GET['job']))) {
    $r_jobs = [];
    $r_jobs_stp = [];
    $headcodesMap = [];
    $dbErrors = [];
    $tablesFound = [];

    if (!empty($link)) {
        // Query LTP jobs (strictly last 1 year; excludes NULL dates and old 2021 bundles)
        $resLtp = $link->query("SELECT * FROM \`r_jobs\` WHERE \`from\` >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
        if (!$resLtp) {
            $resLtp = $link->query("SELECT * FROM \`jobs\` WHERE \`from\` >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
            if (!$resLtp) $dbErrors['r_jobs'] = $link->error;
        }

        if ($resLtp) {
            while ($row = $resLtp->fetch_assoc()) {
                $jobName = $row['name'] ?? $row['diagram'] ?? $row['job_name'] ?? $row['job'] ?? $row['jobnumber'] ?? '';
                if (empty($jobName)) continue;

                $fromDate = $row['from'] ?? $row['valid_from'] ?? $row['bfrom'] ?? null;
                if (empty($fromDate)) continue;
                if (isset($row['bundle']) && strpos((string)$row['bundle'], '2021') !== false) continue;
                if (isset($row['pdfname']) && strpos((string)$row['pdfname'], '2021') !== false) continue;

                $r_jobs[] = [
                    'jobid' => (string)($row['jobid'] ?? $row['id'] ?? $row['job_id'] ?? ''),
                    'name' => (string)$jobName,
                    'priority' => isset($row['priority']) ? (int)$row['priority'] : 10,
                    'daycode' => (string)($row['daycode'] ?? $row['days'] ?? $row['day'] ?? ''),
                    'isStp' => false,
                    'from' => $fromDate,
                    'to' => $row['to'] ?? $row['valid_to'] ?? $row['bto'] ?? null,
                    'pdfname' => (string)($row['pdfname'] ?? $row['pdf_name'] ?? $row['pdf'] ?? ''),
                    'page' => (string)($row['pdfpage'] ?? $row['pdf_page'] ?? $row['page'] ?? '1'),
                    'tag' => (string)($row['tag'] ?? ''),
                    'bundle' => (string)($row['bundle'] ?? '')
                ];
            }
            $resLtp->free();
        }

        // Query STP jobs (strictly last 1 year)
        $resStp = $link->query("SELECT * FROM \`r_jobs_stp\` WHERE \`from\` >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
        if (!$resStp) {
            $resStp = $link->query("SELECT * FROM \`jobs_stp\` WHERE \`from\` >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
            if (!$resStp) $dbErrors['r_jobs_stp'] = $link->error;
        }

        if ($resStp) {
            while ($row = $resStp->fetch_assoc()) {
                $jobName = $row['name'] ?? $row['diagram'] ?? $row['job_name'] ?? $row['job'] ?? $row['jobnumber'] ?? '';
                if (empty($jobName)) continue;

                $fromDate = $row['from'] ?? $row['valid_from'] ?? $row['start'] ?? null;
                if (empty($fromDate)) continue;
                if (isset($row['bundle']) && strpos((string)$row['bundle'], '2021') !== false) continue;
                if (isset($row['pdfname']) && strpos((string)$row['pdfname'], '2021') !== false) continue;

                $isCancelled = false;
                if (isset($row['cancel']) && ($row['cancel'] == '1' || $row['cancel'] === true || $row['cancel'] === 1)) $isCancelled = true;
                if (isset($row['cancelled']) && ($row['cancelled'] == '1' || $row['cancelled'] === true || $row['cancelled'] === 1)) $isCancelled = true;

                $r_jobs_stp[] = [
                    'jobid' => (string)($row['jobid'] ?? $row['id'] ?? $row['job_id'] ?? ''),
                    'name' => (string)$jobName,
                    'priority' => isset($row['priority']) ? (int)$row['priority'] : 10,
                    'daycode' => (string)($row['daycode'] ?? $row['days'] ?? $row['day'] ?? ''),
                    'isStp' => true,
                    'cancel' => $isCancelled,
                    'from' => $fromDate,
                    'to' => $row['to'] ?? $row['valid_to'] ?? $row['end'] ?? null,
                    'pdfname' => (string)($row['pdfname'] ?? $row['pdf_name'] ?? $row['pdf'] ?? ''),
                    'page' => (string)($row['pdfpage'] ?? $row['pdf_page'] ?? $row['page'] ?? '1')
                ];
            }
            $resStp->free();
        }

        // Query Headcodes
        $resHc = $link->query("SELECT * FROM \`r_jobs_headcodes\`");
        if (!$resHc) {
            $resHc = $link->query("SELECT * FROM \`jobs_headcodes\`");
            if (!$resHc) $dbErrors['r_jobs_headcodes'] = $link->error;
        }

        if ($resHc) {
            while ($row = $resHc->fetch_assoc()) {
                $ltp_id = $row['ltp_id'] ?? $row['ltpId'] ?? $row['ltp'] ?? null;
                $stp_id = $row['stp_id'] ?? $row['stpId'] ?? $row['stp'] ?? null;
                $job_id = $row['jobid'] ?? $row['job_id'] ?? null;
                $hcVal = $row['headcodes'] ?? $row['headcode'] ?? null;

                $parsedHcs = [];
                if (is_string($hcVal)) {
                    $decoded = json_decode($hcVal, true);
                    if (is_array($decoded)) $parsedHcs = $decoded;
                    else $parsedHcs = array_filter(array_map('trim', explode(',', $hcVal)));
                } elseif (is_array($hcVal)) {
                    $parsedHcs = $hcVal;
                }

                if (!empty($ltp_id) && $ltp_id !== 'NULL') $headcodesMap["ltp_{$ltp_id}"] = array_values($parsedHcs);
                if (!empty($stp_id) && $stp_id !== 'NULL') $headcodesMap["stp_{$stp_id}"] = array_values($parsedHcs);
                if (!empty($job_id) && $job_id !== 'NULL') {
                    $headcodesMap["ltp_{$job_id}"] = array_values($parsedHcs);
                    $headcodesMap["stp_{$job_id}"] = array_values($parsedHcs);
                }
            }
            $resHc->free();
        }

        // Available table diagnostics if 0 jobs or errors
        if (!empty($dbErrors) || (count($r_jobs) === 0 && count($r_jobs_stp) === 0)) {
            $resTables = $link->query("SHOW TABLES");
            if ($resTables) {
                while ($tRow = $resTables->fetch_row()) {
                    $tName = $tRow[0];
                    if (stripos($tName, 'job') !== false || stripos($tName, 'diag') !== false || stripos($tName, 'alloc') !== false) {
                        $tablesFound[] = $tName;
                    }
                }
                $resTables->free();
            }
        }
    } else {
        $dbErrors['connection'] = 'MySQL link connection is null';
    }

    $allJobs = array_merge($r_jobs, $r_jobs_stp);
    usort($allJobs, function($a, $b) { return strcmp($a['name'], $b['name']); });

    echo json_encode([
        'success' => count($allJobs) > 0 || count($dbErrors) === 0,
        'action' => 'diagrams',
        'jobs' => $allJobs,
        'headcodesMap' => (object)$headcodesMap,
        'counts' => [
            'ltp' => count($r_jobs),
            'stp' => count($r_jobs_stp),
            'total_jobs' => count($allJobs)
        ],
        'sample_jobs' => array_slice(array_map(function($j) { return $j['name']; }, $allJobs), 0, 8),
        'db_errors' => !empty($dbErrors) ? $dbErrors : null,
        'tables_found' => !empty($tablesFound) ? $tablesFound : null
    ]);
    exit();
}

// --- B. Single Diagram & Driver Lookup ---
$diagramName = isset($_GET['name']) ? trim($_GET['name']) : (isset($_GET['job']) ? trim($_GET['job']) : '');
$dateInput = isset($_GET['date']) ? trim($_GET['date']) : date('Y-m-d');
$searchDate = date('Y-m-d', strtotime($dateInput));

$jobs = function_exists('getJobInfo') ? getJobInfo($diagramName, $searchDate) : [];
$selectedJob = !empty($jobs) ? $jobs[0] : null;

$allocation = null;
$allocType = null;
if (!empty($link) && !empty($diagramName)) {
    preg_match('/\\d+/', $diagramName, $numMatches);
    $baseJobNumber = isset($numMatches[0]) ? $numMatches[0] : $diagramName;
    $wildcard = "%" . $baseJobNumber . "%";
    
    // A. Daily Allocation
    $sql = "SELECT * FROM r_daily_allocation WHERE alloc_date = ? AND job_number LIKE ? LIMIT 1";
    if ($stmt = @$link->prepare($sql)) {
        $stmt->bind_param("ss", $searchDate, $wildcard);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res && $row = $res->fetch_assoc()) {
            $allocation = $row;
            $typeField = strtolower($row['type'] ?? $row['alloc_type'] ?? $row['source'] ?? $row['roster_type'] ?? '');
            $allocType = (strpos($typeField, 'week') !== false) ? 'Weekly' : 'Daily';
        }
        $stmt->close();
    }

    // B. Weekly Allocation Fallback
    if (!$allocation) {
        $sqlWeekly = "SELECT * FROM r_weekly_allocation WHERE alloc_date = ? AND job_number LIKE ? LIMIT 1";
        if ($stmtWeekly = @$link->prepare($sqlWeekly)) {
            $stmtWeekly->bind_param("ss", $searchDate, $wildcard);
            $stmtWeekly->execute();
            $resWeekly = $stmtWeekly->get_result();
            if ($resWeekly && $rowWeekly = $resWeekly->fetch_assoc()) {
                $allocation = $rowWeekly;
                $allocType = 'Weekly';
            }
            $stmtWeekly->close();
        }
    }
}

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'tdtools.co.uk';
$rosterPath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\\\') . '/';
$baseUrl = $protocol . $host . $rosterPath;

$diagramPayload = null;
if ($selectedJob) {
    $pdfname = isset($selectedJob['pdfname']) ? $selectedJob['pdfname'] : '';
    $pdfpage = isset($selectedJob['pdfpage']) ? (int)$selectedJob['pdfpage'] : 1;
    $diagramPayload = [
        'name' => $selectedJob['name'],
        'ptype' => isset($selectedJob['ptype']) ? $selectedJob['ptype'] : 'ltp',
        'isStp' => (isset($selectedJob['ptype']) && strtolower($selectedJob['ptype']) === 'stp'),
        'cancelled' => !empty($selectedJob['cancel']),
        'pdfname' => $pdfname,
        'pdfpage' => $pdfpage,
        'imageUrl' => $baseUrl . 'diagramimg.php?pdfname=' . urlencode($pdfname) . '&page=' . $pdfpage,
        'pdfUrl' => $baseUrl . 'pdfs/' . urlencode($pdfname) . '#page=' . $pdfpage
    ];
}

echo json_encode([
    'success' => true,
    'found' => ($selectedJob !== null || $allocation !== null),
    'diagram' => $diagramPayload,
    'allocation' => $allocation,
    'allocType' => $allocType ?: 'Daily',
    'driverName' => $allocation ? ($allocation['driver_name'] ?? $allocation['driver'] ?? $allocation['name'] ?? null) : null,
    'depot' => $allocation ? ($allocation['depot'] ?? null) : null,
    'pdfname' => $diagramPayload ? $diagramPayload['pdfname'] : null,
    'page' => $diagramPayload ? $diagramPayload['pdfpage'] : null,
    'imageUrl' => $diagramPayload ? $diagramPayload['imageUrl'] : null
]);`;

  const copyPhpCode = () => {
    navigator.clipboard.writeText(phpSnippet);
    setCopiedPhp(true);
    setTimeout(() => setCopiedPhp(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                TDtools Live API Integration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Populates dashboard dropdowns directly from TDtools (<code className="font-mono">r_jobs</code>, <code className="font-mono">r_jobs_stp</code>, <code className="font-mono">r_jobs_headcodes</code>) and retrieves daily driver allocations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Key className="w-4 h-4" />
            Endpoint & Sync
          </button>
          <button
            onClick={() => setActiveTab('php')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'php'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Copy className="w-4 h-4" />
            TDtools PHP Script
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'config' ? (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <form onSubmit={handleSaveAndSync} className="space-y-4">
                  {saveSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>TDtools API settings saved & synchronized! Diagrams have been updated.</span>
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                      <span>{saveError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      TDtools API URL
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://tdtools.co.uk/roster/api_diagram.php"
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      The full URL to <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">api_diagram.php</code> hosted in your TDtools directory.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Secret API Token (Bearer Token)
                      </label>
                      {hasToken && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                          Current Token Active ({tokenPreview})
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={hasToken ? "Enter new token to overwrite..." : "e.g. tdtools_allocator_secure_token_2025"}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      The secret token configured in <code className="font-mono">api_diagram.php</code> on your TDtools server.
                    </p>
                  </div>

                  {/* Actions & Diagnostics */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving || !url.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span>Save & Synchronize Diagrams Now</span>
                    </button>
                  </div>

                  {/* Live Test Diagnostic Output */}
                  {testResult && (
                    <div className={`mt-3 p-4 rounded-xl border text-xs space-y-3 ${
                      testResult.success
                        ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                        : 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                    }`}>
                      <div className="flex items-center justify-between font-bold pb-2 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          {testResult.success ? (
                            <>
                              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-700 dark:text-emerald-400">Connection & Diagnostics Report</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <span>Connection Check Failed</span>
                            </>
                          )}
                        </div>
                        {testResult.responseTimeMs !== undefined && (
                          <span className="text-[11px] font-mono text-slate-500">{testResult.responseTimeMs}ms</span>
                        )}
                      </div>

                      {/* 1. Diagrams Catalog Diagnostic */}
                      <div className="space-y-1.5">
                        <div className="font-semibold text-xs flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            Diagrams Catalog (r_jobs, r_jobs_stp, r_jobs_headcodes):
                          </span>
                          {testResult.catalog?.success ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {testResult.catalog.totalJobs} diagrams loaded
                            </span>
                          ) : (
                            <span className="text-red-500 font-bold">Error</span>
                          )}
                        </div>

                        {testResult.catalog?.counts && (
                          <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] space-y-1 font-mono">
                            <div className="flex justify-between">
                              <span>• LTP Diagrams (r_jobs):</span>
                              <strong className="text-blue-600 dark:text-blue-400">{testResult.catalog.counts.ltp ?? 0}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>• STP Diagrams (r_jobs_stp):</span>
                              <strong className="text-purple-600 dark:text-purple-400">{testResult.catalog.counts.stp ?? 0}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>• Headcode Mappings (r_jobs_headcodes):</span>
                              <strong className="text-emerald-600 dark:text-emerald-400">{testResult.catalog.headcodesCount ?? 0}</strong>
                            </div>
                            {testResult.catalog.sampleJobs && testResult.catalog.sampleJobs.length > 0 && (
                              <div className="pt-1 text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
                                Sample diagrams: {testResult.catalog.sampleJobs.join(', ')}...
                              </div>
                            )}
                          </div>
                        )}

                        {testResult.catalog?.dbErrors && (
                          <div className="p-2 rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 font-mono text-[10px]">
                            <strong>Database Error:</strong> {JSON.stringify(testResult.catalog.dbErrors)}
                          </div>
                        )}

                        {testResult.catalog?.tablesFound && testResult.catalog.tablesFound.length > 0 && (
                          <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 font-mono text-[10px]">
                            <strong>Discovered MySQL Tables:</strong> {testResult.catalog.tablesFound.join(', ')}
                          </div>
                        )}

                        {testResult.catalog?.rawError && (
                          <div className="text-[11px] text-red-600 dark:text-red-400">
                            {testResult.catalog.rawError}
                          </div>
                        )}
                      </div>

                      {/* 2. Driver Allocation Lookup Diagnostic */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="font-semibold text-xs flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            Driver Lookup Test (r_daily_allocation & getJobInfo):
                          </span>
                          {testResult.lookup?.success ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Passed</span>
                          ) : (
                            <span className="text-amber-500 font-medium">No record</span>
                          )}
                        </div>

                        {testResult.lookup && (
                          <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-0.5">
                            <div>Driver: <strong className="text-slate-900 dark:text-slate-100">{testResult.lookup.driverName || 'None scheduled for sample'}</strong></div>
                            <div>Depot: <strong className="text-slate-900 dark:text-slate-100">{testResult.lookup.depot || 'N/A'}</strong></div>
                            <div>PDF Page: <strong className="text-slate-900 dark:text-slate-100">{testResult.lookup.pdfname || 'N/A'} (Page {testResult.lookup.page || '1'})</strong></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    api_diagram.php for TDtools
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Upload this script to your TDtools server in the <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">roster/</code> folder alongside <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">diagram.php</code>.
                  </p>
                </div>
                <button
                  onClick={copyPhpCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  {copiedPhp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPhp ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 p-4 font-mono text-[11px] max-h-80 overflow-y-auto">
                <pre>{phpSnippet}</pre>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <div className="font-semibold">Key Capabilities:</div>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li><strong>Full Catalog Synchronization:</strong> Serves <code className="font-mono">r_jobs</code> (LTP), <code className="font-mono">r_jobs_stp</code> (STP), and <code className="font-mono">r_jobs_headcodes</code> via <code className="font-mono">?action=diagrams</code>, eliminating daily CSV manual exports.</li>
                  <li><strong>High-Speed 1-Year Query Limit:</strong> Restricts queries to <code className="font-mono">WHERE `from` &gt;= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)</code> to match your fast CSV export process.</li>
                  <li><strong>Resilient Queries:</strong> Uses <code className="font-mono">SELECT *</code> to prevent query crashes if specific columns differ across TDtools setups.</li>
                  <li><strong>Admin Driver Access on TDtools:</strong> Sets <code className="font-mono">$_admin = true;</code> on the TDtools PHP side to expose driver contact & depot information from <code className="font-mono">r_daily_allocation</code>.</li>
                  <li><strong>Live Diagram PDF & Page:</strong> Automatically resolves <code className="font-mono">pdfname</code> and <code className="font-mono">pdfpage</code> so diagram preview images render on the fly.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
