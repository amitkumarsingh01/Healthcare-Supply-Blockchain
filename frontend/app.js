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

        activityContainer.innerHTML = recentMedicines.map(medicine => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-pills"></i>
                </div>
                <div class="activity-content">
                    <h4>${medicine.name}</h4>
                    <p>Batch: ${medicine.batchNumber} | Status: ${this.formatStatus(medicine.status)}</p>
                </div>
            </div>
        `).join('');
    }

    displayMedicines(medicines) {
        const container = document.getElementById('medicinesList');
        
        if (medicines.length === 0) {
            container.innerHTML = '<p class="no-data">No medicines found.</p>';
            return;
        }

        container.innerHTML = medicines.map(medicine => `
            <div class="medicine-card">
                <h3>${medicine.name}</h3>
                <div class="medicine-info">
                    <span><strong>ID:</strong> ${medicine.id}</span>
                    <span><strong>Batch:</strong> ${medicine.batchNumber}</span>
                    <span><strong>Status:</strong> <span class="status-badge status-${medicine.status.toLowerCase()}">${this.formatStatus(medicine.status)}</span></span>
                    <span><strong>Owner:</strong> ${medicine.currentOwner.slice(0, 6)}...${medicine.currentOwner.slice(-4)}</span>
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
        `).join('');
    }

    async handleManufactureMedicine() {
        if (!metaMaskService.isConnected) {
            this.showNotification('Please connect MetaMask first', 'error');
            return;
        }

        // Check if contract addresses are loaded
        if (!contractAddresses.medicineSupplyChain) {
            this.showNotification('Contract addresses not loaded. Please refresh the page.', 'error');
            return;
        }

        const formData = {
            name: document.getElementById('medicineName').value,
            batchNumber: document.getElementById('batchNumber').value,
            expiryDate: Math.floor(new Date(document.getElementById('expiryDate').value).getTime() / 1000),
            temperatureThreshold: parseInt(document.getElementById('temperatureThreshold').value),
            temperatureSensitive: document.getElementById('temperatureSensitive').checked
        };

        try {
            this.showLoading();
            console.log('🔗 Manufacturing medicine on blockchain...');
            console.log('Contract address:', contractAddresses.medicineSupplyChain);
            console.log('Form data:', formData);
            
            // Call smart contract directly
            const txHash = await metaMaskService.sendContractTransaction(
                contractAddresses.medicineSupplyChain,
                MEDICINE_SUPPLY_CHAIN_ABI,
                'manufactureMedicine',
                [
                    formData.name,
                    formData.batchNumber,
                    formData.expiryDate,
                    formData.temperatureThreshold,
                    formData.temperatureSensitive
                ]
            );

            console.log('✅ Blockchain transaction successful:', txHash);
            this.showNotification(`🔗 Medicine manufactured on blockchain! Transaction: ${txHash.slice(0, 10)}...`, 'success');
            document.getElementById('manufactureForm').reset();
            
            // Refresh dashboard
            await this.loadDashboard();
            
        } catch (error) {
            console.error('❌ Blockchain transaction failed:', error);
            this.showNotification(`❌ Failed to manufacture medicine on blockchain: ${error.message}`, 'error');
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
            location: document.getElementById('transferLocation').value
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
                    location: formData.location
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
            console.log('🔗 Querying blockchain for medicine tracking...');
            
            const response = await fetch(`${this.apiBaseUrl}/medicines/${medicineId}`);
            if (!response.ok) {
                throw new Error('Medicine not found on blockchain');
            }

            const medicine = await response.json();
            console.log('✅ Blockchain query successful for medicine:', medicine.id);
            this.displayTrackingResults(medicine);
            
        } catch (error) {
            console.error('❌ Blockchain query failed:', error);
            this.showNotification(`❌ Error tracking medicine on blockchain: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async trackMedicineById(medicineId) {
        document.getElementById('trackMedicineId').value = medicineId;
        this.showSection('track');
        await this.handleTrackMedicine();
    }

    displayTrackingResults(medicine) {
        const container = document.getElementById('trackingResults');
        
        container.innerHTML = `
            <div class="medicine-details">
                <h3>${medicine.name}</h3>
                <div class="medicine-info">
                    <span><strong>ID:</strong> ${medicine.id}</span>
                    <span><strong>Batch:</strong> ${medicine.batchNumber}</span>
                    <span><strong>Status:</strong> <span class="status-badge status-${medicine.status.toLowerCase()}">${this.formatStatus(medicine.status)}</span></span>
                    <span><strong>Current Owner:</strong> ${medicine.currentOwner}</span>
                    <span><strong>Manufacturer:</strong> ${medicine.manufacturer}</span>
                    <span><strong>Expiry Date:</strong> ${this.formatDate(medicine.expiryDate)}</span>
                </div>
            </div>
            <div class="tracking-timeline">
                <h4>Supply Chain Timeline</h4>
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
                            <h4>Current Status: ${this.formatStatus(medicine.status)}</h4>
                            <p>Currently owned by ${medicine.currentOwner}</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        container.style.display = 'block';
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
