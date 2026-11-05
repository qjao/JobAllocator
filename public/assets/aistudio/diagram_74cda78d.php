<?php

$type="open";
require_once __DIR__.'/../autoload.php';


//diagram.php

//redirect old links

//?date=DATE&diagram=DIAGRAMNAME&cal=1
if (isset($_GET['cal'])){
	if (isset($_GET['date']) && isset($_GET['diagram'])) {
		$date=date('Y-m-d', strtotime($_GET['date']));
		header("Location: ?action=date&name={$_GET['diagram']}&date={$date}");
		exit();
	}
}

//

function printJob($job, $meta, $image=true, $link=false) {
	//prints a job. if image is false, does not generate the PDF image. if $link is true, linkifies the name (for search results)
	//meta is array(searchtype => bundle/date, searchdate=>date, searchbundle=>bundle, searchname=>name)

	if ($job['ptype']=='ltp'){
		$color='#cfe2ff';
	} else {
		$color='#f8d7da';
	}

	$su="fw-lighter table-danger";
	$mo="fw-lighter table-danger";
	$tu="fw-lighter table-danger";
	$we="fw-lighter table-danger";
	$th="fw-lighter table-danger";
	$fr="fw-lighter table-danger";
	$sa="fw-lighter table-danger";

	if (str_contains($job['daycode'], "M")) {$mo="fw-normal table-success";};
	if (str_contains($job['daycode'], "T")) {$tu="fw-normal table-success";};
	if (str_contains($job['daycode'], "W")) {$we="fw-normal table-success";};
	if (str_contains($job['daycode'], "V")) {$th="fw-normal table-success";};
	if (str_contains($job['daycode'], "F")) {$fr="fw-normal table-success";};
	if (str_contains($job['daycode'], "S")) {$sa="fw-normal table-success";};
	if (str_contains($job['daycode'], "X")) {$su="fw-normal table-success";};


	echo '<div class="border rounded border-dark mb-2" >';

	echo '<div class="row gx-0" >';

		echo '<div class="col-auto pt-3 px-2 rounded" style="background-color: '.$color.'">';
		if ($job['ptype']=='ltp') {
			echo 'LTP';
		} else {
			echo 'STP';
		}
		echo '</div>';
		echo '<div class="col p-2">';
		if ($link && $job['ptype']=='ltp') {
			echo '<a href="?action=bundle&name='.$job['name'].'&bundle='.$job['bundle'].'">';
			echo '<h5 class="my-0 fw-bold">Diagram&nbsp;'.$job['name'].'</h5>';
			echo '</a>';

		} elseif ($link && $job['ptype']=='stp') {
			echo '<a href="?action=date&name='.$job['name'].'&date='.$meta['date'].'">';
			echo '<h5 class="my-0 fw-bold">Diagram&nbsp;'.$job['name'].'</h5>';
			echo '</a>';


		} else {
			echo '<h5 class="my-0 fw-bold">Diagram&nbsp;'.$job['name'].'</h5>';

		}
		echo '<div class="my-0 py-0">';

		if ($job['ptype']=='stp') {
			echo date("d/m/Y", strtotime($meta['searchdate']));
		} else {
			echo $job['bundledisplay'];
		}
		echo '</div>';
		if ($job['ptype']=='ltp'){
			//Check if LTP bundledisplay matches the job tag (this is the PDF tag)
			if ($job['tag'] != $job['bundledisplay']) {
				echo '<div class="my-0 py-0 fs-6 fw-lighter">'.$job['tag'].'</div>';
			}
		} else {
			echo '<div class="my-0 py-0 fs-6 fw-lighter">'.$job['tag'].'</div>';
		}

		if (!empty($job['jobid'])) {
            $pnbData = getPNBLocations($job['jobid'], $job['ptype']);
            if ($pnbData) {
                // Calculate duration
                $start = strtotime($pnbData['arrive']);
                $end   = strtotime($pnbData['depart']);

                // Handle midnight crossing
                if ($end < $start) {
                    $end += 86400; 
                }

                $diff = $end - $start;
                $hours = floor($diff / 3600);
                $mins = floor(($diff % 3600) / 60);

                $durStr = ($hours > 0) ? "{$hours}h {$mins}m" : "{$mins}m";
                
                // Format times to remove seconds (H:i)
                $arrTime = date('H:i', $start);
                $depTime = date('H:i', $end);

                // Display
                echo '<div class="my-0 py-0 fs-6 fw-lighter">';
                echo 'PNB: '. $durStr .' (' . $arrTime . '-' . $depTime . ')';
                echo '</div>';
            }
        }

        // --- NEW: Admin Driver & Depot Display ---
        global $_admin, $link; 
        
        // Only run the query if the user is an admin AND we have a specific date to search against
        if (!empty($_admin) && !empty($meta['searchdate'])) {
            
            // Extract JUST the numbers from the diagram name (e.g., "AW1104" becomes "1104")
            preg_match('/\d+/', $job['name'], $matches);
            $baseJobNumber = isset($matches[0]) ? $matches[0] : trim($job['name']);
            
            // Search with wildcards so "1104" will perfectly match "MH 1104", "OC 1104", or "1104"
            $jobSearchWildcard = "%" . $baseJobNumber . "%";
            
            $sqlAlloc = "SELECT driver_name, depot FROM r_daily_allocation WHERE alloc_date = ? AND job_number LIKE ? LIMIT 1";
            
            if ($stmtAlloc = $link->prepare($sqlAlloc)) {
                $stmtAlloc->bind_param("ss", $meta['searchdate'], $jobSearchWildcard);
                $stmtAlloc->execute();
                $resAlloc = $stmtAlloc->get_result();
                
                if ($resAlloc && $allocRow = $resAlloc->fetch_assoc()) {
                    // Match the PNB formatting exactly (light font, no margins, separated lines)
                    echo '<div class="my-0 py-0 fs-6 fw-lighter">';
                    echo 'Driver: ' . htmlspecialchars($allocRow['driver_name']);
                    echo '</div>';
                    echo '<div class="my-0 py-0 fs-6 fw-lighter">';
                    echo 'Depot: ' . htmlspecialchars($allocRow['depot']);
                    echo '</div>';
                }
                $stmtAlloc->close();
            }
        }
        // -----------------------------------------


		echo '</div>';

		echo '<div class="col-auto mb-2 mt-0 mx-auto text-end">';

		echo '<table class="table table-borderless table-sm mb-0">';
		#echo '<tr class="text-center">';
		#echo '<td colspan="7">';
		#echo '';
		#echo '</td>';
		#echo '</tr>';

		echo '<tbody style="font-size: 0.7rem;">';

		echo '<tr class="text-center">';
		echo '<td class="'.$su.' rounded-start">Su</td>';
		echo '<td class="'.$mo.'">M</td>';
		echo '<td class="'.$tu.'">T</td>';
		echo '<td class="'.$we.'">W</td>';
		echo '<td class="'.$th.'">T</td>';
		echo '<td class="'.$fr.'">F</td>';
		echo '<td class="'.$sa.' rounded-end">Sa</td>';
		echo '</tr>';

		echo '</tbody>';

		echo '</table>';
		if ($job['from'] && $job['to']) {
			echo '<small class="fw-light px-1" style="font-size: 0.6rem;"><b>'.date("d/m/Y", strtotime($job['from'])).' - '.date("d/m/Y", strtotime($job['to'])).'</b></small>';
		}


		echo '</div>';

	echo '</div>';

	if ($image) {
		if ($job['type']=='STP' && $job['cancel']) {
			echo '<div class="row gx-0 p-4">';
			echo '<div class="col text-center">';
			echo 'CANCELLED';
			echo '</div>';
			echo '</div>';
		} else {
			echo '<div class="row gx-0 p-0">';
			echo '<div class="col">';
            echo '<img class="img-fluid" src="diagramimg.php?pdfname='.$job['pdfname'].'&page='.$job['pdfpage'].'">';
			echo '</div>';
			echo '</div>';

		}
	}


	echo '</div>';
}

if (isset($_GET['action'])) {
	if ($_GET['action']=='find') {
		$pageinfo=array(
				'title' => 'Find a diagram', 
				'nav' => false,
				'buttons' => false,
			);
		include_once HEADER;

		echo '<div class="row">';
		echo '<div class="col-lg-6 offset-lg-3">';

		printPageTop($pageinfo);

		echo '<form method="GET">';

		echo '<div class="mb-3">';
		echo '<input type="text" name="name" class="form-control" required maxlength="8" placeholder="Search">';
		echo '</div>';


		echo '<div class="row">';
		echo '<div class="col-sm">';
		// LHS - pick a date

		echo '<div class="input-group">';
		$today=date('Y-m-d');
		$tomorrow=date("Y-m-d", strtotime("tomorrow"));


		echo '<input class="form-control" name="date" type="date" id="date" value="'.$today.'">';

		echo '<button type="button" class="btn btn-outline-secondary px-1" style="padding-top: 0.65rem; padding-bottom: 0.55rem;" onclick="fillToday()"><div style="font-size: 0.7rem;">Today</div></button>';
		echo '<button type="button" class="btn btn-outline-secondary px-1" style="padding-top: 0.65rem; padding-bottom: 0.55rem;" onclick="fillTomorrow()"><div style="font-size: 0.7rem;">Tomorrow</div></button>';

		echo '</div>';

		echo '<div class="d-grid">';
		echo '<button type="submit" name="action" value="search-date" class="my-3 btn btn-primary">Seach by date</button>';
		echo '</div>';
		echo '</div>';

		echo '</form>';

		$_footExtra .= '
		<script>


		function fillToday(){
			document.getElementById("date").value="'.$today.'";
		}
		function fillTomorrow(){
		  	document.getElementById("date").value="'.$tomorrow.'";
		}

		</script>';


		echo '<div class="col-sm">';
		// RHS - pick a bundle
		$bundles=getAllBundles($_toc);

		echo '<select class="form-select" name="bundle">';
		foreach ($bundles as $bundle) {
			echo '<option value="'.$bundle['bundle'].'">'.$bundle['bundledisplay'].'</option>';
		}
		echo '</select>';

		echo '<div class="d-grid">';
		echo '<button type="submit" name="action" value="search-diagram" class="my-3 btn btn-primary">Seach by LTP diagrams</button>';
		echo '</div>';
		echo '</div>';

		echo '</div>';

		echo '</form>';

		echo '<hr/>';

		$pdfdir=DOCROOT.'pdfs/';
		$filelist=array_diff(scandir($pdfdir), array('..', '.'));
		$ltps = getLTPPDFs();
		$stps = getSTPPDFs();


		echo '<div class="mb-2 px-0 border rounded bg-light text-center">';
		echo '<h5 class="my-1">LTP PDFs</h3>';
		echo '</div>';

		echo '<table id="LTPs" class="table table-striped table-sm">';
		echo '<thead>';
		echo '<tr>';

		echo '<th>';
		echo 'Period';
		echo '</th>';

		echo '<th>';
		echo 'Start date';
		echo '</th>';

		echo '</tr>';
		echo '</thead>';

		echo '<tbody>';

		foreach ($ltps as $pdf=>$arr) {
			$bundle=$arr['bundle'];
			$meta=getJobsMeta($bundle);
			$toc=getTOC($meta['toc']);
			$tag=$arr['tag'];

			if ($toc['code']!=$_toc) {
				continue;
			}

			echo '<tr>';


			echo '<td>';
			if (in_array($pdf, $filelist)) {
				echo '<a href="'.HTMLROOT.'pdfs/'.$pdf.'">'.$meta['bundledisplay'].'</a>';
			} else {
				echo $meta['bundledisplay'];
			}
			if (!empty($tag)) {
				echo ' ('.$tag.')';
			}
			echo '</td>';


			echo '<td>';
			echo date('d/m/y', strtotime($meta['bfrom']));
			echo '</td>';

			echo '</tr>';
		}

		echo '</tbody>';
		echo '</table>';
	


		echo '<hr/>';



		echo '<div class="mb-2 px-0 border rounded bg-light text-center">';
		echo '<h5 class="my-1">STP PDFs</h3>';
		echo '</div>';
	

		echo '<table id="STPs" class="table table-striped table-sm">';
		echo '<thead>';
		echo '<tr>';

		echo '<th>';
		echo 'Period';
		echo '</th>';

		echo '<th>';
		echo 'Start date';
		echo '</th>';

		echo '</tr>';
		echo '</thead>';

		echo '<tbody>';




		foreach ($stps as $pdf=>$arr) {
			$from=date('D dS M Y', strtotime($arr['from']));
			$to=date('D dS M Y', strtotime($arr['to']));
			$toc=getTOC($arr['toc']);
			$tag=$arr['tag'];

			if ($toc['code']!=$_toc) {
				continue;
			}

			if ($from==$to) {
				$date=$from;
			} else {
				$date=$from.' - '.$to;
			}

			echo '<tr>';


			echo '<td>';
			if (in_array($pdf, $filelist)) {
				echo '<a href="'.HTMLROOT.'pdfs/'.$pdf.'">'.$date.'</a>';
			} else {
				echo $date;
			}

			if (!empty($tag)) {
				echo ' ('.$tag.')';
			}

			echo '</td>';


			echo '<td>';
			echo date('d/m/y', strtotime($arr['from']));

			echo '</td>';

			echo '</tr>';
		}

		echo '</tbody>';
		echo '</table>';


		$_footExtra.="
		<script type='text/javascript' src='https://cdn.datatables.net/plug-ins/1.13.1/sorting/date-uk.js'></script>
		<script>
		$(document).ready(function () {
		    $('#LTPs').DataTable({
		    	'searching': false,
		    	'lengthChange': false,
		    	'pageLength': 5,
		    	'aaSorting': [[1, 'desc']],
		    	columnDefs: [
		    	       { type: 'date-uk', targets: 1 },
		    	       { orderable: false, targets: 0 }

		    	     ]
		    	});

		    $('#STPs').DataTable({
		    	'searching': false,
		    	'lengthChange': false,
		    	'pageLength': 6,
		    	'aaSorting': [[1, 'desc']],
		    	columnDefs: [
		    	       { type: 'date-uk', targets: 1 },
		    	       { orderable: false, targets: 0 }

		    	     ]
		    	});
		    
		});

		</script>";

		include_once FOOTER;
	}
	if ($_GET['action']=='search-diagram') {
		//clean up GET fields
		if (isset($_GET['bundle']) && isset($_GET['name'])){
			header("Location: ?action=bundle&bundle={$_GET['bundle']}&name={$_GET['name']}");
			exit();
		} else {
			header("Location: ?action=find");
			exit();
		}
	}
	if ($_GET['action']=='search-date') {
			//clean up GET fields
		if (isset($_GET['date']) && isset($_GET['name'])){
			header("Location: ?action=date&date={$_GET['date']}&name={$_GET['name']}");
			exit();

		} else {
			header("Location: ?action=find");
			exit();
		}
	} 
	if ($_GET['action']=='date') {
		//searching by DATE


		if (isset($_GET['date']) && validateDate($_GET['date'])) {
			if (isset($_GET['name'])) {

				$pageinfo=array(
						'title' => 'Diagram search: '.$_GET['name']. ' on '.date('d/m/y', strtotime($_GET['date'])), 
						'nav' => false,
						'buttons' => false,
					);
				include_once HEADER;

				$jobs=getJobInfo($_GET['name'], $_GET['date']);
				if (count($jobs)==0) {
					generateCustomFeedback(array("type" => "error", "text" => 'No jobs found', "buttons" => array("Back" => "?action=find")));

				} else {
					//short DATE search bar
					echo '<form method="GET">';
					echo '<div class="row my-2 g-1">';

					echo '<div class="col-3">';
					echo '<input type="text" name="name" class="form-control" required maxlength="8" placeholder="Search">';
					echo '</div>';

					echo '<div class="col">';
					echo '<div class="input-group">';
					$today=date('Y-m-d');
					$tomorrow=date("Y-m-d", strtotime("tomorrow"));


					echo '<input class="form-control" name="date" type="date" id="date" value="'.$_GET['date'].'">';

					echo '<button type="button" class="btn btn-outline-secondary px-1" style="padding-top: 0.65rem; padding-bottom: 0.55rem;" onclick="fillToday()"><div style="font-size: 0.7rem;">Today</div></button>';
					echo '<button type="button" class="btn btn-outline-secondary px-1" style="padding-top: 0.65rem; padding-bottom: 0.55rem;" onclick="fillTomorrow()"><div style="font-size: 0.7rem;">Tomorrow</div></button>';
					echo '</div>';
					echo '</div>';

					echo '<div class="col-auto">';
					echo '<div class="d-grid">';
					echo '<button type="submit" name="action" value="date" class="btn btn-primary">Go</button>';
					echo '</div>';
					echo '</div>';

					echo '</div>';

					echo '</form>';

					$_footExtra .= '
					<script>


					function fillToday(){
						document.getElementById("date").value="'.$today.'";
					}
					function fillTomorrow(){
					  	document.getElementById("date").value="'.$tomorrow.'";
					}

					</script>';

					// END SHORT DATE

					$int=0;
					if (count($jobs)>1) {
						#more than one result, check names all the same else show intermediate page
						$name=$jobs[0]['name'];
						foreach ($jobs as $j) {
							if ($j['name']!=$name) {
								$int=1;
							}
						}
					}
					$meta= array('searchtype' => 'date', 
						'searchdate'=>$_GET['date'], 
						'searchbundle'=>false, 
						'searchname'=>$_GET['name']);
					if ($int==1) {
						foreach ($jobs as $job) {
							printJob($job, $meta, false, true);

						}
					} else {
						foreach ($jobs as $job) {
							printJob($job, $meta, true, false);

						}
					}
				}
	
			} else {
				$pageinfo=array(
						'title' => 'Not found', 
						'nav' => false,
						'buttons' => false,
					);
				include_once HEADER;

				generateCustomFeedback(array("type" => "error", "text" => 'No search term provided', "buttons" => array("Back" => false)));
			}
		} else {
			$pageinfo=array(
					'title' => 'Not a valid date', 
					'nav' => false,
					'buttons' => false,
				);
			include_once HEADER;
			generateCustomFeedback(array("type" => "error", "text" => 'Not a valid date', "buttons" => array("Back" => false)));
		}

		include_once FOOTER;
	}
	if ($_GET['action']=='bundle') {
		//searching by BUNDLE

		if (getJobsMeta($_GET['bundle'])) {
			//valid bundle
			if (isset($_GET['name'])) {
				$pageinfo=array(
						'title' => 'Diagram search: '.$_GET['name']. ' in bundle '.$_GET['bundle'], 
						'nav' => false,
						'buttons' => false,
					);
				include_once HEADER;
				$jobs=getLTPJob($_GET['name'], $_GET['bundle']);
				if (count($jobs)==0){
					generateCustomFeedback(array("type" => "error", "text" => 'No jobs found', "buttons" => array("Back" => "?action=find")));
				} else {
					//short BUNDLE search bar
					echo '<form method="GET">';
					echo '<div class="row my-2 g-1">';

					echo '<div class="col">';
					echo '<input type="text" name="name" min="1" class="form-control" required maxlength="8" placeholder="Search">';
					echo '</div>';

					echo '<div class="col">';
					$bundles=getAllBundles($_toc);
					$selected="";

					echo '<select class="form-select" name="bundle">';
					foreach ($bundles as $bundle) {
						if ($bundle['bundle']==$_GET['bundle']){$selected="selected ";} else {$selected="";}
						echo '<option value="'.$bundle['bundle'].'" '.$selected.'>'.$bundle['bundledisplay'].'</option>';
					}
					echo '</select>';
					echo '</div>';

					echo '<div class="col-auto">';
					echo '<div class="d-grid">';
					echo '<button type="submit" name="action" value="bundle" class="btn btn-primary">Go</button>';
					echo '</div>';
					echo '</div>';

					echo '</div>';

					echo '</form>';

					// END SHORT DATE
					$int=0;
					if (count($jobs)>1) {
						#more than one result, check names all the same else show intermediate page
						$name=$jobs[0]['name'];
						foreach ($jobs as $j) {
							if ($j['name']!=$name) {
								$int=1;
							}
						}
					}
					$meta= array('searchtype' => 'date', 
						'searchdate'=>false, 
						'searchbundle'=>$_GET['bundle'], 
						'searchname'=>$_GET['name']);
					if ($int==1) {
						foreach ($jobs as $job) {
							printJob($job, $meta, false, true);

						}
					} else {
						foreach ($jobs as $job) {
							printJob($job, $meta, true, false);

						}
					}
				}

				

			} else {
				$pageinfo=array(
						'title' => 'Not found', 
						'nav' => false,
						'buttons' => false,
					);
				include_once HEADER;
				generateCustomFeedback(array("type" => "error", "text" => 'No search term provided', "buttons" => array("Back" => false)));
			}
		} else {
			$pageinfo=array(
					'title' => 'Not a valid bundle', 
					'nav' => false,
					'buttons' => false,
				);
			include_once HEADER;
			generateCustomFeedback(array("type" => "error", "text" => 'Not a valid bundle', "buttons" => array("Back" => false)));
		}

		include_once FOOTER;
	}

	if (!headers_sent()) {
		header("Location: ?action=find");
		exit();
	}
}
if (!headers_sent()) {
	header("Location: ?action=find");
	exit();
}

?>
