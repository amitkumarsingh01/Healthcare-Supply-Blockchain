// MetaMask Integration
class MetaMaskService {
    constructor() {
        this.ethereum = window.ethereum;
        this.account = null;
        this.chainId = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            if (!this.ethereum) {
                throw new Error('MetaMask is not installed');
            }

            // Request account access
            const accounts = await this.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            this.account = accounts[0];
            this.chainId = await this.ethereum.request({ method: 'eth_chainId' });
            this.isConnected = true;

            // Listen for account changes
            this.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.account = accounts[0];
                    this.updateUI();
                }
            });

            // Listen for chain changes
            this.ethereum.on('chainChanged', (chainId) => {
                this.chainId = chainId;
                this.updateUI();
            });

            this.updateUI();
            return this.account;

        } catch (error) {
            console.error('Error connecting to MetaMask:', error);
            throw error;
        }
    }

    async disconnect() {
        this.account = null;
        this.chainId = null;
        this.isConnected = false;
        this.updateUI();
    }

    async getBalance() {
        if (!this.isConnected) return '0';
        
        try {
            const balance = await this.ethereum.request({
                method: 'eth_getBalance',
                params: [this.account, 'latest']
            });
            return this.formatBalance(balance);
        } catch (error) {
            console.error('Error getting balance:', error);
            return '0';
        }
    }

    formatBalance(balance) {
        const wei = parseInt(balance, 16);
        const eth = wei / Math.pow(10, 18);
        return eth.toFixed(4);
    }

    async switchToLocalNetwork() {
        try {
            await this.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x539', // 1337 in hex
                    chainName: 'Hardhat Local',
                    nativeCurrency: {
                        name: 'ETH',
                        symbol: 'ETH',
                        decimals: 18
                    },
                    rpcUrls: ['http://127.0.0.1:8545'],
                    blockExplorerUrls: null
                }]
            });
        } catch (error) {
            console.error('Error adding local network:', error);
        }
    }

    async signTransaction(transaction) {
        try {
            const txHash = await this.ethereum.request({
                method: 'eth_sendTransaction',
                params: [transaction]
            });
            return txHash;
        } catch (error) {
            console.error('Error signing transaction:', error);
            throw error;
        }
    }

    updateUI() {
        const connectBtn = document.getElementById('connectWallet');
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        const walletBalance = document.getElementById('walletBalance');

        if (this.isConnected) {
            connectBtn.textContent = 'Connected';
            connectBtn.style.background = '#27ae60';
            walletInfo.style.display = 'flex';
            walletAddress.textContent = `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
            
            this.getBalance().then(balance => {
                walletBalance.textContent = `${balance} ETH`;
            });
        } else {
            connectBtn.textContent = 'Connect MetaMask';
            connectBtn.style.background = '#3498db';
            walletInfo.style.display = 'none';
        }
    }

    async callContractMethod(contractAddress, abi, methodName, params = []) {
        try {
            // Wait for ethers.js to be available
            await this.waitForEthers();
            
            // Use ethers.js for contract interaction
            const provider = new ethers.providers.Web3Provider(this.ethereum);
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const result = await contract[methodName](...params);
            return result;
        } catch (error) {
            console.error('Error calling contract method:', error);
            throw error;
        }
    }

    async sendContractTransaction(contractAddress, abi, methodName, params = [], value = '0x0') {
        try {
            // Wait for ethers.js to be available
            await this.waitForEthers();
            
            // Use ethers.js for contract interaction
            const provider = new ethers.providers.Web3Provider(this.ethereum);
            const signer = provider.getSigner();
            const contract = new ethers.Contract(contractAddress, abi, signer);
            
            const tx = await contract[methodName](...params, {
                value: value
            });
            
            console.log('🔗 Transaction sent:', tx.hash);
            await tx.wait();
            console.log('✅ Transaction confirmed:', tx.hash);
            
            return tx.hash;
        } catch (error) {
            console.error('Error sending contract transaction:', error);
            throw error;
        }
    }

    async waitForEthers(timeout = 10000) {
        const startTime = Date.now();
        while (typeof ethers === 'undefined') {
            if (Date.now() - startTime > timeout) {
                throw new Error('Ethers.js library failed to load within timeout period');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    }
}

// Initialize MetaMask service
const metaMaskService = new MetaMaskService();

// Debug ethers.js loading
function checkEthersAvailability() {
    console.log('Ethers.js loaded:', typeof ethers !== 'undefined');
    if (typeof ethers !== 'undefined') {
        console.log('Ethers version:', ethers.version);
        return true;
    }
    return false;
}

// Check ethers availability immediately
checkEthersAvailability();

// Also check after a short delay in case it's still loading
setTimeout(() => {
    if (!checkEthersAvailability()) {
        console.warn('⚠️ Ethers.js still not available after delay');
    }
}, 1000);

// Contract ABIs (simplified versions)
const ACCESS_CONTROL_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "getRole",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    }
];

const MEDICINE_SUPPLY_CHAIN_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "name", "type": "string"},
            {"internalType": "string", "name": "batchNumber", "type": "string"},
            {"internalType": "uint256", "name": "expiryDate", "type": "uint256"},
            {"internalType": "uint256", "name": "temperatureThreshold", "type": "uint256"},
            {"internalType": "bool", "name": "temperatureSensitive", "type": "bool"}
        ],
        "name": "manufactureMedicine",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "medicineId", "type": "uint256"}],
        "name": "getMedicine",
        "outputs": [
            {"internalType": "uint256", "name": "id", "type": "uint256"},
            {"internalType": "string", "name": "name", "type": "string"},
            {"internalType": "string", "name": "batchNumber", "type": "string"},
            {"internalType": "uint256", "name": "manufactureDate", "type": "uint256"},
            {"internalType": "uint256", "name": "expiryDate", "type": "uint256"},
            {"internalType": "address", "name": "manufacturer", "type": "address"},
            {"internalType": "address", "name": "currentOwner", "type": "address"},
            {"internalType": "uint8", "name": "status", "type": "uint8"},
            {"internalType": "uint256", "name": "temperatureThreshold", "type": "uint256"},
            {"internalType": "bool", "name": "temperatureSensitive", "type": "bool"},
            {"internalType": "string[]", "name": "temperatureReadings", "type": "string[]"},
            {"internalType": "uint256[]", "name": "temperatureTimestamps", "type": "uint256[]"},
            {"internalType": "string[]", "name": "locationHistory", "type": "string[]"},
            {"internalType": "uint256[]", "name": "locationTimestamps", "type": "uint256[]"},
            {"internalType": "bool", "name": "isActive", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalMedicines",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// Contract addresses (will be loaded from deployment info)
let contractAddresses = {
    accessControl: null,
    medicineSupplyChain: null
};

// Load contract addresses
async function loadContractAddresses() {
    try {
        // Try to load from backend API first
        const response = await fetch('http://localhost:8005/contracts/info');
        const info = await response.json();
        contractAddresses.accessControl = info.accessControlAddress;
        contractAddresses.medicineSupplyChain = info.medicineSupplyChainAddress;
        console.log('✅ Contract addresses loaded from backend:', contractAddresses);
    } catch (error) {
        console.warn('Backend API not available, trying to load from deployment info...');
        try {
            // Fallback to deployment info file
            const response = await fetch('./deployment-info.json');
            const deploymentInfo = await response.json();
            contractAddresses.accessControl = deploymentInfo.contracts.AccessControl.address;
            contractAddresses.medicineSupplyChain = deploymentInfo.contracts.MedicineSupplyChain.address;
            console.log('✅ Contract addresses loaded from deployment info:', contractAddresses);
        } catch (fallbackError) {
            console.error('Error loading contract addresses from both sources:', fallbackError);
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadContractAddresses();
});
