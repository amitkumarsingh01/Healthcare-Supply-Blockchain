import json
import os
from web3 import Web3
from typing import Dict, List, Optional, Any
from models import MedicineStatus, Role

class BlockchainService:
    def __init__(self):
        self.w3 = None
        self.access_control_contract = None
        self.medicine_supply_chain_contract = None
        self.connected = False
        self.load_deployment_info()
        
    def load_deployment_info(self):
        """Load contract deployment information"""
        try:
            with open('../deployment-info.json', 'r') as f:
                self.deployment_info = json.load(f)
            self.setup_web3()
        except FileNotFoundError:
            print("Deployment info not found. Please deploy contracts first.")
            self.deployment_info = None
    
    def setup_web3(self):
        """Setup Web3 connection"""
        try:
            # Connect to local Hardhat network
            self.w3 = Web3(Web3.HTTPProvider('http://127.0.0.1:8545'))
            
            if not self.w3.is_connected():
                print("Failed to connect to blockchain")
                return
                
            # Load contract ABIs
            access_control_abi = json.loads(self.deployment_info['contracts']['AccessControl']['abi'])
            medicine_supply_chain_abi = json.loads(self.deployment_info['contracts']['MedicineSupplyChain']['abi'])
            
            # Create contract instances
            self.access_control_contract = self.w3.eth.contract(
                address=self.deployment_info['contracts']['AccessControl']['address'],
                abi=access_control_abi
            )
            
            self.medicine_supply_chain_contract = self.w3.eth.contract(
                address=self.deployment_info['contracts']['MedicineSupplyChain']['address'],
                abi=medicine_supply_chain_abi
            )
            
            self.connected = True
            print("Connected to blockchain successfully")
            
        except Exception as e:
            print(f"Error setting up Web3: {e}")
            self.connected = False
    
    def is_connected(self) -> bool:
        """Check if blockchain connection is active"""
        return self.connected and self.w3 is not None and self.w3.is_connected()
    
    def get_account(self):
        """Get the first account from the local network"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        return self.w3.eth.accounts[0]
    
    async def manufacture_medicine(self, name: str, batch_number: str, expiry_date: int, 
                                 temperature_threshold: int, temperature_sensitive: bool) -> Dict[str, Any]:
        """Manufacture a new medicine"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        account = self.get_account()
        
        # Build transaction
        transaction = self.medicine_supply_chain_contract.functions.manufactureMedicine(
            name, batch_number, expiry_date, temperature_threshold, temperature_sensitive
        ).build_transaction({
            'from': account,
            'gas': 500000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account)
        })
        
        # Sign and send transaction
        signed_txn = self.w3.eth.account.sign_transaction(transaction, os.getenv('PRIVATE_KEY', ''))
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        # Wait for transaction receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Get the medicine ID from the event
        medicine_id = self.medicine_supply_chain_contract.events.MedicineManufactured().process_receipt(receipt)[0]['args']['medicineId']
        
        # Return medicine data
        return await self.get_medicine(medicine_id)
    
    async def get_medicine(self, medicine_id: int) -> Optional[Dict[str, Any]]:
        """Get medicine details by ID"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        try:
            medicine_data = self.medicine_supply_chain_contract.functions.getMedicine(medicine_id).call()
            
            return {
                'id': medicine_data[0],
                'name': medicine_data[1],
                'batchNumber': medicine_data[2],
                'manufactureDate': medicine_data[3],
                'expiryDate': medicine_data[4],
                'manufacturer': medicine_data[5],
                'currentOwner': medicine_data[6],
                'status': MedicineStatus(medicine_data[7]).value,
                'temperatureThreshold': medicine_data[8],
                'temperatureSensitive': medicine_data[9],
                'isActive': medicine_data[15]
            }
        except Exception as e:
            print(f"Error getting medicine {medicine_id}: {e}")
            return None
    
    async def get_all_medicines(self) -> List[Dict[str, Any]]:
        """Get all medicines"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        medicines = []
        total_medicines = self.medicine_supply_chain_contract.functions.getTotalMedicines().call()
        
        for i in range(1, total_medicines + 1):
            medicine = await self.get_medicine(i)
            if medicine:
                medicines.append(medicine)
        
        return medicines
    
    async def get_medicines_by_batch(self, batch_number: str) -> List[Dict[str, Any]]:
        """Get medicines by batch number"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        medicine_ids = self.medicine_supply_chain_contract.functions.getMedicinesByBatch(batch_number).call()
        medicines = []
        
        for medicine_id in medicine_ids:
            medicine = await self.get_medicine(medicine_id)
            if medicine:
                medicines.append(medicine)
        
        return medicines
    
    async def transfer_medicine(self, medicine_id: int, to_address: str, new_status: str, location: str) -> str:
        """Transfer medicine to next stage"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        account = self.get_account()
        
        # Convert status string to enum value
        status_enum = getattr(MedicineStatus, new_status).value
        
        transaction = self.medicine_supply_chain_contract.functions.transferMedicine(
            medicine_id, to_address, status_enum, location
        ).build_transaction({
            'from': account,
            'gas': 500000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account)
        })
        
        signed_txn = self.w3.eth.account.sign_transaction(transaction, os.getenv('PRIVATE_KEY', ''))
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
    
    async def update_temperature(self, medicine_id: int, temperature: str) -> str:
        """Update temperature reading"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        account = self.get_account()
        
        transaction = self.medicine_supply_chain_contract.functions.updateTemperature(
            medicine_id, temperature
        ).build_transaction({
            'from': account,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account)
        })
        
        signed_txn = self.w3.eth.account.sign_transaction(transaction, os.getenv('PRIVATE_KEY', ''))
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
    
    async def update_location(self, medicine_id: int, location: str) -> str:
        """Update medicine location"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        account = self.get_account()
        
        transaction = self.medicine_supply_chain_contract.functions.updateLocation(
            medicine_id, location
        ).build_transaction({
            'from': account,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account)
        })
        
        signed_txn = self.w3.eth.account.sign_transaction(transaction, os.getenv('PRIVATE_KEY', ''))
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
    
    async def get_temperature_history(self, medicine_id: int) -> tuple[List[str], List[int]]:
        """Get temperature history for a medicine"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        temperatures, timestamps = self.medicine_supply_chain_contract.functions.getTemperatureHistory(medicine_id).call()
        return temperatures, timestamps
    
    async def get_location_history(self, medicine_id: int) -> tuple[List[str], List[int]]:
        """Get location history for a medicine"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        locations, timestamps = self.medicine_supply_chain_contract.functions.getLocationHistory(medicine_id).call()
        return locations, timestamps
    
    async def mark_as_expired(self, medicine_id: int) -> str:
        """Mark medicine as expired"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        account = self.get_account()
        
        transaction = self.medicine_supply_chain_contract.functions.markAsExpired(medicine_id).build_transaction({
            'from': account,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account)
        })
        
        signed_txn = self.w3.eth.account.sign_transaction(transaction, os.getenv('PRIVATE_KEY', ''))
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
    
    async def recall_medicine(self, medicine_id: int, reason: str) -> str:
        """Recall a medicine"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        account = self.get_account()
        
        transaction = self.medicine_supply_chain_contract.functions.recallMedicine(medicine_id, reason).build_transaction({
            'from': account,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(account)
        })
        
        signed_txn = self.w3.eth.account.sign_transaction(transaction, os.getenv('PRIVATE_KEY', ''))
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
    
    async def get_contract_info(self) -> Dict[str, Any]:
        """Get contract information"""
        if not self.deployment_info:
            raise Exception("Deployment info not available")
        
        return {
            'accessControlAddress': self.deployment_info['contracts']['AccessControl']['address'],
            'medicineSupplyChainAddress': self.deployment_info['contracts']['MedicineSupplyChain']['address'],
            'network': self.deployment_info['network'],
            'chainId': self.deployment_info['chainId']
        }
    
    async def get_user_role(self, address: str) -> str:
        """Get role of a specific address"""
        if not self.is_connected():
            raise Exception("Not connected to blockchain")
        
        role_value = self.access_control_contract.functions.getRole(address).call()
        return Role(role_value).value
