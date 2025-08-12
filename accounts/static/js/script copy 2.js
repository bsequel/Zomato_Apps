$(document).ready(function () {




    // Global variables
    let allCases = [];
    let table;
    let userTable;
    let etlAutoInterval = null; // Store the interval ID
    const body = document.body;
    const username = body.dataset.username;
    const role = body.dataset.role;
    const defaultSection = $('.nav-link1.active').data('section');
    $('#activeSection').text(defaultSection);

    // ==== INIT FUNCTIONS ====
    initUserInfo();
    initSidebarToggle();
    initNavigation();
    initCaseTable();
    initUserTable();
    bindFilterEvents();
    fetchCases();
    initetl();

    // ==== FUNCTION DEFINITIONS ====

    function initUserInfo() {
        $('#username').text(username);

        // Update access level display in the card
        const accessLevelElement = $('.alert-card-access .alert-card-content');
        if (accessLevelElement.length) {
            if (role === 'admin') {
                accessLevelElement
                    .removeClass('text-danger')
                    .addClass('text-success')
                    .text('Admin');
            } else {
                accessLevelElement
                    .removeClass('text-success')
                    .addClass('text-danger')
                    .text('Viewer');
            }
        }

        // Show admin section if user is admin
        if (role === 'admin') {
            $('#adminSection').show();
            // Update role message if it exists
            $('#roleMessage').removeClass('alert-secondary').addClass('alert-info')
                .html(`
                <div>
                    Access level: <strong>Admin</strong>
                </div>
            `);
        }
    }

    function initetl() {
        if (role === 'admin') {
            // Make sure the #etl1 element exists
            const etlContainer = $('#etl1');
            if (!etlContainer.length) {
                console.error('❌ #etl1 container not found in DOM.');
                return;
            }

            // Inject the ETL button (replace the content of etl1 div)
            etlContainer.html(`
                <div class="etl-controls">
                    <button id="runEtlBtn" class="btn btn-gradient-primary btn-sm shadow-lg position-relative overflow-hidden me-2">
                        <span class="btn-text d-flex align-items-center justify-content-center">
                            <i class="bi bi-database-gear me-2"></i>
                            <span>Run ETL Process</span>
                        </span>
                        <span class="btn-loader d-none">
                            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            <span>Processing...</span>
                        </span>
                        <span class="btn-ripple position-absolute top-0 start-0 w-100 h-100"></span>
                    </button>
                    
                </div>
                
            `);

            // count downdiv
            // <button id="toggleAutoEtl" class="btn btn-outline-secondary btn-sm" title="Toggle Auto ETL (10 minutes)">
            //     <i class="bi bi-clock me-1"></i>
            //     <span class="auto-status">Auto: OFF</span>
            // </button>
            // <div class="mt-2">
            //     <small id="etlCountdown" class="text-muted d-none">
            //         Next auto ETL in: <span class="countdown-timer">10:00</span>
            //     </small>
            // </div>


            // Bind click handler with proper event delegation
            $(document).off('click', '#runEtlBtn').on('click', '#runEtlBtn', function (e) {
                e.preventDefault();
                executeEtl();
            });

            // Bind auto ETL toggle handler
            $(document).off('click', '#toggleAutoEtl').on('click', '#toggleAutoEtl', function (e) {
                e.preventDefault();
                toggleAutoEtl();
            });
        }
    }

    // Function to execute ETL (separated for reuse)
    function executeEtl() {
        console.log('ETL button clicked');

        const button = $('#runEtlBtn');
        const btnText = button.find('.btn-text');
        const btnLoader = button.find('.btn-loader');

        console.log('Button elements found:', btnText.length, btnLoader.length);

        // Show loader and disable button
        btnText.addClass('d-none');
        btnLoader.removeClass('d-none');
        button.prop('disabled', true).addClass('processing');

        showToast('Running ETL process...', 'success');

        const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
        const csrfToken = csrfInput ? csrfInput.value : null;

        if (!csrfToken) {
            // Reset button state on error
            btnText.removeClass('d-none');
            btnLoader.addClass('d-none');
            button.prop('disabled', false).removeClass('processing');

            showToast('Missing CSRF token.', 'error');
            return;
        }

        fetch('/cyberapp/run-etl/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            }
        })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (data.message) {
                    showToast(data.message + (data.task_id ? ' (Task ID: ' + data.task_id + ')' : ''), 'success');
                } else {
                    showToast('ETL could not be started.', 'error');
                }
            })
            .catch(err => {
                console.error('❌ ETL Error:', err);
                showToast('ETL trigger failed: ' + err.message, 'error');
            })
            .finally(() => {
                // Reset button state regardless of success or failure
                console.log('Resetting button state');
                btnText.removeClass('d-none');
                btnLoader.addClass('d-none');
                button.prop('disabled', false).removeClass('processing');
            });
    }

    // Function to toggle auto ETL
    function toggleAutoEtl() {
        const toggleBtn = $('#toggleAutoEtl');
        const statusSpan = toggleBtn.find('.auto-status');
        const countdownDiv = $('#etlCountdown');

        if (etlAutoInterval) {
            // Stop auto ETL
            clearInterval(etlAutoInterval);
            etlAutoInterval = null;

            toggleBtn.removeClass('auto-active');
            statusSpan.text('Auto: OFF');
            countdownDiv.addClass('d-none');

            showToast('Auto ETL disabled', 'info');
            console.log('Auto ETL stopped');
        } else {
            // Start auto ETL
            startAutoEtl();

            toggleBtn.addClass('auto-active');
            statusSpan.text('Auto: ON');
            countdownDiv.removeClass('d-none');

            showToast('Auto ETL enabled - Running every 10 minutes', 'success');
            console.log('Auto ETL started');
        }
    }

    // Function to start auto ETL with countdown
    function startAutoEtl() {
        let timeLeft = 600; // 10 minutes in seconds

        // Update countdown display
        function updateCountdown() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            $('.countdown-timer').text(display);

            if (timeLeft <= 0) {
                // Execute ETL and reset timer
                executeEtl();
                timeLeft = 600; // Reset to 10 minutes
                showToast('Auto ETL executed', 'info');
            } else {
                timeLeft--;
            }
        }

        // Update countdown immediately
        updateCountdown();

        // Set interval for both countdown and ETL execution
        etlAutoInterval = setInterval(updateCountdown, 1000); // Update every second
    }

    function initSidebarToggle() {
        $('#toggleSidebar').on('click', function () {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                $('#sidebar').toggleClass('show');
                $('#overlay').toggleClass('active');
            } else {
                $('#sidebar').toggleClass('collapsed');
                $('#mainContent').toggleClass('expanded');
                $('#toggleIcon').toggleClass('bi-chevron-double-left bi-chevron-double-right');
            }
        });

        $('#overlay').on('click', function () {
            $('#sidebar').removeClass('show');
            $('#overlay').removeClass('active');
        });
    }

    function initNavigation() {
        $('.nav-link1').on('click', function (e) {
            e.preventDefault();
            $('.nav-link1').removeClass('active');
            $(this).addClass('active');

            const section = $(this).data('section');
            $('.content-section').removeClass('active');
            $(`#${section}-content`).addClass('active');

            // Get active section and update display element
            const section1 = $('.nav-link1.active').data('section');
            document.getElementById('activeSection').innerHTML = section1;
        });
    }

    //   function initCaseTable() {
    //     if ($.fn.DataTable.isDataTable('#casesTable')) {
    //         $('#casesTable').DataTable().clear().destroy();
    //     }

    //     // ✅ Move filter row to top so it matches the columns
    //     // $('#casesTable thead tr.filter-row').clone(true).appendTo('#casesTable thead');

    //     table = $('#casesTable').DataTable({
    //         scrollX: true,
    //         autoWidth: false,
    //         dom: 'Bfrtip',
    //         // orderCellsTop: true, // ✅ ensures the filter row aligns with headers
    //         // fixedHeader: true,
    //         buttons: [
    //             { extend: 'csvHtml5', text: 'Export CSV', className: 'btn btn-outline-secondary btn-sm' },
    //             { extend: 'excelHtml5', text: 'Export Excel', className: 'btn btn-outline-success btn-sm' },
    //             { extend: 'colvis', text: 'Toggle Columns', className: 'btn btn-outline-primary btn-sm' }
    //         ],
    //         pageLength: 10,
    //         lengthMenu: [5, 10, 25, 50]
    //     });

    //     // ✅ Apply search to each column
    //     table.columns().every(function () {
    //         const that = this;
    //         $('input', this.header()).on('keyup change clear', function () {
    //             if (that.search() !== this.value) {
    //                 that.search(this.value).draw();
    //             }
    //         });
    //     });

    //     table.on('draw', updateCardsFromTable);
    // }

    // function initCaseTable() {
    //     if ($.fn.DataTable.isDataTable('#casesTable')) {
    //         $('#casesTable').DataTable().clear().destroy();
    //     }

    //     table = $('#casesTable').DataTable({
    //         scrollX: true,
    //         autoWidth: false,
    //         dom: 'Bfrtip',
    //         orderCellsTop: false, // ✅ ensures the filter row aligns with headers
    //         fixedHeader: true,
    //         buttons: [
    //             { extend: 'csvHtml5', text: 'Export CSV', className: 'btn btn-outline-secondary btn-sm' },
    //             { extend: 'excelHtml5', text: 'Export Excel', className: 'btn btn-outline-success btn-sm' },
    //             { extend: 'colvis', text: 'Toggle Columns', className: 'btn btn-outline-primary btn-sm' }
    //         ],
    //         pageLength: 10,
    //         lengthMenu: [5, 10, 25, 50],

    //         columnDefs: [
    //             {
    //                 targets: 11, // Status column index
    //                 render: function (data, type, row) {
    //                     let selectedPending = data === "Pending" ? "selected" : "";
    //                     let selectedPicked = data === "Picked" ? "selected" : "";
    //                     let selectedClosed = data === "Closed" ? "selected" : "";

    //                     return `
    //                                 <select class="form-select form-select-sm status-dropdown ${data.toLowerCase()}-status" data-case-id="${row[0]}">
    //                                     <option value="Pending" ${selectedPending}>Pending</option>
    //                                     <option value="Picked" ${selectedPicked}>Picked</option>
    //                                     <option value="Closed" ${selectedClosed}>Closed</option>
    //                                 </select>
    //                             `;
    //                 }

    //             },
    //             {
    //                 targets: 13, // Debit From Bank? column index
    //                 render: function (data, type, row) {
    //                     let selectedYes = (data === 'Yes') ? 'selected' : '';
    //                     let selectedNo = (data === 'No') ? 'selected' : '';
    //                     return `
    //                         <select class="debit-dropdown" data-case-id="${row[0]}">
    //                             <option value="Yes" ${selectedYes}>Yes</option>
    //                             <option value="No" ${selectedNo}>No</option>
    //                         </select>
    //                     `;
    //                 }
    //             }
    //         ]
    //     });

    //     // Event listeners for dropdown changes
    //     table = $('#casesTable').DataTable({
    //         scrollX: true,
    //         autoWidth: false,
    //         dom: 'Bfrtip',
    //         buttons: [
    //             { extend: 'csvHtml5', text: 'Export CSV', className: 'btn btn-outline-secondary btn-sm' },
    //             { extend: 'excelHtml5', text: 'Export Excel', className: 'btn btn-outline-success btn-sm' },
    //             { extend: 'colvis', text: 'Toggle Columns', className: 'btn btn-outline-primary btn-sm' }
    //         ],
    //         pageLength: 10,
    //         lengthMenu: [5, 10, 25, 50],

    //         columnDefs: [
    //             // Status Dropdown
    //             {
    //                 targets: 11,
    //                 render: function (data, type, row) {
    //                     let selectedPending = data === "Pending" ? "selected" : "";
    //                     let selectedPicked = data === "Picked" ? "selected" : "";
    //                     let selectedClosed = data === "Closed" ? "selected" : "";

    //                     return `
    //                 <select class="form-select form-select-sm status-dropdown ${data.toLowerCase()}-status" data-case-id="${row[0]}">
    //                     <option value="Pending" ${selectedPending}>Pending</option>
    //                     <option value="Picked" ${selectedPicked}>Picked</option>
    //                     <option value="Closed" ${selectedClosed}>Closed</option>
    //                 </select>
    //             `;
    //                 }
    //             },
    //             // Debit from Bank Dropdown
    //             {
    //                 targets: 13,
    //                 render: function (data, type, row) {
    //                     let selectedYes = data === "Yes" ? "selected" : "";
    //                     let selectedNo = data === "No" ? "selected" : "";

    //                     return `
    //                 <select class="form-select form-select-sm debit-dropdown ${data.toLowerCase()}-debit" data-case-id="${row[0]}">
    //                     <option value="Yes" ${selectedYes}>Yes</option>
    //                     <option value="No" ${selectedNo}>No</option>
    //                 </select>
    //             `;
    //                 }
    //             }
    //         ]
    //     });



    //     $('#casesTable').on('change', '.status-dropdown', function () {
    //         let caseId = $(this).data('case-id');
    //         let newStatus = $(this).val();
    //         updateCaseStatus(caseId, newStatus);
    //     });

    //     $('#casesTable').on('change', '.debit-dropdown', function () {
    //         let caseId = $(this).data('case-id');
    //         let newDebitStatus = $(this).val();
    //         updateDebitFromBank(caseId, newDebitStatus);
    //     });

    //     table.on('draw', updateCardsFromTable);
    // }

    // function initCaseTable() {
    //     if ($.fn.DataTable.isDataTable('#casesTable')) {
    //         $('#casesTable').DataTable().clear().destroy();
    //     }

    //     // ✅ Attach search inputs before DataTable init
    //     $('#casesTable thead tr.filter-row th').each(function (i) {
    //         let headerCell = $(this);

    //         // Only add text inputs for columns that are NOT status/debit dropdowns
    //         if (i !== 11 && i !== 13) {
    //             $('input', this).off().on('keyup change clear', function () {
    //                 if (table.column(i).search() !== this.value) {
    //                     table.column(i).search(this.value).draw();
    //                 }
    //             });
    //         }
    //     });

    //     table = $('#casesTable').DataTable({
    //         scrollX: true,
    //         autoWidth: false,
    //         dom: 'Bfrtip',
    //         buttons: [
    //             { extend: 'csvHtml5', text: 'Export CSV', className: 'btn btn-outline-secondary btn-sm' },
    //             { extend: 'excelHtml5', text: 'Export Excel', className: 'btn btn-outline-success btn-sm' },
    //             { extend: 'colvis', text: 'Toggle Columns', className: 'btn btn-outline-primary btn-sm' }
    //         ],
    //         pageLength: 10,
    //         lengthMenu: [5, 10, 25, 50],

    //         columnDefs: [
    //             // Status column
    //             {
    //                 targets: 11,
    //                 render: function (data, type, row) {
    //                     let selectedPending = data === "Pending" ? "selected" : "";
    //                     let selectedPicked = data === "Picked" ? "selected" : "";
    //                     let selectedClosed = data === "Closed" ? "selected" : "";

    //                     return `
    //                     <select class="form-select form-select-sm status-dropdown ${data.toLowerCase()}-status" data-case-id="${row[0]}">
    //                         <option value="Pending" ${selectedPending}>Pending</option>
    //                         <option value="Picked" ${selectedPicked}>Picked</option>
    //                         <option value="Closed" ${selectedClosed}>Closed</option>
    //                     </select>
    //                 `;
    //                 }
    //             },
    //             // Debit from Bank column
    //             {
    //                 targets: 13,
    //                 render: function (data, type, row) {
    //                     let selectedYes = data === "Yes" ? "selected" : "";
    //                     let selectedNo = data === "No" ? "selected" : "";

    //                     return `
    //                     <select class="form-select form-select-sm debit-dropdown ${data.toLowerCase()}-debit" data-case-id="${row[0]}">
    //                         <option value="Yes" ${selectedYes}>Yes</option>
    //                         <option value="No" ${selectedNo}>No</option>
    //                     </select>
    //                 `;
    //                 }
    //             },
    //             // pdf link
    //             {
    //                 targets: 21, // Adjust index based on where you want PDF link
    //                 render: function (data, type, row) {
    //                     if (!data) return `<span class="text-muted">No PDF</span>`;
    //                     return `<a href="${data}" target="_blank" class="btn btn-sm btn-outline-primary">
    //                 <i class="bi bi-file-earmark-pdf"></i> View PDF
    //             </a>`;
    //                 }
    //             }
    //         ]
    //     });

    //     // ✅ Handle dropdown changes
    //     $('#casesTable').on('change', '.status-dropdown', function () {
    //         updateCaseStatus($(this).data('case-id'), $(this).val());
    //     });

    //     $('#casesTable').on('change', '.debit-dropdown', function () {
    //         updateDebitFromBank($(this).data('case-id'), $(this).val());
    //     });

    //     table.on('draw', updateCardsFromTable);
    // }



    // ========================
    // Init DataTable
    // ========================
    // function initCaseTable() {
    //     if ($.fn.DataTable.isDataTable('#casesTable')) {
    //         $('#casesTable').DataTable().clear().destroy();
    //     }

    //     // Attach search inputs for filter row (skip status & debit dropdown columns)
    //     $('#casesTable thead tr.filter-row th').each(function (i) {
    //         if (i !== 11 && i !== 13) {
    //             $('input', this).off().on('keyup change clear', function () {
    //                 if (table.column(i).search() !== this.value) {
    //                     table.column(i).search(this.value).draw();
    //                 }
    //             });
    //         }
    //     });

    //     table = $('#casesTable').DataTable({
    //         scrollX: true,
    //         autoWidth: false,
    //         dom: 'Bfrtip',
    //         buttons: [
    //             { extend: 'csvHtml5', text: 'Export CSV', className: 'btn btn-outline-secondary btn-sm' },
    //             { extend: 'excelHtml5', text: 'Export Excel', className: 'btn btn-outline-success btn-sm' },
    //             { extend: 'colvis', text: 'Toggle Columns', className: 'btn btn-outline-primary btn-sm' }
    //         ],
    //         pageLength: 10,
    //         lengthMenu: [5, 10, 25, 50],
    //         columnDefs: [
    //             // Status column
    //             {
    //                 targets: 11,
    //                 render: function (data, type, row) {
    //                     let selectedPending = data === "Pending" ? "selected" : "";
    //                     let selectedPicked = data === "Picked" ? "selected" : "";
    //                     let selectedClosed = data === "Closed" ? "selected" : "";

    //                     return `
    //                         <select class="form-select form-select-sm status-dropdown ${data.toLowerCase()}-status" data-case-id="${row[0]}">
    //                             <option value="Pending" ${selectedPending}>Pending</option>
    //                             <option value="Picked" ${selectedPicked}>Picked</option>
    //                             <option value="Closed" ${selectedClosed}>Closed</option>
    //                         </select>
    //                     `;
    //                 }
    //             },
    //             // Debit from Bank column
    //             {
    //                 targets: 13,
    //                 render: function (data, type, row) {
    //                     let selectedYes = data === "Yes" ? "selected" : "";
    //                     let selectedNo = data === "No" ? "selected" : "";

    //                     return `
    //                         <select class="form-select form-select-sm debit-dropdown ${data.toLowerCase()}-debit" data-case-id="${row[0]}">
    //                             <option value="Yes" ${selectedYes}>Yes</option>
    //                             <option value="No" ${selectedNo}>No</option>
    //                         </select>
    //                     `;
    //                 }
    //             },
    //             // PDF link
    //             {
    //                 targets: 21, // Adjust if needed
    //                 render: function (data) {
    //                     if (!data) return `<span class="text-muted">No PDF</span>`;
    //                     return `<a href="${data}" target="_blank" class="btn btn-sm btn-outline-primary">
    //                                 <i class="bi bi-file-earmark-pdf"></i> View PDF
    //                             </a>`;
    //                 }
    //             }
    //         ]
    //     });

    //     // Dropdown change events
    //     $('#casesTable').on('change', '.status-dropdown', function () {
    //         const caseId = $(this).data('case-id');
    //         const newStatus = $(this).val();
    //         sendCaseUpdate(caseId, { status: newStatus });
    //     });

    //     $('#casesTable').on('change', '.debit-dropdown', function () {
    //         const caseId = $(this).data('case-id');
    //         const newDebit = $(this).val();
    //         sendCaseUpdate(caseId, { debit_from_bank: newDebit });
    //     });

    //     table.on('draw', updateCardsFromTable);
    // }
    function initCaseTable() {
        if ($.fn.DataTable.isDataTable('#casesTable')) {
            $('#casesTable').DataTable().clear().destroy();
        }

        // Attach search inputs for filter row (skip status & debit dropdown columns)
        $('#casesTable thead tr.filter-row th').each(function (i) {
            if (i !== 11 && i !== 13) {
                $('input', this).off().on('keyup change clear', function () {
                    if (table.column(i).search() !== this.value) {
                        table.column(i).search(this.value).draw();
                    }
                });
            }
        });

        table = $('#casesTable').DataTable({
            scrollX: true,
            autoWidth: false,
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'csvHtml5',
                    text: 'Export CSV',
                    className: 'btn btn-outline-secondary btn-sm',
                    exportOptions: {
                        // Skip the filter row (row 1) and only use the header row (row 0)
                        header: true,
                        // Custom function to get proper headers
                        format: {
                            header: function (data, row, column, node) {
                                // Get the header text from the first row (actual headers)
                                var headerRow = $('#casesTable thead tr:first-child th').eq(column);
                                return headerRow.text().trim();
                            }
                        }
                    }
                },
                {
                    extend: 'excelHtml5',
                    text: 'Export Excel',
                    className: 'btn btn-outline-success btn-sm',
                    exportOptions: {
                        // Skip the filter row (row 1) and only use the header row (row 0)
                        header: true,
                        // Custom function to get proper headers
                        format: {
                            header: function (data, row, column, node) {
                                // Get the header text from the first row (actual headers)
                                var headerRow = $('#casesTable thead tr:first-child th').eq(column);
                                return headerRow.text().trim();
                            }
                        }
                    }
                },
                {
                    extend: 'colvis',
                    text: 'Toggle Columns',
                    className: 'btn btn-outline-primary btn-sm'
                }
            ],
            pageLength: 10,
            lengthMenu: [5, 10, 25, 50],
            columnDefs: [
                // Status column
                {
                    targets: 11,
                    render: function (data, type, row) {
                        // For export, return the plain text value
                        if (type === 'export') {
                            return data;
                        }

                        let selectedPending = data === "Pending" ? "selected" : "";
                        let selectedPicked = data === "Picked" ? "selected" : "";
                        let selectedClosed = data === "Closed" ? "selected" : "";

                        return `
                        <select class="form-select form-select-sm status-dropdown ${data.toLowerCase()}-status" data-case-id="${row[0]}">
                            <option value="Pending" ${selectedPending}>Pending</option>
                            <option value="Picked" ${selectedPicked}>Picked</option>
                            <option value="Closed" ${selectedClosed}>Closed</option>
                        </select>
                    `;
                    }
                },
                // Debit from Bank column
                {
                    targets: 13,
                    render: function (data, type, row) {
                        // For export, return the plain text value
                        if (type === 'export') {
                            return data;
                        }

                        let selectedYes = data === "Yes" ? "selected" : "";
                        let selectedNo = data === "No" ? "selected" : "";

                        return `
                        <select class="form-select form-select-sm debit-dropdown ${data.toLowerCase()}-debit" data-case-id="${row[0]}">
                            <option value="Yes" ${selectedYes}>Yes</option>
                            <option value="No" ${selectedNo}>No</option>
                        </select>
                    `;
                    }
                },
                // PDF link
                {
                    targets: 21, // Adjust if needed
                    render: function (data, type, row) {
                        // For export, return the URL or "No PDF"
                        if (type === 'export') {
                            return data || 'No PDF';
                        }

                        if (!data) return `<span class="text-muted">No PDF</span>`;
                        return `<a href="${data}" target="_blank" class="btn btn-sm btn-outline-dark">
                                <i class="bi bi-file-earmark-pdf"></i> View PDF
                            </a>`;
                    }
                }
            ]
        });

        // Alternative approach - if the above doesn't work, you can try this:
        // Add custom export functionality with explicit header definition
        $('#casesTable').on('buttons-action', function (e, buttonApi, dataTable, node, config) {
            if (config.extend === 'csvHtml5' || config.extend === 'excelHtml5') {
                // Define your headers explicitly
                const headers = [
                    'S.No', 'Complaint Date', 'Mail Date', 'Mail Month', 'Amount',
                    'Reference Number', 'Police Station Address', 'Account Number',
                    'Name', 'Mobile Number', 'Email ID', 'Status', 'Ageing Days',
                    'Debit from Bank', 'Region', 'UTR Number', 'UTR Amount',
                    'Transaction DateTime', 'Total Fraudulent Amount', 'Updated On',
                    'Updated By', 'PDF URL'
                ];

                // You can customize the export data here if needed
                config.title = 'Cyber Cases Report';
                config.messageTop = 'Cyber Cases Report - Generated on ' + new Date().toLocaleDateString();
            }
        });

        // Rest of your existing code...
        function getCookie(name) {
            let cookieValue = null;
            if (document.cookie && document.cookie !== '') {
                const cookies = document.cookie.split(';');
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i].trim();
                    if (cookie.substring(0, name.length + 1) === (name + '=')) {
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        }
        const csrftoken = getCookie('csrftoken');

        function sendCaseUpdate(caseId, data) {
            $.ajax({
                url: `/cyberapp/cases/${caseId}/update/`,
                type: 'POST',
                data: JSON.stringify(data),
                contentType: 'application/json',
                headers: { 'X-CSRFToken': csrftoken },
                success: function (res) {
                    console.log('✅ Case updated:', res);
                    showToast('Case updated successfully', 'success');
                    refreshTableData();
                },
                error: function (xhr) {
                    console.error('❌ Update failed:', xhr.responseText);
                    showToast('Error updating case: ' + xhr.responseText, 'error');
                }
            });
        }

        $(document).on('change', '.status-dropdown', function () {
            const caseId = $(this).data('case-id');
            const newStatus = $(this).val();
            sendCaseUpdate(caseId, { status: newStatus.toLowerCase() });
        });

        $(document).on('change', '.debit-dropdown', function () {
            const caseId = $(this).data('case-id');
            const newDebit = $(this).val();
            sendCaseUpdate(caseId, { debit_from_bank: newDebit.toLowerCase() });
        });

        table.on('draw', updateCardsFromTable);
    }

    // ========================
    // AJAX Update Helper
    // ========================
    function sendCaseUpdate(caseId, data) {
        $.ajax({
            url: `/cyberapp/cases/${caseId}/update/`,
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            success: function (res) {
                console.log('✅ Case updated:', res);
            },
            error: function (xhr) {
                console.error('❌ Update failed:', xhr.responseText);
                alert('Error updating case: ' + xhr.responseText);
            }
        });
    }

    // Get CSRF token for Django
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Dummy placeholder for card update logic
    function updateCardsFromTable() {
        // Your own refresh logic to update summary cards from table data
    }




    function updateCaseStatus(caseId, status) {
        $.post('/update-status', { id: caseId, status: status }, function (response) {
            console.log('Status updated', response);
        });
    }

    function updateDebitFromBank(caseId, debitStatus) {
        $.post('/update-debit', { id: caseId, debit_from_bank: debitStatus }, function (response) {
            console.log('Debit status updated', response);
        });
    }

    function initUserTable() {
        if ($('#userTable').length === 0) return;

        userTable = $('#userTable').DataTable({
            pageLength: 5,
            lengthMenu: [5, 10, 25, 50],
            ordering: true,
            searching: true,
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: 'Download Excel',
                    className: 'd-none',
                    exportOptions: { columns: [0, 1, 2] }
                }
            ]
        });

        $('#downloadExcelBtn').on('click', function () {
            userTable.button('.buttons-excel').trigger();
        });

        $('#create-user-form').on('submit', function (e) {
            e.preventDefault();
            const form = this;
            const csrfToken = form.querySelector('[name=csrfmiddlewaretoken]').value;

            fetch("/create-user/", {
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
                body: new FormData(form)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showToast(data.message, 'success');
                        setTimeout(() => form.reset(), 0);
                        if (userTable && userTable.ajax) {
                            userTable.ajax.reload(null, false);
                        }
                    } else {
                        let errors = "";
                        for (let field in data.errors) {
                            errors += `${field}: ${data.errors[field].join(', ')}\n`;
                        }
                        showToast(errors, 'error');
                    }
                })
                .catch(() => showToast('Server error.', 'error'));
        });
    }

    window.updateUserRole = function (userId, newRole) {
        if (!confirm(`Change role to "${newRole}"?`)) return;

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
            document.querySelector('[name=csrfmiddlewaretoken]')?.value;

        if (!csrfToken) {
            showToast('CSRF token not found.', 'error');
            return;
        }

        const data = new URLSearchParams();
        data.append('user_id', userId);
        data.append('role', newRole);

        fetch('/update-role/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
            },
            body: data
        })
            .then(res => {
                if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    const badge = document.getElementById(`role-badge-${userId}`);
                    if (badge) {
                        badge.textContent = newRole.charAt(0).toUpperCase() + newRole.slice(1);
                        badge.className = "badge " + (newRole === "admin" ? "badge-admin" : "badge-viewer");
                    }
                    showToast(data.message, 'success');
                } else {
                    showToast(data.error || 'Failed to update role', 'error');
                }
            })
            .catch(err => {
                console.error('Fetch error:', err);
                showToast('Error updating role: ' + err.message, 'error');
            });
    };

    function bindFilterEvents() {
        $('#apply-filters').on('click', function (e) {
            e.preventDefault();
            applyFilters();
        });

        $('#reset-filters').on('click', function (e) {
            e.preventDefault();
            resetFilters();
        });
    }

    function fetchCases() {
        fetch('/cyberapp/cases/')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                allCases = data.cases || [];
                renderTable(allCases);
            })
            .catch(err => {
                console.error('Error loading data:', err);
                showToast('Failed to load cases data', 'error');
            });
    }

    function renderTable(data) {
        table.clear();

        data.forEach(c => {
            table.row.add([
                c.sno,
                c.complaint_date,
                c.mail_date,
                c.mail_month,
                c.amount,
                c.reference_number,
                c.police_station_address,
                c.account_number,
                c.name,
                c.mobile_number,
                c.email_id,
                c.status,
                c.ageing_days,
                c.debit_from_bank,
                c.region,
                c.utr_number,
                c.utr_amount,
                c.transaction_datetime,
                c.total_fraudulent_amount,
                c.updated_on,
                c.updated_by,
                c.pdf_url
            ]);
        });

        table.draw(false);
        updateDashboardCards(data);
    }

    function applyFilters() {
        const filterType = $('#date-filter-type').val();
        const startDate = $('#start-date').val();
        const endDate = $('#end-date').val();
        const status = $('#status-filter').val().toLowerCase();
        const account = $('#account-filter').val().toLowerCase();
        const reference = $('#reference-filter').val().toLowerCase();
        const month = $('#month-filter').val().toLowerCase();

        const filtered = allCases.filter(c => {
            let valid = true;
            if (startDate) valid = valid && c[filterType] >= startDate;
            if (endDate) valid = valid && c[filterType] <= endDate;
            if (status) valid = valid && String(c.status).toLowerCase() === status;
            if (account) valid = valid && String(c.account_number || '').toLowerCase().includes(account);
            if (reference) valid = valid && String(c.reference_number || '').toLowerCase().includes(reference);
            if (month) valid = valid && String(c.mail_month || '').toLowerCase() === month;
            return valid;
        });

        renderTable(filtered);
    }

    function resetFilters() {
        $('#date-filter-type').val('mail_date');
        $('#start-date').val('');
        $('#end-date').val('');
        $('#status-filter').val('');
        $('#account-filter').val('');
        $('#reference-filter').val('');
        $('#month-filter').val('');
        renderTable(allCases);
    }

    function updateCardsFromTable() {
        const filteredData = table.rows({ search: 'applied' }).data().toArray();

        let total = filteredData.length;
        let pending = 0, picked = 0, closed = 0;
        let totalFraud = 0;

        filteredData.forEach(row => {
            const status = row[11]?.toString().trim();
            const fraudAmount = parseFloat(String(row[18] || '0').replace(/[₹,]/g, '')) || 0;

            if (status === 'Pending') pending++;
            else if (status === 'Picked') picked++;
            else if (status === 'Closed') closed++;

            totalFraud += fraudAmount;
        });

        $('#card-total-cases').text(total);
        $('#card-pending').text(pending);
        $('#card-picked').text(picked);
        $('#card-closed').text(closed);

        const fraudInCr = totalFraud / 10000000;
        $('#card-fraud-amount').text("₹" + fraudInCr.toFixed(4) + " Cr");
    }

    function updateDashboardCards(data) {
        let total = data.length;
        let pending = 0, picked = 0, closed = 0;
        let totalFraud = 0;

        data.forEach(c => {
            const status = c.status;
            const fraudAmount = parseFloat(String(c.total_fraudulent_amount || '0').replace(/[₹,]/g, '')) || 0;

            if (status === 'Pending') pending++;
            else if (status === 'Picked') picked++;
            else if (status === 'Closed') closed++;

            totalFraud += fraudAmount;
        });

        $('#card-total-cases').text(total);
        $('#card-pending').text(pending);
        $('#card-picked').text(picked);
        $('#card-closed').text(closed);

        const fraudInCr = totalFraud / 10000000;
        $('#card-fraud-amount').text("₹" + fraudInCr.toFixed(4) + " Cr");
    }

    function showToast(message, type = 'success') {
        const toastId = 'toast-' + Date.now();
        const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';

        const toastHtml = `
            <div class="toast align-items-center text-white ${bgClass} border-0 mb-2" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        $('#toastContainer').append(toastHtml);

        // Check if Bootstrap is available
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            new bootstrap.Toast(document.getElementById(toastId), { delay: 4000 }).show();
        } else {
            // Fallback for manual removal
            setTimeout(() => {
                $('#' + toastId).fadeOut(() => $('#' + toastId).remove());
            }, 4000);
        }
    }

});