/**
 * =========================================================================
 * SCRIPT.JS (VERSI INTERAKTIF)
 * =========================================================================
 * * LOGIKA BARU:
 * 1. Definisikan variabel global untuk data mentah dan instance chart.
 * 2. Buat fungsi `updateDashboard()` yang akan dipanggil setiap ada perubahan.
 * 3. `loadAndProcessData()` sekarang hanya berjalan sekali untuk inisialisasi.
 */

// -------------------------------------------------------------------------
// Variabel Global
// -------------------------------------------------------------------------

// Kita akan simpan 52.000+ baris data di sini agar bisa difilter
let fullMasterData = []; 

// Kita simpan instance chart di sini agar bisa di-destroy
let chartInstances = {};

// -------------------------------------------------------------------------
// Inisialisasi
// -------------------------------------------------------------------------

// Menunggu semua konten HTML dimuat sebelum menjalankan skrip
document.addEventListener('DOMContentLoaded', () => {
    // Memulai proses memuat semua data (hanya sekali)
    loadAndProcessData();
});

/**
 * Fungsi pembantu untuk memuat file CSV (menggunakan PapaParse).
 */
async function fetchData(url) {
    const response = await fetch(url);
    const csvText = await response.text();
    return new Promise(resolve => {
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data)
        });
    });
}

/**
 * Fungsi utama untuk memuat satu file CSV besar.
 * Sekarang hanya untuk inisialisasi, mengisi filter, dan trigger update pertama.
 */
async function loadAndProcessData() {
    console.log("Memuat file master_sales_data.csv...");
    try {
        // 1. HANYA MEMUAT SATU FILE MASTER
        const allData = await fetchData('master_sales_data.csv');
        fullMasterData = allData; // Simpan ke variabel global
        console.log(`Berhasil memuat ${fullMasterData.length} baris data.`);

        // 2. PROSES DATA SEKALI HANYA UNTUK MENGISI FILTER
        const initialProcessedData = processDataInBrowser(fullMasterData);
        fillFilters(initialProcessedData.filterData);
        console.log("Filter telah diisi.");
        
        // 3. GAMBAR DASHBOARD PERTAMA KALI (dengan semua data)
        updateDashboard();
        console.log("Dashboard awal berhasil dimuat.");

        // 4. PASANG EVENT LISTENER PADA FILTER
        document.getElementById('filter-location').addEventListener('change', updateDashboard);
        document.getElementById('filter-product').addEventListener('change', updateDashboard);
        document.getElementById('filter-month').addEventListener('change', updateDashboard);
        console.log("Event listener untuk filter telah dipasang.");

    } catch (error) {
        console.error("Gagal memuat atau memproses data:", error);
    }
}

// -------------------------------------------------------------------------
// Fungsi Inti Update
// -------------------------------------------------------------------------

/**
 * Fungsi "mesin" utama. Dipanggil setiap kali filter berubah.
 */
function updateDashboard() {
    console.log("Memperbarui dashboard...");

    // 1. Baca nilai filter saat ini
    const selectedLocation = document.getElementById('filter-location').value;
    const selectedProduct = document.getElementById('filter-product').value;
    const selectedMonth = document.getElementById('filter-month').value;

    // 2. Saring (Filter) data master
    // Ini akan mengambil 52.000+ baris dan menyaringnya
    const filteredData = fullMasterData.filter(row => {
        // Cek setiap kondisi. Jika filter "Semua" (default), maka lolos (true).
        const matchLocation = (selectedLocation === 'Filter berdasarkan Lokasi') || (row.Location === selectedLocation);
        const matchProduct = (selectedProduct === 'Filter berdasarkan Produk') || (row.Product_Category === selectedProduct);
        const matchMonth = (selectedMonth === 'Filter berdasarkan Bulan') || (row.Month === selectedMonth);
        
        return matchLocation && matchProduct && matchMonth;
    });
    console.log(`Data difilter: ${filteredData.length} baris`);

    // 3. Proses data yang sudah difilter
    const processedData = processDataInBrowser(filteredData);
    
    // 4. Isi ulang semua komponen dengan data baru
    fillScoreCards(processedData.scoreData);
    
    // Hancurkan & gambar ulang semua chart
    createChart1_Combo(processedData.chart1Data);
    createChart2_BarMonth(processedData.chart2Data);
    createChart3_TreemapPlaceholder(processedData.chart3Data); // Google Chart
    createChart4_GroupedBar(processedData.chart4Data);
    createChart5_PieGender(processedData.chart5Data);
    
    // Isi ulang tabel
    fillTable1_Tax(processedData.table1Data);
    fillTable2_Discount(processedData.table2Data);

    console.log("Dashboard berhasil diperbarui.");
}


// -------------------------------------------------------------------------
// Fungsi Pemrosesan Data (SAMA SEPERTI SEBELUMNYA)
// -------------------------------------------------------------------------

/**
 * Fungsi ini mengambil data (penuh atau terfilter)
 * dan mengubahnya menjadi 9 set data yang siap untuk divisualisasikan.
 */
function processDataInBrowser(allData) {
    let total_revenue = 0;
    let total_quantity = 0;
    const customerIDs = new Set();
    const locations = new Set();
    const products = new Set();
    const months = new Set();
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const categoryAgg = {};
    const monthAgg = {};
    const locationCategoryAgg = {}; // Ini akan diubah
    const locationGenderAgg = {};
    const genderAgg = {};
    const taxAgg = {};
    const discountAgg = {};

    for (const row of allData) {
        if (!row.CustomerID) continue;

        total_revenue += row.Total_Revenue || 0;
        total_quantity += row.Quantity || 0;
        customerIDs.add(row.CustomerID);

        locations.add(row.Location);
        products.add(row.Product_Category);
        months.add(row.Month);

        const cat = row.Product_Category;
        const mon = row.Month;
        const loc = row.Location;
        const gen = row.Gender;
        
        if (!categoryAgg[cat]) categoryAgg[cat] = { customers: new Set(), quantity: 0 };
        categoryAgg[cat].customers.add(row.CustomerID);
        categoryAgg[cat].quantity += row.Quantity || 0;

        if (!monthAgg[mon]) monthAgg[mon] = 0;
        monthAgg[mon] += row.Quantity || 0;
        
        // --- PERUBAHAN CHART 3 DIMULAI DI SINI ---
        const treemapKey = `${loc}|${cat}`;
        if (!locationCategoryAgg[treemapKey]) {
            // Ubah dari 'Total_Revenue' menjadi 'Customers'
            locationCategoryAgg[treemapKey] = { Location: loc, Product_Category: cat, Customers: new Set() }; 
        }
        // Tambahkan ID customer ke Set (Set otomatis menangani duplikat)
        locationCategoryAgg[treemapKey].Customers.add(row.CustomerID);
        // --- PERUBAHAN CHART 3 SELESAI ---

        if (!locationGenderAgg[loc]) locationGenderAgg[loc] = { F: new Set(), M: new Set() };
        if (gen === 'F') locationGenderAgg[loc].F.add(row.CustomerID);
        if (gen === 'M') locationGenderAgg[loc].M.add(row.CustomerID);

        if (!genderAgg[gen]) genderAgg[gen] = new Set();
        genderAgg[gen].add(row.CustomerID);

        if (!taxAgg[cat]) taxAgg[cat] = row.GST;

        const code = row.Coupon_Code;
        if (code) {
            const discountKey = `${mon}|${code}`;
            if (!discountAgg[discountKey]) {
                discountAgg[discountKey] = { Month: mon, Coupon_Code: code, pcts: [] };
            }
            if (row.Discount_pct) {
                discountAgg[discountKey].pcts.push(row.Discount_pct);
            }
        }
    }

    // --- FINALISASI DATA ---
    const scoreData = {
        total_revenue: total_revenue,
        total_quantity: total_quantity,
        total_customers: customerIDs.size
    };

    const filterData = {
        locations: [...locations].sort(),
        products: [...products].sort(),
        months: monthOrder
    };

    const chart1Data = Object.keys(categoryAgg).map(cat => ({
        Product_Category: cat,
        Total_Customers: categoryAgg[cat].customers.size,
        Total_Quantity: categoryAgg[cat].quantity
    })).sort((a, b) => b.Total_Customers - a.Total_Customers);

    const chart2Data = monthOrder.map(mon => ({
        Month: mon,
        Quantity: monthAgg[mon] || 0
    }));

    // --- PERUBAHAN FINALISASI CHART 3 ---
    // Ubah data 'Customers: Set()' menjadi 'Total_Customers: 5' (angka)
    const chart3Data = Object.values(locationCategoryAgg).map(d => ({
        Location: d.Location,
        Product_Category: d.Product_Category,
        Total_Customers: d.Customers.size // Ambil jumlah unik dari Set
    })).filter(d => d.Total_Customers > 0); // Filter yang 0
    // --- PERUBAHAN SELESAI ---

    const chart4Data = Object.keys(locationGenderAgg).map(loc => ({
        Location: loc,
        F: locationGenderAgg[loc].F.size,
        M: locationGenderAgg[loc].M.size
    })).sort((a, b) => a.Location.localeCompare(b.Location));

    const chart5Data = Object.keys(genderAgg).map(gen => ({
        Gender: gen,
        Total_Customers: genderAgg[gen].size
    }));

    const table1Data = Object.keys(taxAgg).map(cat => ({
        Product_Category: cat,
        GST: taxAgg[cat]
    })).sort((a, b) => a.Product_Category.localeCompare(b.Product_Category));

    const table2Data = Object.values(discountAgg).map(d => {
        const avg_pct = d.pcts.length > 0 ? d.pcts.reduce((a, b) => a + b, 0) / d.pcts.length : null;
        return {
            Month: d.Month,
            Coupon_Code: d.Coupon_Code,
            Discount_pct: avg_pct
        };
    }).sort((a, b) => monthOrder.indexOf(a.Month) - monthOrder.indexOf(b.Month));

    return {
        scoreData, filterData, chart1Data, chart2Data,
        chart3Data, chart4Data, chart5Data, table1Data, table2Data
    };
}


// =-------------------------------------------------------------------------
// Fungsi UI & Chart (Semua dimodifikasi untuk di-destroy)
// -------------------------------------------------------------------------

function fillScoreCards(data) {
    
    // FUNGSI FORMAT BARU:
    // Format angka dengan pemisah ribuan (misal: 4.670.795)
    
    const formatRevenue = (num) => {
        // Format sebagai Dolar (sesuai format asli $), tanpa desimal
        return num.toLocaleString('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0 
        });
    };
    
    const formatNumber = (num) => {
        // Format sebagai angka biasa dengan pemisah ribuan (misal: 238.033)
        return num.toLocaleString('id-ID');
    };

    // Terapkan format baru
    document.getElementById('score-revenue').textContent = formatRevenue(data.total_revenue);
    document.getElementById('score-quantity').textContent = formatNumber(data.total_quantity);
    document.getElementById('score-customers').textContent = formatNumber(data.total_customers);
}
/**
 * Pengisian filter. Hanya dipanggil sekali saat load.
 */
function fillFilters(data) {
    const locFilter = document.getElementById('filter-location');
    data.locations.forEach(loc => {
        locFilter.innerHTML += `<option value="${loc}">${loc}</option>`;
    });

    const prodFilter = document.getElementById('filter-product');
    data.products.forEach(prod => {
        prodFilter.innerHTML += `<option value="${prod}">${prod}</option>`;
    });

    const monthFilter = document.getElementById('filter-month');
    data.months.forEach(month => {
        monthFilter.innerHTML += `<option value="${month}">${month}</option>`;
    });
}

/**
 * Fungsi Chart.js (ditambah .destroy())
 */
function createChart1_Combo(data) {
    // HANCURKAN CHART LAMA (jika ada)
    if (chartInstances['chart1']) {
        chartInstances['chart1'].destroy();
    }
    
    const topData = data.slice(0, 10);
    const labels = topData.map(row => row.Product_Category);
    const customers = topData.map(row => row.Total_Customers);
    const quantity = topData.map(row => row.Total_Quantity);

    const ctx = document.getElementById('chart1_combo').getContext('2d');
    // SIMPAN INSTANCE CHART BARU
    chartInstances['chart1'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Total Pelanggan',
                    data: customers,
                    backgroundColor: 'rgba(255, 77, 0, 0.53)',
                    yAxisID: 'y_customers'
                },
                {
                    type: 'line',
                    label: 'Total Kuantitas',
                    data: quantity,
                    borderColor: 'rgba(0, 51, 255, 1)',
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    fill: true,
                    tension: 0.1,
                    yAxisID: 'y_quantity'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } },
                y_customers: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'Total Pelanggan' }
                },
                y_quantity: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    title: { display: true, text: 'Total Kuantitas' },
                    grid: { drawOnChartArea: false } 
                }
            }
        }
    });
}

function createChart2_BarMonth(data) {
    if (chartInstances['chart2']) {
        chartInstances['chart2'].destroy();
    }
    
    const labels = data.map(row => row.Month);
    const quantities = data.map(row => row.Quantity);

    const ctx = document.getElementById('chart2_bar_month').getContext('2d');
    chartInstances['chart2'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Kuantitas',
                data: quantities,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * Fungsi Google Chart (Treemap)
 * --- DIPERBARUI: Mengubah skema warna menjadi BIRU ---
 */
function createChart3_TreemapPlaceholder(data) {
    // data = chart3Data (isinya: [{ Location, Product_Category, Total_Customers }, ...])
    
    // Kosongkan <div> agar chart lama hilang
    document.getElementById('chart3_treemap_placeholder').innerHTML = "";
    
    // Jika tidak ada data setelah difilter, jangan gambar
    if (data.length === 0) return;

    google.charts.load('current', {'packages':['treemap']});
    google.charts.setOnLoadCallback(drawChart);

    function drawChart() {
        // Konversi data Anda ke format yang dimengerti Google Charts
        const dataForGoogle = [
            ['ID', 'Parent', 'Customers (Size)'],
            ['Global', null, 0] 
        ];

        const locations = new Set(data.map(row => row.Location));
        locations.forEach(loc => {
            dataForGoogle.push([loc, 'Global', 0]);
        });

        // Tambahkan data anak (Kategori Produk)
        data.forEach(row => {
            if (row.Total_Customers > 0) {
                dataForGoogle.push([
                    row.Product_Category + '_' + row.Location, 
                    row.Location,
                    row.Total_Customers 
                ]);
            }
        });

        const dataTable = google.visualization.arrayToDataTable(dataForGoogle);
        const chartDiv = document.getElementById('chart3_treemap_placeholder');
        const chart = new google.visualization.TreeMap(chartDiv);

        chart.draw(dataTable, {
            title: 'Hirarki Jumlah Pelanggan (Lokasi & Kategori)',
            
            // --- PERUBAHAN WARNA DI SINI ---
            minColor: '#E6F0FF', // Warna biru paling muda (untuk nilai rendah)
            midColor: '#5A9BD4', // Warna biru tengah
            maxColor: '#004A99', // Warna biru paling tua (untuk nilai tinggi)
            // --- AKHIR PERUBAHAN ---

            headerHeight: 20,
            fontColor: 'black',
            showScale: true // Tampilkan skala gradien warna
        });
    }
}

function createChart4_GroupedBar(data) {
    if (chartInstances['chart4']) {
        chartInstances['chart4'].destroy();
    }
    
    const labels = data.map(row => row.Location);
    const femaleData = data.map(row => row.F);
    const maleData = data.map(row => row.M);

    const ctx = document.getElementById('chart4_grouped_bar').getContext('2d');
    chartInstances['chart4'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pria (M)',
                    data: femaleData,
                    backgroundColor: 'rgba(0, 122, 198, 0.9)'
                },
                {
                    label: 'Wanita (F)',
                    data: maleData,
                    backgroundColor: 'rgba(255, 81, 0, 0.94)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { title: { display: true, text: 'Lokasi' } },
                y: { beginAtZero: true, title: { display: true, text: 'Jumlah Pelanggan' } }
            },
            plugins: {
                legend: { display: true, position: 'top', align: 'end' }
            }
        }
    });
}

function createChart5_PieGender(data) {
    if (chartInstances['chart5']) {
        chartInstances['chart5'].destroy();
    }
    
    const labels = data.map(row => row.Gender === 'M' ? 'Pria' : 'Wanita');
    const customers = data.map(row => row.Total_Customers);

    const ctx = document.getElementById('chart5_pie_gender').getContext('2d');
    chartInstances['chart5'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Pelanggan',
                data: customers,
                backgroundColor: [
                    'rgba(255, 81, 0, 0.94)',  // Wanita
                    'rgba(0, 122, 198, 0.9)' // Pria
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// -------------------------------------------------------------------------
// Fungsi Tabel (Hanya isi ulang, tidak perlu di-destroy)
// -------------------------------------------------------------------------

function fillTable1_Tax(data) {
    const tbody = document.querySelector("#table1_tax tbody");
    tbody.innerHTML = ""; // Kosongkan isi tabel
    
    data.forEach(row => {
        if (row.Product_Category && row.GST) {
            tbody.innerHTML += `
                <tr>
                    <td>${row.Product_Category}</td>
                    <td>${row.GST}</td>
                </tr>
            `;
        }
    });
}

function fillTable2_Discount(data) {
    const tbody = document.querySelector("#table2_discount tbody");
    tbody.innerHTML = ""; // Kosongkan isi tabel

    const sampleData = data.slice(0, 50);

    sampleData.forEach(row => {
        if (row.Month && row.Coupon_Code) {
            const discount = row.Discount_pct ? `${row.Discount_pct.toFixed(0)}%` : 'N/A';
            tbody.innerHTML += `
                <tr>
                    <td>${row.Month}</td>
                    <td>${row.Coupon_Code}</td>
                    <td>${discount}</td>
                </tr>
            `;
        }
    });
}