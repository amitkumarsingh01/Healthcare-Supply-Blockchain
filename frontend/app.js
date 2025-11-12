// Main Application Logic
class HealthcareSupplyChainApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8005';
        this.currentSection = 'dashboard';
        this.medicines = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadDashboard();
        this.showSection('dashboard');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.showSection(section);
            });
        });

        // MetaMask connection
        document.getElementById('connectWallet').addEventListener('click', async () => {
            try {
                await metaMaskService.connect();
                this.showNotification('MetaMask connected successfully!', 'success');
                await this.loadDashboard();
            } catch (error) {
                this.showNotification(`Failed to connect MetaMask: ${error.message}`, 'error');
            }
        });

        // Manufacture form
        document.getElementById('manufactureForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleManufactureMedicine();
        });

        // Transfer form
        document.getElementById('transferForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleTransferMedicine();
        });

        // Dynamic status preview for transfer form
        document.getElementById('transferStatus').addEventListener('change', () => {
            this.updateTransferStatusPreview();
        });
        document.getElementById('transferWhom').addEventListener('input', () => {
            this.updateTransferStatusPreview();
        });

        // Track medicine
        document.getElementById('trackBtn').addEventListener('click', async () => {
            await this.handleTrackMedicine();
        });

        // Search medicines
        document.getElementById('searchBtn').addEventListener('click', async () => {
            await this.searchMedicines();
        });

        document.getElementById('medicineSearch').addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await this.searchMedicines();
            }
        });

        // Notification close
        document.getElementById('closeNotification').addEventListener('click', () => {
            this.hideNotification();
        });
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected section
        document.getElementById(sectionName).classList.add('active');
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        this.currentSection = sectionName;

        // Load section-specific data
        switch (sectionName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'medicines':
                this.loadMedicines();
                break;
        }
    }

    async loadDashboard() {
        try {
            this.showLoading();
            const medicines = await this.fetchMedicines();
            this.updateDashboardStats(medicines);
            this.updateRecentActivity(medicines);
        } catch (error) {
            this.showNotification(`Error loading dashboard: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadMedicines() {
        try {
            this.showLoading();
            const medicines = await this.fetchMedicines();
            this.displayMedicines(medicines);
        } catch (error) {
            this.showNotification(`Error loading medicines: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async fetchMedicines() {
        console.log('🔗 Querying blockchain for medicines...');
        const response = await fetch(`${this.apiBaseUrl}/medicines`);
        if (!response.ok) {
            throw new Error('Failed to fetch medicines from blockchain');
        }
        const medicines = await response.json();
        console.log('✅ Blockchain query successful:', medicines.length, 'medicines found');
        return medicines;
    }

    updateDashboardStats(medicines) {
        const totalMedicines = medicines.length;
        const manufactured = medicines.filter(m => m.status === 'MANUFACTURED').length;
        const inTransit = medicines.filter(m => 
            m.status === 'SHIPPED_TO_DISTRIBUTOR' || 
            m.status === 'SHIPPED_TO_PHARMACY'
        ).length;
        const atPharmacy = medicines.filter(m => 
            m.status === 'RECEIVED_BY_PHARMACY'
        ).length;

        document.getElementById('totalMedicines').textContent = totalMedicines;
        document.getElementById('manufacturedMedicines').textContent = manufactured;
        document.getElementById('inTransitMedicines').textContent = inTransit;
        document.getElementById('pharmacyMedicines').textContent = atPharmacy;
    }

    updateRecentActivity(medicines) {
        const activityContainer = document.getElementById('recentActivity');
        const recentMedicines = medicines.slice(-5).reverse();

        activityContainer.innerHTML = recentMedicines.map(medicine => {
            const ownerName = medicine.currentOwnerName || "Unknown";
            const statusDisplay = medicine.statusFormatted || this.formatStatus(medicine.status);
            return `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-pills"></i>
                </div>
                <div class="activity-content">
                    <h4>${medicine.name}</h4>
                    <p>Batch: ${medicine.batchNumber} | Status: ${statusDisplay} | Owner: ${ownerName}</p>
                </div>
            </div>
        `;
        }).join('');
    }

    displayMedicines(medicines) {
        const container = document.getElementById('medicinesList');
        
        if (medicines.length === 0) {
            container.innerHTML = '<p class="no-data">No medicines found.</p>';
            return;
        }

        container.innerHTML = medicines.map(medicine => {
            const ownerName = medicine.currentOwnerName || "Unknown";
            const statusDisplay = medicine.statusFormatted || this.formatStatus(medicine.status);
            return `
            <div class="medicine-card">
                <h3>${medicine.name}</h3>
                <div class="medicine-info">
                    <span><strong>ID:</strong> ${medicine.id}</span>
                    <span><strong>Batch:</strong> ${medicine.batchNumber}</span>
                    <span><strong>Status:</strong> <span class="status-badge status-${medicine.status.toLowerCase()}">${statusDisplay}</span></span>
                    <span><strong>Owner:</strong> ${ownerName} <small>(${medicine.currentOwner.slice(0, 6)}...${medicine.currentOwner.slice(-4)})</small></span>
                    <span><strong>Manufactured:</strong> ${this.formatDate(medicine.manufactureDate)}</span>
                    <span><strong>Expires:</strong> ${this.formatDate(medicine.expiryDate)}</span>
                </div>
                <div class="blockchain-info">
                    <span class="blockchain-badge">🔗 Tx: ${medicine.blockchainTxHash.slice(0, 10)}...</span>
                    <span class="blockchain-badge">📦 Block: ${medicine.blockNumber}</span>
                    <span class="blockchain-badge">⛽ Gas: ${medicine.gasUsed}</span>
                </div>
                <div class="medicine-actions">
                    <button class="btn btn-secondary" onclick="app.trackMedicineById(${medicine.id})">
                        <i class="fas fa-search"></i> Track
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    async handleManufactureMedicine() {
        if (!metaMaskService.isConnected) {
            this.showNotification('Please connect MetaMask first', 'error');
            return;
        }

        const name = document.getElementById('medicineName').value.trim();
        const batchNumber = document.getElementById('batchNumber').value.trim();
        const expiryDate = document.getElementById('expiryDate').value;
        
        // Validation
        if (!name || !batchNumber || !expiryDate) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const formData = {
            name: name,
            batchNumber: batchNumber,
            expiryDate: Math.floor(new Date(expiryDate).getTime() / 1000),
            temperatureThreshold: parseInt(document.getElementById('temperatureThreshold').value) || 25,
            temperatureSensitive: document.getElementById('temperatureSensitive').checked
        };

        try {
            this.showLoading();
            console.log('🔗 Manufacturing medicine...');
            console.log('Form data:', formData);
            console.log('API URL:', `${this.apiBaseUrl}/medicines`);
            
            // Use backend API (in-memory database)
            const response = await fetch(`${this.apiBaseUrl}/medicines`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                console.error('Error response:', errorData);
                throw new Error(errorData.detail || `HTTP ${response.status}: Failed to manufacture medicine`);
            }

            const result = await response.json();
            console.log('✅ Medicine manufactured successfully:', result);
            this.showNotification(`✅ Medicine "${result.name}" manufactured successfully! ID: ${result.id}`, 'success');
            document.getElementById('manufactureForm').reset();
            
            // Refresh dashboard
            await this.loadDashboard();
            
        } catch (error) {
            console.error('❌ Failed to manufacture medicine:', error);
            this.showNotification(`❌ Failed to manufacture medicine: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleTransferMedicine() {
        if (!metaMaskService.isConnected) {
            this.showNotification('Please connect MetaMask first', 'error');
            return;
        }

        const formData = {
            medicineId: parseInt(document.getElementById('transferMedicineId').value),
            toAddress: document.getElementById('transferTo').value,
            newStatus: document.getElementById('transferStatus').value,
            location: document.getElementById('transferLocation').value,
            recipientName: document.getElementById('transferWhom').value.trim() || null
        };

        try {
            this.showLoading();
            console.log('🔗 Transferring medicine on blockchain...');
            
            const response = await fetch(`${this.apiBaseUrl}/medicines/${formData.medicineId}/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toAddress: formData.toAddress,
                    newStatus: formData.newStatus,
                    location: formData.location,
                    recipientName: formData.recipientName
                })
            });

            if (!response.ok) {
                throw new Error('Failed to transfer medicine on blockchain');
            }

            const result = await response.json();
            console.log('✅ Blockchain transfer successful:', result.transaction_hash);
            this.showNotification(`🔗 Medicine transferred on blockchain! Transaction: ${result.transaction_hash.slice(0, 10)}...`, 'success');
            document.getElementById('transferForm').reset();
            
            // Refresh dashboard
            await this.loadDashboard();
            
        } catch (error) {
            console.error('❌ Blockchain transfer failed:', error);
            this.showNotification(`❌ Failed to transfer medicine on blockchain: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleTrackMedicine() {
        const medicineId = document.getElementById('trackMedicineId').value;
        
        if (!medicineId) {
            this.showNotification('Please enter a medicine ID', 'error');
            return;
        }

        try {
            this.showLoading();
            console.log('🔗 Querying backend for medicine tracking...');
            console.log('Medicine ID:', medicineId);
            
            // Fetch both medicine details and stages
            const [medicineResponse, stagesResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/medicines/${medicineId}`),
                fetch(`${this.apiBaseUrl}/medicines/${medicineId}/stages`)
            ]);
            
            if (!medicineResponse.ok) {
                throw new Error('Medicine not found');
            }

            const medicine = await medicineResponse.json();
            const stagesData = await stagesResponse.json();
            
            console.log('✅ Medicine data:', medicine);
            console.log('✅ Stages data:', stagesData);
            console.log('✅ Number of stages:', stagesData.stages ? stagesData.stages.length : 0);
            
            this.displayTrackingResults(medicine, stagesData.stages || []);
            
        } catch (error) {
            console.error('❌ Query failed:', error);
            this.showNotification(`❌ Error tracking medicine: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async trackMedicineById(medicineId) {
        document.getElementById('trackMedicineId').value = medicineId;
        this.showSection('track');
        await this.handleTrackMedicine();
    }

    displayTrackingResults(medicine, stages = []) {
        const container = document.getElementById('trackingResults');
        
        console.log('Displaying tracking results for medicine:', medicine);
        console.log('Stages to display:', stages);
        
        // Build timeline items from stages
        let timelineHTML = '';
        
        if (stages && stages.length > 0) {
            console.log(`Rendering ${stages.length} stages`);
            timelineHTML = stages.map((stage, index) => {
                const icon = this.getStageIcon(stage.stage);
                const isCurrent = index === stages.length - 1;
                console.log(`Rendering stage ${index + 1}: ${stage.stage} with icon: ${icon}`);
                
                const ownerName = stage.ownerName || "Unknown";
                const stageDisplay = stage.stageFormatted || this.formatStatus(stage.stage);
                const recipientName = stage.recipientName || stage.pharmacyName || stage.distributorName || stage.patientName;
                
                return `
                <div class="timeline-item">
                    <div class="timeline-icon ${isCurrent ? 'current' : ''}">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="timeline-content">
                        <h4>${stageDisplay}</h4>
                        <p><strong>Location:</strong> ${stage.location}</p>
                        <p><strong>Owner:</strong> ${ownerName} <small>(${stage.owner.slice(0, 6)}...${stage.owner.slice(-4)})</small></p>
                        ${recipientName ? `<p><strong>Recipient:</strong> ${recipientName}</p>` : ''}
                        <p><strong>Tx Hash:</strong> ${stage.txHash}</p>
                        <small>${this.formatDate(stage.timestamp)}</small>
                    </div>
                </div>
            `;
            }).join('');
        } else {
            console.log('No stages found, using fallback');
            // Fallback to basic info if no stages
            const ownerName = medicine.currentOwnerName || "Unknown";
            const statusDisplay = medicine.statusFormatted || this.formatStatus(medicine.status);
            timelineHTML = `
                <div class="timeline-item">
                    <div class="timeline-content">
                        <h4>Manufactured</h4>
                        <p>Medicine manufactured by ${medicine.manufacturer}</p>
                        <small>${this.formatDate(medicine.manufactureDate)}</small>
                    </div>
                </div>
                ${medicine.status !== 'MANUFACTURED' ? `
                    <div class="timeline-item">
                        <div class="timeline-content">
                            <h4>Current Status: ${statusDisplay}</h4>
                            <p>Currently owned by ${ownerName} (${medicine.currentOwner})</p>
                        </div>
                    </div>
                ` : ''}
            `;
        }
        
        const ownerName = medicine.currentOwnerName || "Unknown";
        const statusDisplay = medicine.statusFormatted || this.formatStatus(medicine.status);
        
        container.innerHTML = `
            <div class="medicine-details">
                <h3>${medicine.name}</h3>
                <div class="medicine-info">
                    <span><strong>ID:</strong> ${medicine.id}</span>
                    <span><strong>Batch:</strong> ${medicine.batchNumber}</span>
                    <span><strong>Status:</strong> <span class="status-badge status-${medicine.status.toLowerCase()}">${statusDisplay}</span></span>
                    <span><strong>Current Owner:</strong> ${ownerName} <small>(${medicine.currentOwner})</small></span>
                    <span><strong>Manufacturer:</strong> ${medicine.manufacturer}</span>
                    <span><strong>Expiry Date:</strong> ${this.formatDate(medicine.expiryDate)}</span>
                </div>
            </div>
            <div class="tracking-timeline">
                <h4>Complete Supply Chain Timeline (${stages ? stages.length : 0} stages)</h4>
                ${timelineHTML}
            </div>
        `;
        
        container.style.display = 'block';
    }

    getStageIcon(stage) {
        const icons = {
            'MANUFACTURED': 'industry',
            'SHIPPED_TO_DISTRIBUTOR': 'truck',
            'RECEIVED_BY_DISTRIBUTOR': 'warehouse',
            'SHIPPED_TO_PHARMACY': 'truck-loading',
            'RECEIVED_BY_PHARMACY': 'store',
            'SOLD_TO_PATIENT': 'user-check',
            'EXPIRED': 'exclamation-circle',
            'RECALLED': 'exclamation-triangle'
        };
        const icon = icons[stage] || 'circle';
        console.log(`Stage: ${stage} -> Icon: ${icon}`);
        return icon;
    }

    async searchMedicines() {
        const searchTerm = document.getElementById('medicineSearch').value.toLowerCase();
        
        if (!searchTerm) {
            await this.loadMedicines();
            return;
        }

        try {
            const medicines = await this.fetchMedicines();
            const filteredMedicines = medicines.filter(medicine => 
                medicine.name.toLowerCase().includes(searchTerm) ||
                medicine.batchNumber.toLowerCase().includes(searchTerm)
            );
            
            this.displayMedicines(filteredMedicines);
        } catch (error) {
            this.showNotification(`Error searching medicines: ${error.message}`, 'error');
        }
    }

    formatStatus(status) {
        // If status already includes recipient name from backend (distributor, pharmacy, or patient), use it
        if (status.includes('CITY Engg Pharmacy') || status.includes('Pharmacy') || 
            status.includes('Global Distributors') || status.includes('Distributor') ||
            status.includes('John Smith') || status.includes('Sarah Johnson') || status.includes('Patient')) {
            return status;
        }
        
        const statusMap = {
            'MANUFACTURED': 'Manufactured',
            'SHIPPED_TO_DISTRIBUTOR': 'Shipped to Distributor',
            'RECEIVED_BY_DISTRIBUTOR': 'Received by Distributor',
            'SHIPPED_TO_PHARMACY': 'Shipped to Pharmacy',
            'RECEIVED_BY_PHARMACY': 'Received by Pharmacy',
            'SOLD_TO_PATIENT': 'Sold to Patient',
            'EXPIRED': 'Expired',
            'RECALLED': 'Recalled'
        };
        return statusMap[status] || status;
    }

    formatDate(timestamp) {
        return new Date(timestamp * 1000).toLocaleDateString();
    }

    updateTransferStatusPreview() {
        const statusSelect = document.getElementById('transferStatus');
        const whomInput = document.getElementById('transferWhom');
        const previewGroup = document.getElementById('statusPreviewGroup');
        const previewBadge = document.getElementById('statusPreviewBadge');
        
        const selectedStatus = statusSelect.value;
        const recipientName = whomInput.value.trim();
        
        if (!selectedStatus) {
            previewGroup.style.display = 'none';
            return;
        }
        
        previewGroup.style.display = 'block';
        
        // Format status with recipient name
        let statusText = '';
        let statusClass = '';
        
        if (selectedStatus === 'SHIPPED_TO_DISTRIBUTOR') {
            statusText = recipientName ? `Shipped to ${recipientName}` : 'Shipped to Distributor';
            statusClass = 'status-shipped_to_distributor';
        } else if (selectedStatus === 'RECEIVED_BY_DISTRIBUTOR') {
            statusText = recipientName ? `Received by ${recipientName}` : 'Received by Distributor';
            statusClass = 'status-received_by_distributor';
        } else if (selectedStatus === 'SHIPPED_TO_PHARMACY') {
            statusText = recipientName ? `Shipped to ${recipientName}` : 'Shipped to Pharmacy';
            statusClass = 'status-shipped_to_pharmacy';
        } else if (selectedStatus === 'RECEIVED_BY_PHARMACY') {
            statusText = recipientName ? `Received by ${recipientName}` : 'Received by Pharmacy';
            statusClass = 'status-received_by_pharmacy';
        } else if (selectedStatus === 'SOLD_TO_PATIENT') {
            statusText = recipientName ? `Sold to ${recipientName}` : 'Sold to Patient';
            statusClass = 'status-sold_to_patient';
        } else {
            statusText = selectedStatus;
            statusClass = 'status-' + selectedStatus.toLowerCase();
        }
        
        previewBadge.textContent = statusText;
        previewBadge.className = `status-badge ${statusClass}`;
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageElement = document.getElementById('notificationMessage');
        
        messageElement.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'flex';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        document.getElementById('notification').style.display = 'none';
    }
}

// Initialize the application
const app = new HealthcareSupplyChainApp();
