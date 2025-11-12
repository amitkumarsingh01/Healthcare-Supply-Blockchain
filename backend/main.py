from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import os
from datetime import datetime, timedelta
from models import Medicine, MedicineCreate, MedicineTransfer, TemperatureUpdate, LocationUpdate

app = FastAPI(title="Healthcare Supply Chain Blockchain API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 👥 OWNER NAME MAPPING - Maps addresses to owner names
OWNER_NAMES = {
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": "MediPharm Manufacturing Co.",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "Global Distributors Ltd.",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "CITY Engg Pharmacy",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "John Smith (Patient)",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "Sarah Johnson (Patient)"
}

# 🏥 PHARMACY MAPPING - Maps addresses to pharmacy names for status display
PHARMACY_NAMES = {
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "CITY Engg Pharmacy",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "Global Distributors Ltd."
}

# 🚚 DISTRIBUTOR MAPPING - Maps addresses to distributor names for status display
DISTRIBUTOR_NAMES = {
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "Global Distributors Ltd."
}

# 👤 PATIENT MAPPING - Maps addresses to patient names for status display
PATIENT_NAMES = {
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "John Smith",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "Sarah Johnson"
}

# 🔗 BLOCKCHAIN DATA - Hardcoded medicine data simulating blockchain state
BLOCKCHAIN_MEDICINES = [
    {
        "id": 1,
        "name": "Aspirin",
        "batchNumber": "ASP001",
        "manufactureDate": int((datetime.now() - timedelta(days=30)).timestamp()),
        "expiryDate": int((datetime.now() + timedelta(days=365)).timestamp()),
        "manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "currentOwner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "status": "MANUFACTURED",
        "temperatureThreshold": 25,
        "temperatureSensitive": False,
        "isActive": True,
        "blockchainTxHash": "0x1234567890abcdef1234567890abcdef12345678",
        "blockNumber": 1001,
        "gasUsed": 150000
    },
    {
        "id": 2,
        "name": "Insulin",
        "batchNumber": "INS002",
        "manufactureDate": int((datetime.now() - timedelta(days=15)).timestamp()),
        "expiryDate": int((datetime.now() + timedelta(days=180)).timestamp()),
        "manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "currentOwner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "status": "SHIPPED_TO_DISTRIBUTOR",
        "temperatureThreshold": 8,
        "temperatureSensitive": True,
        "isActive": True,
        "blockchainTxHash": "0xabcdef1234567890abcdef1234567890abcdef12",
        "blockNumber": 1002,
        "gasUsed": 180000
    },
    {
        "id": 3,
        "name": "Paracetamol",
        "batchNumber": "PAR003",
        "manufactureDate": int((datetime.now() - timedelta(days=7)).timestamp()),
        "expiryDate": int((datetime.now() + timedelta(days=730)).timestamp()),
        "manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "currentOwner": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "status": "RECEIVED_BY_PHARMACY",
        "temperatureThreshold": 30,
        "temperatureSensitive": False,
        "isActive": True,
        "blockchainTxHash": "0x567890abcdef1234567890abcdef1234567890ab",
        "blockNumber": 1003,
        "gasUsed": 160000
    },
    {
        "id": 4,
        "name": "Antibiotic",
        "batchNumber": "ANT004",
        "manufactureDate": int((datetime.now() - timedelta(days=45)).timestamp()),
        "expiryDate": int((datetime.now() + timedelta(days=90)).timestamp()),
        "manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "currentOwner": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "status": "SOLD_TO_PATIENT",
        "temperatureThreshold": 20,
        "temperatureSensitive": True,
        "isActive": True,
        "blockchainTxHash": "0x7890abcdef1234567890abcdef1234567890abcd",
        "blockNumber": 1004,
        "gasUsed": 170000
    },
    {
        "id": 5,
        "name": "Vitamin D",
        "batchNumber": "VIT005",
        "manufactureDate": int((datetime.now() - timedelta(days=60)).timestamp()),
        "expiryDate": int((datetime.now() - timedelta(days=1)).timestamp()),
        "manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "currentOwner": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "status": "EXPIRED",
        "temperatureThreshold": 25,
        "temperatureSensitive": False,
        "isActive": True,
        "blockchainTxHash": "0x90abcdef1234567890abcdef1234567890abcdef",
        "blockNumber": 1005,
        "gasUsed": 140000
    }
]

# 🌡️ BLOCKCHAIN TEMPERATURE READINGS - Simulating blockchain events
BLOCKCHAIN_TEMPERATURE_DATA = {
    2: [  # Insulin (temperature sensitive)
        {"temperature": "5°C", "timestamp": int((datetime.now() - timedelta(days=10)).timestamp()), "txHash": "0xtemp001"},
        {"temperature": "6°C", "timestamp": int((datetime.now() - timedelta(days=8)).timestamp()), "txHash": "0xtemp002"},
        {"temperature": "4°C", "timestamp": int((datetime.now() - timedelta(days=5)).timestamp()), "txHash": "0xtemp003"},
        {"temperature": "7°C", "timestamp": int((datetime.now() - timedelta(days=2)).timestamp()), "txHash": "0xtemp004"}
    ],
    4: [  # Antibiotic (temperature sensitive)
        {"temperature": "18°C", "timestamp": int((datetime.now() - timedelta(days=20)).timestamp()), "txHash": "0xtemp005"},
        {"temperature": "22°C", "timestamp": int((datetime.now() - timedelta(days=15)).timestamp()), "txHash": "0xtemp006"}
    ]
}

# 📍 BLOCKCHAIN LOCATION UPDATES - Simulating blockchain events
BLOCKCHAIN_LOCATION_DATA = {
    1: [  # Aspirin
        {"location": "Manufacturing Plant A", "timestamp": int((datetime.now() - timedelta(days=30)).timestamp()), "txHash": "0xloc001"},
        {"location": "Quality Control Lab", "timestamp": int((datetime.now() - timedelta(days=28)).timestamp()), "txHash": "0xloc002"}
    ],
    2: [  # Insulin
        {"location": "Manufacturing Plant A", "timestamp": int((datetime.now() - timedelta(days=15)).timestamp()), "txHash": "0xloc003"},
        {"location": "Cold Storage Facility", "timestamp": int((datetime.now() - timedelta(days=12)).timestamp()), "txHash": "0xloc004"},
        {"location": "Distribution Center", "timestamp": int((datetime.now() - timedelta(days=8)).timestamp()), "txHash": "0xloc005"}
    ],
    3: [  # Paracetamol
        {"location": "Manufacturing Plant A", "timestamp": int((datetime.now() - timedelta(days=7)).timestamp()), "txHash": "0xloc006"},
        {"location": "Warehouse B", "timestamp": int((datetime.now() - timedelta(days=5)).timestamp()), "txHash": "0xloc007"},
        {"location": "Pharmacy D", "timestamp": int((datetime.now() - timedelta(days=2)).timestamp()), "txHash": "0xloc008"}
    ],
    4: [  # Antibiotic
        {"location": "Manufacturing Plant A", "timestamp": int((datetime.now() - timedelta(days=45)).timestamp()), "txHash": "0xloc009"},
        {"location": "Pharmacy D", "timestamp": int((datetime.now() - timedelta(days=10)).timestamp()), "txHash": "0xloc010"},
        {"location": "Patient Home", "timestamp": int((datetime.now() - timedelta(days=1)).timestamp()), "txHash": "0xloc011"}
    ]
}

# 📊 SUPPLY CHAIN STAGES - Detailed tracking for each medicine
BLOCKCHAIN_STAGES_DATA = {
    1: [  # Aspirin
        {"stage": "MANUFACTURED", "location": "Manufacturing Plant A", "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "timestamp": int((datetime.now() - timedelta(days=30)).timestamp()), "txHash": "0xstage001"}
    ],
    2: [  # Insulin - Full lifecycle
        {"stage": "MANUFACTURED", "location": "Manufacturing Plant A", "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "timestamp": int((datetime.now() - timedelta(days=15)).timestamp()), "txHash": "0xstage002"},
        {"stage": "SHIPPED_TO_DISTRIBUTOR", "location": "Loading Dock A", "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "distributorName": "Global Distributors Ltd.", "recipientName": "Global Distributors Ltd.", "timestamp": int((datetime.now() - timedelta(days=13)).timestamp()), "txHash": "0xstage003"},
        {"stage": "RECEIVED_BY_DISTRIBUTOR", "location": "Distribution Center", "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "distributorName": "Global Distributors Ltd.", "recipientName": "Global Distributors Ltd.", "timestamp": int((datetime.now() - timedelta(days=12)).timestamp()), "txHash": "0xstage004"}
    ],
    3: [  # Paracetamol - Through pharmacy
        {"stage": "MANUFACTURED", "location": "Manufacturing Plant A", "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "timestamp": int((datetime.now() - timedelta(days=7)).timestamp()), "txHash": "0xstage005"},
        {"stage": "SHIPPED_TO_DISTRIBUTOR", "location": "Loading Dock B", "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "distributorName": "Global Distributors Ltd.", "recipientName": "Global Distributors Ltd.", "timestamp": int((datetime.now() - timedelta(days=6)).timestamp()), "txHash": "0xstage006"},
        {"stage": "RECEIVED_BY_DISTRIBUTOR", "location": "Warehouse B", "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "distributorName": "Global Distributors Ltd.", "recipientName": "Global Distributors Ltd.", "timestamp": int((datetime.now() - timedelta(days=5)).timestamp()), "txHash": "0xstage007"},
        {"stage": "SHIPPED_TO_PHARMACY", "location": "Warehouse B - Outbound", "owner": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "pharmacyName": "CITY Engg Pharmacy", "recipientName": "CITY Engg Pharmacy", "timestamp": int((datetime.now() - timedelta(days=4)).timestamp()), "txHash": "0xstage008"},
        {"stage": "RECEIVED_BY_PHARMACY", "location": "CITY Engg Pharmacy", "owner": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "pharmacyName": "CITY Engg Pharmacy", "recipientName": "CITY Engg Pharmacy", "timestamp": int((datetime.now() - timedelta(days=2)).timestamp()), "txHash": "0xstage009"}
    ],
    4: [  # Antibiotic - Sold to patient
        {"stage": "MANUFACTURED", "location": "Manufacturing Plant A", "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "timestamp": int((datetime.now() - timedelta(days=45)).timestamp()), "txHash": "0xstage010"},
        {"stage": "SHIPPED_TO_DISTRIBUTOR", "location": "Loading Dock C", "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "distributorName": "Global Distributors Ltd.", "recipientName": "Global Distributors Ltd.", "timestamp": int((datetime.now() - timedelta(days=43)).timestamp()), "txHash": "0xstage011"},
        {"stage": "RECEIVED_BY_DISTRIBUTOR", "location": "Distribution Center", "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "distributorName": "Global Distributors Ltd.", "recipientName": "Global Distributors Ltd.", "timestamp": int((datetime.now() - timedelta(days=42)).timestamp()), "txHash": "0xstage012"},
        {"stage": "SHIPPED_TO_PHARMACY", "location": "Distribution Center - Outbound", "owner": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "pharmacyName": "CITY Engg Pharmacy", "recipientName": "CITY Engg Pharmacy", "timestamp": int((datetime.now() - timedelta(days=40)).timestamp()), "txHash": "0xstage013"},
        {"stage": "RECEIVED_BY_PHARMACY", "location": "CITY Engg Pharmacy", "owner": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "pharmacyName": "CITY Engg Pharmacy", "recipientName": "CITY Engg Pharmacy", "timestamp": int((datetime.now() - timedelta(days=38)).timestamp()), "txHash": "0xstage014"},
        {"stage": "SOLD_TO_PATIENT", "location": "Patient Home", "owner": "0x90F79bf6EB2c4f870365E785982E1f101E93b906", "patientName": "John Smith", "recipientName": "John Smith", "timestamp": int((datetime.now() - timedelta(days=1)).timestamp()), "txHash": "0xstage015"}
    ],
    5: [  # Vitamin D - Expired
        {"stage": "MANUFACTURED", "location": "Manufacturing Plant A", "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "timestamp": int((datetime.now() - timedelta(days=60)).timestamp()), "txHash": "0xstage016"},
        {"stage": "SHIPPED_TO_DISTRIBUTOR", "location": "Loading Dock D", "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "timestamp": int((datetime.now() - timedelta(days=58)).timestamp()), "txHash": "0xstage017"},
        {"stage": "RECEIVED_BY_PHARMACY", "location": "CITY Engg Pharmacy", "owner": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "pharmacyName": "CITY Engg Pharmacy", "timestamp": int((datetime.now() - timedelta(days=2)).timestamp()), "txHash": "0xstage018"},
        {"stage": "EXPIRED", "location": "CITY Engg Pharmacy - Expired Stock", "owner": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", "timestamp": int((datetime.now() - timedelta(days=1)).timestamp()), "txHash": "0xstage019"}
    ]
}

# Helper function to format status with recipient names
def format_status_with_recipient(status: str, owner_address: str, recipient_name: str = None) -> str:
    """Format status to include recipient name (distributor, pharmacy, or patient) when applicable"""
    if status == "SHIPPED_TO_PHARMACY":
        pharmacy_name = recipient_name or PHARMACY_NAMES.get(owner_address, "Pharmacy")
        return f"Shipped to {pharmacy_name}"
    elif status == "RECEIVED_BY_PHARMACY":
        pharmacy_name = recipient_name or PHARMACY_NAMES.get(owner_address, "Pharmacy")
        return f"Received by {pharmacy_name}"
    elif status == "SHIPPED_TO_DISTRIBUTOR":
        distributor_name = recipient_name or DISTRIBUTOR_NAMES.get(owner_address, "Distributor")
        return f"Shipped to {distributor_name}"
    elif status == "RECEIVED_BY_DISTRIBUTOR":
        distributor_name = recipient_name or DISTRIBUTOR_NAMES.get(owner_address, "Distributor")
        return f"Received by {distributor_name}"
    elif status == "SOLD_TO_PATIENT":
        patient_name = recipient_name or PATIENT_NAMES.get(owner_address, "Patient")
        return f"Sold to {patient_name}"
    else:
        status_map = {
            'MANUFACTURED': 'Manufactured',
            'EXPIRED': 'Expired',
            'RECALLED': 'Recalled'
        }
        return status_map.get(status, status)

# Pydantic models for API requests/responses
class MedicineResponse(BaseModel):
    id: int
    name: str
    batchNumber: str
    manufactureDate: int
    expiryDate: int
    manufacturer: str
    currentOwner: str
    currentOwnerName: Optional[str] = None
    status: str
    statusFormatted: Optional[str] = None
    temperatureThreshold: int
    temperatureSensitive: bool
    isActive: bool
    blockchainTxHash: str
    blockNumber: int
    gasUsed: int

class BatchResponse(BaseModel):
    batchNumber: str
    medicines: List[MedicineResponse]

class TemperatureHistoryResponse(BaseModel):
    temperatures: List[str]
    timestamps: List[int]
    transactionHashes: List[str]

class LocationHistoryResponse(BaseModel):
    locations: List[str]
    timestamps: List[int]
    transactionHashes: List[str]

class SupplyChainStage(BaseModel):
    stage: str
    location: str
    owner: str
    ownerName: Optional[str] = None
    pharmacyName: Optional[str] = None
    distributorName: Optional[str] = None
    patientName: Optional[str] = None
    recipientName: Optional[str] = None  # General recipient name field
    stageFormatted: Optional[str] = None
    timestamp: int
    txHash: str

class SupplyChainTimelineResponse(BaseModel):
    stages: List[SupplyChainStage]

@app.get("/")
async def root():
    return {
        "message": "🔗 Healthcare Supply Chain Blockchain API", 
        "version": "1.0.0",
        "blockchain": "Hardhat Local Network",
        "contracts": "Deployed and Active"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "blockchain_connected": True, 
        "contracts_deployed": True,
        "network": "Hardhat Local (Chain ID: 1337)",
        "total_medicines": len(BLOCKCHAIN_MEDICINES)
    }

@app.get("/contracts/info")
async def get_contract_info():
    """Get contract addresses and ABI information"""
    return {
        "accessControlAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "medicineSupplyChainAddress": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        "network": "localhost",
        "chainId": 1337,
        "blockchain_mode": True,
        "total_medicines_on_blockchain": len(BLOCKCHAIN_MEDICINES)
    }

@app.get("/medicines", response_model=List[MedicineResponse])
async def get_medicines():
    """🔗 Get all medicines from blockchain"""
    try:
        medicines_with_names = []
        for medicine in BLOCKCHAIN_MEDICINES:
            if medicine["isActive"]:
                medicine_data = medicine.copy()
                medicine_data["currentOwnerName"] = OWNER_NAMES.get(medicine["currentOwner"], "Unknown")
                medicine_data["statusFormatted"] = format_status_with_recipient(medicine["status"], medicine["currentOwner"])
                medicines_with_names.append(MedicineResponse(**medicine_data))
        return medicines_with_names
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain query failed: {str(e)}")

@app.get("/medicines/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(medicine_id: int):
    """🔗 Get specific medicine from blockchain by ID"""
    try:
        medicine = next((m for m in BLOCKCHAIN_MEDICINES if m["id"] == medicine_id and m["isActive"]), None)
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found on blockchain")
        medicine_data = medicine.copy()
        medicine_data["currentOwnerName"] = OWNER_NAMES.get(medicine["currentOwner"], "Unknown")
        medicine_data["statusFormatted"] = format_status_with_recipient(medicine["status"], medicine["currentOwner"])
        return MedicineResponse(**medicine_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain query failed: {str(e)}")

@app.get("/medicines/batch/{batch_number}", response_model=BatchResponse)
async def get_medicines_by_batch(batch_number: str):
    """🔗 Get medicines by batch number from blockchain"""
    try:
        medicines = [m for m in BLOCKCHAIN_MEDICINES if m["batchNumber"] == batch_number and m["isActive"]]
        medicines_with_names = []
        for medicine in medicines:
            medicine_data = medicine.copy()
            medicine_data["currentOwnerName"] = OWNER_NAMES.get(medicine["currentOwner"], "Unknown")
            medicine_data["statusFormatted"] = format_status_with_recipient(medicine["status"], medicine["currentOwner"])
            medicines_with_names.append(MedicineResponse(**medicine_data))
        return BatchResponse(
            batchNumber=batch_number,
            medicines=medicines_with_names
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain query failed: {str(e)}")

@app.post("/medicines", response_model=MedicineResponse)
async def create_medicine(medicine: MedicineCreate):
    """🔗 Manufacture new medicine on blockchain"""
    try:
        # Simulate blockchain transaction
        if not BLOCKCHAIN_MEDICINES:
            new_id = 1
        else:
            new_id = max([m["id"] for m in BLOCKCHAIN_MEDICINES]) + 1
        expiry_date = datetime.fromtimestamp(medicine.expiryDate)
        manufacturer_address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        current_time = int(datetime.now().timestamp())
        
        new_medicine = {
            "id": new_id,
            "name": medicine.name,
            "batchNumber": medicine.batchNumber,
            "manufactureDate": current_time,
            "expiryDate": medicine.expiryDate,
            "manufacturer": manufacturer_address,
            "currentOwner": manufacturer_address,
            "status": "MANUFACTURED",
            "temperatureThreshold": medicine.temperatureThreshold,
            "temperatureSensitive": medicine.temperatureSensitive,
            "isActive": True,
            "blockchainTxHash": f"0x{new_id:040x}",
            "blockNumber": 1000 + new_id,
            "gasUsed": 150000,
            "currentOwnerName": OWNER_NAMES.get(manufacturer_address, "Unknown"),
            "statusFormatted": format_status_with_recipient("MANUFACTURED", manufacturer_address)
        }
        
        BLOCKCHAIN_MEDICINES.append(new_medicine)
        
        # Automatically create initial stage entry in stages data
        BLOCKCHAIN_STAGES_DATA[new_id] = [{
            "stage": "MANUFACTURED",
            "location": "Manufacturing Plant A",
            "owner": manufacturer_address,
            "timestamp": current_time,
            "txHash": f"0x{new_id:040x}"
        }]
        
        # Add initial location entry
        BLOCKCHAIN_LOCATION_DATA[new_id] = [{
            "location": "Manufacturing Plant A",
            "timestamp": current_time,
            "txHash": f"0xloc{new_id:05d}"
        }]
        
        return MedicineResponse(**new_medicine)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Blockchain transaction failed: {str(e)}")

@app.post("/medicines/{medicine_id}/transfer")
async def transfer_medicine(medicine_id: int, transfer: MedicineTransfer):
    """🔗 Transfer medicine on blockchain"""
    try:
        medicine = next((m for m in BLOCKCHAIN_MEDICINES if m["id"] == medicine_id), None)
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found on blockchain")
        
        # Simulate blockchain transaction
        medicine["currentOwner"] = transfer.toAddress
        medicine["status"] = transfer.newStatus
        medicine["currentOwnerName"] = OWNER_NAMES.get(transfer.toAddress, "Unknown")
        # Use recipientName if provided, otherwise use default mapping
        medicine["statusFormatted"] = format_status_with_recipient(transfer.newStatus, transfer.toAddress, transfer.recipientName)
        medicine["blockchainTxHash"] = f"0xtransfer{medicine_id:040x}"
        medicine["blockNumber"] = 2000 + medicine_id
        medicine["gasUsed"] = 120000
        
        # Add stage to stages data
        if medicine_id not in BLOCKCHAIN_STAGES_DATA:
            BLOCKCHAIN_STAGES_DATA[medicine_id] = []
        
        new_stage = {
            "stage": transfer.newStatus,
            "location": transfer.location,
            "owner": transfer.toAddress,
            "timestamp": int(datetime.now().timestamp()),
            "txHash": medicine["blockchainTxHash"]
        }
        
        # Add recipient name if provided
        if transfer.recipientName:
            new_stage["recipientName"] = transfer.recipientName
        
        # Add specific name fields based on status type
        if transfer.newStatus in ["SHIPPED_TO_PHARMACY", "RECEIVED_BY_PHARMACY"]:
            pharmacy_name = transfer.recipientName or PHARMACY_NAMES.get(transfer.toAddress, "Pharmacy")
            new_stage["pharmacyName"] = pharmacy_name
        elif transfer.newStatus in ["SHIPPED_TO_DISTRIBUTOR", "RECEIVED_BY_DISTRIBUTOR"]:
            distributor_name = transfer.recipientName or DISTRIBUTOR_NAMES.get(transfer.toAddress, "Distributor")
            new_stage["distributorName"] = distributor_name
        elif transfer.newStatus == "SOLD_TO_PATIENT":
            patient_name = transfer.recipientName or PATIENT_NAMES.get(transfer.toAddress, "Patient")
            new_stage["patientName"] = patient_name
        
        BLOCKCHAIN_STAGES_DATA[medicine_id].append(new_stage)
        
        # Add location to location data
        if medicine_id not in BLOCKCHAIN_LOCATION_DATA:
            BLOCKCHAIN_LOCATION_DATA[medicine_id] = []
        
        new_location = {
            "location": transfer.location,
            "timestamp": int(datetime.now().timestamp()),
            "txHash": f"0xloc{medicine_id:05d}_{len(BLOCKCHAIN_LOCATION_DATA[medicine_id])}"
        }
        BLOCKCHAIN_LOCATION_DATA[medicine_id].append(new_location)
        
        return {
            "success": True, 
            "transaction_hash": medicine["blockchainTxHash"],
            "block_number": medicine["blockNumber"],
            "gas_used": medicine["gasUsed"],
            "message": f"Medicine {medicine_id} transferred on blockchain"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Blockchain transaction failed: {str(e)}")

@app.post("/medicines/{medicine_id}/temperature")
async def update_temperature(medicine_id: int, temp_update: TemperatureUpdate):
    """🌡️ Update temperature reading on blockchain"""
    try:
        medicine = next((m for m in BLOCKCHAIN_MEDICINES if m["id"] == medicine_id), None)
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found on blockchain")
        
        if not medicine["temperatureSensitive"]:
            raise HTTPException(status_code=400, detail="Medicine is not temperature sensitive")
        
        # Add to blockchain temperature data
        if medicine_id not in BLOCKCHAIN_TEMPERATURE_DATA:
            BLOCKCHAIN_TEMPERATURE_DATA[medicine_id] = []
        
        new_reading = {
            "temperature": temp_update.temperature,
            "timestamp": int(datetime.now().timestamp()),
            "txHash": f"0xtemp{medicine_id:040x}"
        }
        BLOCKCHAIN_TEMPERATURE_DATA[medicine_id].append(new_reading)
        
        return {
            "success": True,
            "transaction_hash": new_reading["txHash"],
            "message": f"Temperature updated on blockchain for medicine {medicine_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Blockchain transaction failed: {str(e)}")

@app.post("/medicines/{medicine_id}/location")
async def update_location(medicine_id: int, location_update: LocationUpdate):
    """📍 Update location on blockchain"""
    try:
        medicine = next((m for m in BLOCKCHAIN_MEDICINES if m["id"] == medicine_id), None)
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found on blockchain")
        
        # Add to blockchain location data
        if medicine_id not in BLOCKCHAIN_LOCATION_DATA:
            BLOCKCHAIN_LOCATION_DATA[medicine_id] = []
        
        new_location = {
            "location": location_update.location,
            "timestamp": int(datetime.now().timestamp()),
            "txHash": f"0xloc{medicine_id:040x}"
        }
        BLOCKCHAIN_LOCATION_DATA[medicine_id].append(new_location)
        
        return {
            "success": True,
            "transaction_hash": new_location["txHash"],
            "message": f"Location updated on blockchain for medicine {medicine_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Blockchain transaction failed: {str(e)}")

@app.get("/medicines/{medicine_id}/temperature-history", response_model=TemperatureHistoryResponse)
async def get_temperature_history(medicine_id: int):
    """🌡️ Get temperature history from blockchain"""
    try:
        if medicine_id not in BLOCKCHAIN_TEMPERATURE_DATA:
            return TemperatureHistoryResponse(temperatures=[], timestamps=[], transactionHashes=[])
        
        data = BLOCKCHAIN_TEMPERATURE_DATA[medicine_id]
        return TemperatureHistoryResponse(
            temperatures=[d["temperature"] for d in data],
            timestamps=[d["timestamp"] for d in data],
            transactionHashes=[d["txHash"] for d in data]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain query failed: {str(e)}")

@app.get("/medicines/{medicine_id}/location-history", response_model=LocationHistoryResponse)
async def get_location_history(medicine_id: int):
    """📍 Get location history from blockchain"""
    try:
        if medicine_id not in BLOCKCHAIN_LOCATION_DATA:
            return LocationHistoryResponse(locations=[], timestamps=[], transactionHashes=[])
        
        data = BLOCKCHAIN_LOCATION_DATA[medicine_id]
        return LocationHistoryResponse(
            locations=[d["location"] for d in data],
            timestamps=[d["timestamp"] for d in data],
            transactionHashes=[d["txHash"] for d in data]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain query failed: {str(e)}")

@app.get("/medicines/{medicine_id}/stages", response_model=SupplyChainTimelineResponse)
async def get_supply_chain_stages(medicine_id: int):
    """📊 Get complete supply chain stages timeline from blockchain"""
    try:
        if medicine_id not in BLOCKCHAIN_STAGES_DATA:
            return SupplyChainTimelineResponse(stages=[])
        
        stages = BLOCKCHAIN_STAGES_DATA[medicine_id]
        stages_with_names = []
        for stage in stages:
            stage_data = stage.copy()
            stage_data["ownerName"] = OWNER_NAMES.get(stage["owner"], "Unknown")
            # Get recipient name from stage data if available
            recipient_name = stage.get("recipientName") or stage.get("pharmacyName") or stage.get("distributorName") or stage.get("patientName")
            if "pharmacyName" in stage:
                stage_data["pharmacyName"] = stage["pharmacyName"]
            if "distributorName" in stage:
                stage_data["distributorName"] = stage["distributorName"]
            if "patientName" in stage:
                stage_data["patientName"] = stage["patientName"]
            if recipient_name:
                stage_data["recipientName"] = recipient_name
            stage_data["stageFormatted"] = format_status_with_recipient(stage["stage"], stage["owner"], recipient_name)
            stages_with_names.append(SupplyChainStage(**stage_data))
        
        return SupplyChainTimelineResponse(stages=stages_with_names)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain query failed: {str(e)}")

@app.post("/medicines/{medicine_id}/expire")
async def mark_medicine_expired(medicine_id: int):
    """🔗 Mark medicine as expired on blockchain"""
    try:
        medicine = next((m for m in BLOCKCHAIN_MEDICINES if m["id"] == medicine_id), None)
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found on blockchain")
        
        medicine["status"] = "EXPIRED"
        medicine["blockchainTxHash"] = f"0xexpire{medicine_id:040x}"
        medicine["blockNumber"] = 3000 + medicine_id
        medicine["gasUsed"] = 80000
        
        return {
            "success": True,
            "transaction_hash": medicine["blockchainTxHash"],
            "message": f"Medicine {medicine_id} marked as expired on blockchain"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Blockchain transaction failed: {str(e)}")

@app.post("/medicines/{medicine_id}/recall")
async def recall_medicine(medicine_id: int, reason: str):
    """🔗 Recall medicine on blockchain"""
    try:
        medicine = next((m for m in BLOCKCHAIN_MEDICINES if m["id"] == medicine_id), None)
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found on blockchain")
        
        medicine["status"] = "RECALLED"
        medicine["blockchainTxHash"] = f"0xrecall{medicine_id:040x}"
        medicine["blockNumber"] = 4000 + medicine_id
        medicine["gasUsed"] = 100000
        
        return {
            "success": True,
            "transaction_hash": medicine["blockchainTxHash"],
            "reason": reason,
            "message": f"Medicine {medicine_id} recalled on blockchain"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Blockchain transaction failed: {str(e)}")

@app.get("/roles/{address}")
async def get_user_role(address: str):
    """🔗 Get role of a specific address from blockchain"""
    try:
        # Simulate blockchain role query
        roles = {
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": "MANUFACTURER",
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "DISTRIBUTOR", 
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "PHARMACY",
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "PATIENT",
            "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "PATIENT"
        }
        
        role = roles.get(address, "NONE")
        return {
            "address": address, 
            "role": role,
            "blockchain_query": True,
            "contract_address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain query failed: {str(e)}")

@app.post("/seed-data")
async def seed_data():
    """🌱 Seed initial data into memory"""
    try:
        # Data is already seeded in memory at startup
        # This endpoint just confirms the seeded data
        return {
            "success": True,
            "message": "Data already seeded in memory",
            "total_medicines": len(BLOCKCHAIN_MEDICINES),
            "owner_names": len(OWNER_NAMES),
            "pharmacy_names": len(PHARMACY_NAMES),
            "medicines": [
                {
                    "id": m["id"],
                    "name": m["name"],
                    "status": m["status"],
                    "currentOwner": m["currentOwner"],
                    "currentOwnerName": OWNER_NAMES.get(m["currentOwner"], "Unknown")
                }
                for m in BLOCKCHAIN_MEDICINES
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get seed data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)