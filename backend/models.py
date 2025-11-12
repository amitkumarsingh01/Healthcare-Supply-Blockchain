from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class MedicineStatus(str, Enum):
    MANUFACTURED = "MANUFACTURED"
    SHIPPED_TO_DISTRIBUTOR = "SHIPPED_TO_DISTRIBUTOR"
    RECEIVED_BY_DISTRIBUTOR = "RECEIVED_BY_DISTRIBUTOR"
    SHIPPED_TO_PHARMACY = "SHIPPED_TO_PHARMACY"
    RECEIVED_BY_PHARMACY = "RECEIVED_BY_PHARMACY"
    SOLD_TO_PATIENT = "SOLD_TO_PATIENT"
    EXPIRED = "EXPIRED"
    RECALLED = "RECALLED"

class Role(str, Enum):
    NONE = "NONE"
    MANUFACTURER = "MANUFACTURER"
    DISTRIBUTOR = "DISTRIBUTOR"
    PHARMACY = "PHARMACY"
    PATIENT = "PATIENT"
    ADMIN = "ADMIN"

class Medicine(BaseModel):
    id: int
    name: str
    batchNumber: str
    manufactureDate: int
    expiryDate: int
    manufacturer: str
    currentOwner: str
    status: MedicineStatus
    temperatureThreshold: int
    temperatureSensitive: bool
    isActive: bool

class MedicineCreate(BaseModel):
    name: str
    batchNumber: str
    expiryDate: int
    temperatureThreshold: int
    temperatureSensitive: bool

class MedicineTransfer(BaseModel):
    toAddress: str
    newStatus: MedicineStatus
    location: str
    recipientName: Optional[str] = None  # Whom - recipient name (distributor, pharmacy, or patient)

class TemperatureUpdate(BaseModel):
    temperature: str

class LocationUpdate(BaseModel):
    location: str

class ContractInfo(BaseModel):
    accessControlAddress: str
    medicineSupplyChainAddress: str
    network: str
    chainId: int
