<?php
/**
 * TDtools Unified Diagrams, Roster & Driver Allocation API
 * File: api_diagram.php (place in your roster/ directory e.g. roster/api_diagram.php)
 * 
 * Provides authenticated, secure access for the Train Driver Instructor Job Allocator:
 *  1. Authenticates request via Bearer token or ?token= query parameter.
 *  2. Exposes r_jobs (LTP), r_jobs_stp (STP), and r_jobs_headcodes directly via API (?action=diagrams).
 *  3. Treats the secured API connection as Admin on the TDTools side ($_admin = true) to retrieve driver name & depot.
 *  4. Retrieves live diagram metadata (pdfname, pdfpage, STP/LTP status, image URL) via getJobInfo().
 *  5. Eliminates the need to export CSVs or PDFs daily into the allocator.
 */

// 1. HTTP Headers & CORS (Allows Allocator app to query securely)
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Api-Token');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Secret Token Configuration
// CHANGE THIS to your shared secret token (must match the token configured in the Allocator)
define('TDTOOLS_API_SECRET', 'tdtools_allocator_secure_token_2025');

// 3. Authenticate incoming request
$authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
$token = '';

if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
    $token = $matches[1];
} elseif (isset($_GET['token']) && !empty($_GET['token'])) {
    $token = $_GET['token'];
} elseif (isset($_SERVER['HTTP_X_API_TOKEN']) && !empty($_SERVER['HTTP_X_API_TOKEN'])) {
    $token = $_SERVER['HTTP_X_API_TOKEN'];
}

if (empty($token) || !hash_equals(TDTOOLS_API_SECRET, $token)) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized: Invalid or missing API token.'
    ]);
    exit();
}

// 4. Treat the Allocator API connection as Admin on the TDTools side
global $_admin, $link;
$_admin = true;

// 5. Initialize TDtools core environment and database connection
$type = "open";
if (file_exists(__DIR__ . '/autoload.php')) {
    require_once __DIR__ . '/autoload.php';
} elseif (file_exists(__DIR__ . '/../autoload.php')) {
    require_once __DIR__ . '/../autoload.php';
}

// Enforce admin permission on TDtools side for data access
$_admin = true;

// Fallback: If $link is not set, look for alternative database connection variables in global scope
if (empty($link)) {
    if (isset($GLOBALS['link'])) {
        $link = $GLOBALS['link'];
    } elseif (isset($GLOBALS['db']) && $GLOBALS['db'] instanceof mysqli) {
        $link = $GLOBALS['db'];
    } elseif (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
        $link = $GLOBALS['conn'];
    } elseif (isset($GLOBALS['mysqli']) && $GLOBALS['mysqli'] instanceof mysqli) {
        $link = $GLOBALS['mysqli'];
    }
}

// Base URL resolution
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'tdtools.co.uk';
$rosterPath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\') . '/';
$baseUrl = $protocol . $host . $rosterPath;

// Determine requested action
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

// -------------------------------------------------------------------------------------------------
// ACTION: DIAGRAMS / JOBS / CATALOG (Fetch r_jobs, r_jobs_stp, and r_jobs_headcodes)
// -------------------------------------------------------------------------------------------------
if ($action === 'diagrams' || $action === 'jobs' || $action === 'all' || (!isset($_GET['name']) && !isset($_GET['job']))) {
    $r_jobs = [];
    $r_jobs_stp = [];
    $headcodesMap = [];
    $raw_headcodes = [];
    $dbErrors = [];
    $tablesFound = [];
    $identifierQuote = chr(96);
    $queryErrors = [];
    $safeQuery = function ($label, $sql) use ($link, &$queryErrors) {
        try {
            return $link->query($sql);
        } catch (Throwable $e) {
            $queryErrors[$label] = $e->getMessage();
            return false;
        }
    };

    if (!empty($link)) {
        // Query LTP jobs (strictly last 1 year; excludes NULL dates and old 2021 bundles)
        $resLtp = $safeQuery('r_jobs', "SELECT * FROM {$identifierQuote}r_jobs{$identifierQuote} WHERE {$identifierQuote}from{$identifierQuote} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
        if (!$resLtp) {
            $resLtp = $safeQuery('jobs', "SELECT * FROM {$identifierQuote}jobs{$identifierQuote} WHERE {$identifierQuote}from{$identifierQuote} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
            if (!$resLtp) {
                $dbErrors['r_jobs'] = [
                    'r_jobs' => $queryErrors['r_jobs'] ?? $link->error,
                    'jobs' => $queryErrors['jobs'] ?? $link->error
                ];
            }
        }

        if ($resLtp) {
            while ($row = $resLtp->fetch_assoc()) {
                $jobName = $row['name'] ?? $row['diagram'] ?? $row['job_name'] ?? $row['job'] ?? $row['jobnumber'] ?? $row['job_number'] ?? '';
                if (empty($jobName)) continue;

                $fromDate = $row['from'] ?? $row['valid_from'] ?? $row['bfrom'] ?? null;
                if (empty($fromDate)) continue;
                if (isset($row['bundle']) && strpos((string)$row['bundle'], '2021') !== false) continue;
                if (isset($row['pdfname']) && strpos((string)$row['pdfname'], '2021') !== false) continue;

                $r_jobs[] = [
                    'jobid' => (string)($row['jobid'] ?? $row['id'] ?? $row['job_id'] ?? $row['jid'] ?? ''),
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
        $resStp = $safeQuery('r_jobs_stp', "SELECT * FROM {$identifierQuote}r_jobs_stp{$identifierQuote} WHERE {$identifierQuote}from{$identifierQuote} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
        if (!$resStp) {
            $resStp = $safeQuery('jobs_stp', "SELECT * FROM {$identifierQuote}jobs_stp{$identifierQuote} WHERE {$identifierQuote}from{$identifierQuote} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
            if (!$resStp) {
                $dbErrors['r_jobs_stp'] = [
                    'r_jobs_stp' => $queryErrors['r_jobs_stp'] ?? $link->error,
                    'jobs_stp' => $queryErrors['jobs_stp'] ?? $link->error
                ];
            }
        }

        if ($resStp) {
            while ($row = $resStp->fetch_assoc()) {
                $jobName = $row['name'] ?? $row['diagram'] ?? $row['job_name'] ?? $row['job'] ?? $row['jobnumber'] ?? $row['job_number'] ?? '';
                if (empty($jobName)) continue;

                $fromDate = $row['from'] ?? $row['valid_from'] ?? $row['start'] ?? null;
                if (empty($fromDate)) continue;
                if (isset($row['bundle']) && strpos((string)$row['bundle'], '2021') !== false) continue;
                if (isset($row['pdfname']) && strpos((string)$row['pdfname'], '2021') !== false) continue;

                $isCancelled = false;
                if (isset($row['cancel']) && ($row['cancel'] == '1' || $row['cancel'] === true || $row['cancel'] === 1)) $isCancelled = true;
                if (isset($row['cancelled']) && ($row['cancelled'] == '1' || $row['cancelled'] === true || $row['cancelled'] === 1)) $isCancelled = true;

                $r_jobs_stp[] = [
                    'jobid' => (string)($row['jobid'] ?? $row['id'] ?? $row['job_id'] ?? $row['jid'] ?? ''),
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
        $resHc = $safeQuery('r_jobs_headcodes', "SELECT * FROM r_jobs_headcodes");
        if (!$resHc) {
            $resHc = $safeQuery('jobs_headcodes', "SELECT * FROM jobs_headcodes");
            if (!$resHc) {
                $dbErrors['r_jobs_headcodes'] = $queryErrors['jobs_headcodes'] ?? $queryErrors['r_jobs_headcodes'] ?? $link->error;
            }
        }

        if ($resHc) {
            while ($row = $resHc->fetch_assoc()) {
                $raw_headcodes[] = $row;
                $ltp_id = $row['ltp_id'] ?? $row['ltpId'] ?? $row['ltp'] ?? null;
                $stp_id = $row['stp_id'] ?? $row['stpId'] ?? $row['stp'] ?? null;
                $job_id = $row['jobid'] ?? $row['job_id'] ?? null;
                $hcVal = $row['headcodes'] ?? $row['headcode'] ?? null;

                $parsedHcs = [];
                if (is_string($hcVal)) {
                    $decoded = json_decode($hcVal, true);
                    if (is_array($decoded)) {
                        $parsedHcs = $decoded;
                    } else {
                        // Fallback if comma-separated
                        $parsedHcs = array_filter(array_map('trim', explode(',', $hcVal)));
                    }
                } elseif (is_array($hcVal)) {
                    $parsedHcs = $hcVal;
                }

                if (!empty($ltp_id) && $ltp_id !== 'NULL') {
                    $headcodesMap["ltp_{$ltp_id}"] = array_values($parsedHcs);
                }
                if (!empty($stp_id) && $stp_id !== 'NULL') {
                    $headcodesMap["stp_{$stp_id}"] = array_values($parsedHcs);
                }
                if (!empty($job_id) && $job_id !== 'NULL') {
                    $headcodesMap["ltp_{$job_id}"] = array_values($parsedHcs);
                    $headcodesMap["stp_{$job_id}"] = array_values($parsedHcs);
                }
            }
            $resHc->free();
        }

        // Diagnostics: check available tables in MySQL if errors or 0 jobs found
        if (!empty($dbErrors) || (count($r_jobs) === 0 && count($r_jobs_stp) === 0)) {
            $resTables = $safeQuery('show_tables', "SHOW TABLES");
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
        $dbErrors['connection'] = 'MySQL connection $link is null or not initialized by autoload.php';
    }

    $allJobs = array_merge($r_jobs, $r_jobs_stp);
    usort($allJobs, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });

    echo json_encode([
        'success' => count($dbErrors) === 0 || count($allJobs) > 0,
        'action' => 'diagrams',
        'jobs' => $allJobs,
        'headcodesMap' => (object)$headcodesMap,
        'counts' => [
            'ltp' => count($r_jobs),
            'stp' => count($r_jobs_stp),
            'headcodes' => count($raw_headcodes),
            'total_jobs' => count($allJobs)
        ],
        'sample_jobs' => array_slice(array_map(function($j) { return $j['name']; }, $allJobs), 0, 8),
        'db_errors' => !empty($dbErrors) ? $dbErrors : null,
        'tables_found' => !empty($tablesFound) ? $tablesFound : null
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit();
}

// -------------------------------------------------------------------------------------------------
// ACTION: SINGLE DIAGRAM & DRIVER LOOKUP (When a diagram is selected from the dropdown)
// -------------------------------------------------------------------------------------------------
$diagramName = '';
if (isset($_GET['name']) && !empty(trim($_GET['name']))) {
    $diagramName = trim($_GET['name']);
} elseif (isset($_GET['job']) && !empty(trim($_GET['job']))) {
    $diagramName = trim($_GET['job']);
}

$dateInput = isset($_GET['date']) && !empty(trim($_GET['date'])) ? trim($_GET['date']) : date('Y-m-d');
$searchDate = date('Y-m-d', strtotime($dateInput));

// 1. Diagram Lookup via TDtools internal engine (getJobInfo)
$jobs = function_exists('getJobInfo') ? getJobInfo($diagramName, $searchDate) : [];
$selectedJob = null;

if (!empty($jobs)) {
    foreach ($jobs as $j) {
        if (strtoupper($j['name']) === strtoupper($diagramName)) {
            $selectedJob = $j;
            break;
        }
    }
    if (!$selectedJob) {
        $selectedJob = $jobs[0];
    }
}

// 2. Driver Name and Depot Lookup from r_daily_allocation or r_weekly_allocation (Admin access on TDtools)
$allocation = null;
$allocType = null;
if (!empty($link) && !empty($diagramName)) {
    preg_match('/\d+/', $diagramName, $numMatches);
    $baseJobNumber = isset($numMatches[0]) ? $numMatches[0] : $diagramName;
    $jobSearchWildcard = "%" . $baseJobNumber . "%";

    // A. Check r_daily_allocation
    $sqlAlloc = "SELECT * FROM r_daily_allocation WHERE alloc_date = ? AND job_number LIKE ?";
    if ($stmtAlloc = @$link->prepare($sqlAlloc)) {
        $stmtAlloc->bind_param("ss", $searchDate, $jobSearchWildcard);
        $stmtAlloc->execute();
        $resAlloc = $stmtAlloc->get_result();
        $preferredAllocRow = null;
        if ($resAlloc) {
            while ($candidateAllocRow = $resAlloc->fetch_assoc()) {
                if ($preferredAllocRow === null) {
                    $preferredAllocRow = $candidateAllocRow;
                    continue;
                }
                $candidateJobNumber = strtoupper(trim((string)($candidateAllocRow['job_number'] ?? '')));
                $preferredJobNumber = strtoupper(trim((string)($preferredAllocRow['job_number'] ?? '')));
                $candidateIsExactJob = ($candidateJobNumber === strtoupper($diagramName) || $candidateJobNumber === strtoupper($baseJobNumber));
                $preferredIsExactJob = ($preferredJobNumber === strtoupper($diagramName) || $preferredJobNumber === strtoupper($baseJobNumber));
                $candidateIsDaily = array_key_exists('is_daily', $candidateAllocRow) && (int)$candidateAllocRow['is_daily'] === 1;
                $preferredIsDaily = array_key_exists('is_daily', $preferredAllocRow) && (int)$preferredAllocRow['is_daily'] === 1;
                if (($candidateIsDaily && !$preferredIsDaily) ||
                    ($candidateIsDaily === $preferredIsDaily && $candidateIsExactJob && !$preferredIsExactJob)) {
                    $preferredAllocRow = $candidateAllocRow;
                }
            }
        }
        if ($preferredAllocRow) {
            $allocRow = $preferredAllocRow;
            $allocation = $allocRow;
            if (array_key_exists('is_daily', $allocRow)) {
                $allocType = ((int)$allocRow['is_daily'] === 1) ? 'Daily' : 'Weekly';
            } else {
                $typeField = strtolower($allocRow['type'] ?? $allocRow['alloc_type'] ?? $allocRow['source'] ?? $allocRow['roster_type'] ?? '');
                $allocType = (strpos($typeField, 'week') !== false) ? 'Weekly' : 'Daily';
            }
        }
        $stmtAlloc->close();
    }

    // B. If not found in daily allocation, check r_weekly_allocation
    if (!$allocation) {
        $sqlWeekly = "SELECT * FROM r_weekly_allocation WHERE alloc_date = ? AND job_number LIKE ? LIMIT 1";
        if ($stmtWeekly = @$link->prepare($sqlWeekly)) {
            $stmtWeekly->bind_param("ss", $searchDate, $jobSearchWildcard);
            $stmtWeekly->execute();
            $resWeekly = $stmtWeekly->get_result();
            if ($resWeekly && $allocRowWeekly = $resWeekly->fetch_assoc()) {
                $allocation = $allocRowWeekly;
                $allocType = 'Weekly';
            }
            $stmtWeekly->close();
        }
    }
}

// 3. Construct Diagram Output & Image / PDF URLs
$diagramPayload = null;
if ($selectedJob) {
    $pdfname = isset($selectedJob['pdfname']) ? $selectedJob['pdfname'] : '';
    $pdfpage = isset($selectedJob['pdfpage']) ? (int)$selectedJob['pdfpage'] : 1;
    $isCancelled = !empty($selectedJob['cancel']);
    $isStp = (isset($selectedJob['ptype']) && strtolower($selectedJob['ptype']) === 'stp') || 
             (isset($selectedJob['type']) && strtoupper($selectedJob['type']) === 'STP');

    $diagramPayload = [
        'name' => $selectedJob['name'],
        'ptype' => isset($selectedJob['ptype']) ? $selectedJob['ptype'] : 'ltp',
        'isStp' => $isStp,
        'cancelled' => $isCancelled,
        'pdfname' => $pdfname,
        'pdfpage' => $pdfpage,
        'tag' => isset($selectedJob['tag']) ? $selectedJob['tag'] : '',
        'bundledisplay' => isset($selectedJob['bundledisplay']) ? $selectedJob['bundledisplay'] : '',
        'imageUrl' => $baseUrl . 'diagramimg.php?pdfname=' . urlencode($pdfname) . '&page=' . $pdfpage,
        'pdfUrl' => $baseUrl . 'pdfs/' . urlencode($pdfname) . '#page=' . $pdfpage,
        'from' => isset($selectedJob['from']) ? $selectedJob['from'] : null,
        'to' => isset($selectedJob['to']) ? $selectedJob['to'] : null,
        'daycode' => isset($selectedJob['daycode']) ? $selectedJob['daycode'] : ''
    ];
}

// 4. Send unified JSON response
echo json_encode([
    'success' => true,
    'found' => ($selectedJob !== null || $allocation !== null),
    'query' => [
        'name' => $diagramName,
        'date' => $searchDate
    ],
    'diagram' => $diagramPayload,
    'allocation' => $allocation,
    'allocType' => $allocType ?: 'Daily',
    'driverName' => $allocation ? ($allocation['driver_name'] ?? $allocation['driver'] ?? $allocation['name'] ?? null) : null,
    'depot' => $allocation ? ($allocation['depot'] ?? null) : null,
    'pdfname' => $diagramPayload ? $diagramPayload['pdfname'] : null,
    'page' => $diagramPayload ? $diagramPayload['pdfpage'] : null,
    'imageUrl' => $diagramPayload ? $diagramPayload['imageUrl'] : null
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
