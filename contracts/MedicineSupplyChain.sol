// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";

/**
 * @title MedicineSupplyChain
 * @dev Main contract for tracking medicines through the healthcare supply chain
 */
contract MedicineSupplyChain {
    // Import AccessControl
    AccessControl public accessControl;
    
    // Medicine status enum
    enum MedicineStatus {
        MANUFACTURED,
        SHIPPED_TO_DISTRIBUTOR,
        RECEIVED_BY_DISTRIBUTOR,
        SHIPPED_TO_PHARMACY,
        RECEIVED_BY_PHARMACY,
        SOLD_TO_PATIENT,
        EXPIRED,
        RECALLED
    }
    
    // Medicine struct
    struct Medicine {
        uint256 id;
        string name;
        string batchNumber;
        uint256 manufactureDate;
        uint256 expiryDate;
        address manufacturer;
        address currentOwner;
        MedicineStatus status;
        uint256 temperatureThreshold; // Maximum temperature in Celsius
        bool temperatureSensitive;
        string[] temperatureReadings; // Array of temperature readings
        uint256[] temperatureTimestamps; // Array of timestamps for temperature readings
        string[] locationHistory; // Array of location updates
        uint256[] locationTimestamps; // Array of timestamps for location updates
        bool isActive;
    }
    
    // Mapping from medicine ID to Medicine struct
    mapping(uint256 => Medicine) public medicines;
    
    // Mapping from batch number to medicine IDs
    mapping(string => uint256[]) public batchToMedicines;
    
    // Counter for medicine IDs
    uint256 public medicineCounter;
    
    // Events
    event MedicineManufactured(
        uint256 indexed medicineId,
        string name,
        string batchNumber,
        address indexed manufacturer
    );
    
    event MedicineTransferred(
        uint256 indexed medicineId,
        address indexed from,
        address indexed to,
        MedicineStatus newStatus
    );
    
    event TemperatureUpdated(
        uint256 indexed medicineId,
        string temperature,
        uint256 timestamp
    );
    
    event LocationUpdated(
        uint256 indexed medicineId,
        string location,
        uint256 timestamp
    );
    
    event MedicineStatusChanged(
        uint256 indexed medicineId,
        MedicineStatus oldStatus,
        MedicineStatus newStatus
    );
    
    // Modifiers
    modifier onlyRole(AccessControl.Role role) {
        require(accessControl.hasRole(msg.sender, role), "MedicineSupplyChain: account does not have required role");
        _;
    }
    
    modifier medicineExists(uint256 medicineId) {
        require(medicines[medicineId].isActive, "MedicineSupplyChain: medicine does not exist");
        _;
    }
    
    modifier onlyOwnerOrAuthorized(uint256 medicineId) {
        require(
            medicines[medicineId].currentOwner == msg.sender ||
            accessControl.hasRole(msg.sender, AccessControl.Role.ADMIN),
            "MedicineSupplyChain: not authorized"
        );
        _;
    }
    
    constructor(address _accessControlAddress) {
        accessControl = AccessControl(_accessControlAddress);
    }
    
    /**
     * @dev Manufacture a new medicine
     * @param name Name of the medicine
     * @param batchNumber Batch number
     * @param expiryDate Expiry date (timestamp)
     * @param temperatureThreshold Maximum temperature threshold
     * @param temperatureSensitive Whether medicine is temperature sensitive
     */
    function manufactureMedicine(
        string memory name,
        string memory batchNumber,
        uint256 expiryDate,
        uint256 temperatureThreshold,
        bool temperatureSensitive
    ) external onlyRole(AccessControl.Role.MANUFACTURER) {
        require(bytes(name).length > 0, "MedicineSupplyChain: name cannot be empty");
        require(bytes(batchNumber).length > 0, "MedicineSupplyChain: batch number cannot be empty");
        require(expiryDate > block.timestamp, "MedicineSupplyChain: expiry date must be in future");
        
        medicineCounter++;
        uint256 medicineId = medicineCounter;
        
        medicines[medicineId] = Medicine({
            id: medicineId,
            name: name,
            batchNumber: batchNumber,
            manufactureDate: block.timestamp,
            expiryDate: expiryDate,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            status: MedicineStatus.MANUFACTURED,
            temperatureThreshold: temperatureThreshold,
            temperatureSensitive: temperatureSensitive,
            temperatureReadings: new string[](0),
            temperatureTimestamps: new uint256[](0),
            locationHistory: new string[](0),
            locationTimestamps: new uint256[](0),
            isActive: true
        });
        
        batchToMedicines[batchNumber].push(medicineId);
        
        emit MedicineManufactured(medicineId, name, batchNumber, msg.sender);
    }
    
    /**
     * @dev Transfer medicine to next stage in supply chain
     * @param medicineId ID of the medicine
     * @param to Address to transfer to
     * @param newStatus New status after transfer
     * @param location Location of transfer
     */
    function transferMedicine(
        uint256 medicineId,
        address to,
        MedicineStatus newStatus,
        string memory location
    ) external medicineExists(medicineId) onlyOwnerOrAuthorized(medicineId) {
        require(to != address(0), "MedicineSupplyChain: cannot transfer to zero address");
        require(to != medicines[medicineId].currentOwner, "MedicineSupplyChain: cannot transfer to self");
        require(_isValidStatusTransition(medicines[medicineId].status, newStatus), "MedicineSupplyChain: invalid status transition");
        
        address from = medicines[medicineId].currentOwner;
        MedicineStatus oldStatus = medicines[medicineId].status;
        
        medicines[medicineId].currentOwner = to;
        medicines[medicineId].status = newStatus;
        
        // Add location to history
        medicines[medicineId].locationHistory.push(location);
        medicines[medicineId].locationTimestamps.push(block.timestamp);
        
        emit MedicineTransferred(medicineId, from, to, newStatus);
        emit MedicineStatusChanged(medicineId, oldStatus, newStatus);
    }
    
    /**
     * @dev Update temperature reading for a medicine
     * @param medicineId ID of the medicine
     * @param temperature Temperature reading
     */
    function updateTemperature(
        uint256 medicineId,
        string memory temperature
    ) external medicineExists(medicineId) onlyOwnerOrAuthorized(medicineId) {
        require(medicines[medicineId].temperatureSensitive, "MedicineSupplyChain: medicine is not temperature sensitive");
        
        medicines[medicineId].temperatureReadings.push(temperature);
        medicines[medicineId].temperatureTimestamps.push(block.timestamp);
        
        emit TemperatureUpdated(medicineId, temperature, block.timestamp);
    }
    
    /**
     * @dev Update location of a medicine
     * @param medicineId ID of the medicine
     * @param location New location
     */
    function updateLocation(
        uint256 medicineId,
        string memory location
    ) external medicineExists(medicineId) onlyOwnerOrAuthorized(medicineId) {
        require(bytes(location).length > 0, "MedicineSupplyChain: location cannot be empty");
        
        medicines[medicineId].locationHistory.push(location);
        medicines[medicineId].locationTimestamps.push(block.timestamp);
        
        emit LocationUpdated(medicineId, location, block.timestamp);
    }
    
    /**
     * @dev Get medicine details
     * @param medicineId ID of the medicine
     * @return Medicine struct
     */
    function getMedicine(uint256 medicineId) external view medicineExists(medicineId) returns (Medicine memory) {
        return medicines[medicineId];
    }
    
    /**
     * @dev Get medicines by batch number
     * @param batchNumber Batch number to search for
     * @return Array of medicine IDs
     */
    function getMedicinesByBatch(string memory batchNumber) external view returns (uint256[] memory) {
        return batchToMedicines[batchNumber];
    }
    
    /**
     * @dev Get temperature history for a medicine
     * @param medicineId ID of the medicine
     * @return temperatures Array of temperature readings
     * @return timestamps Array of timestamps
     */
    function getTemperatureHistory(uint256 medicineId) external view medicineExists(medicineId) returns (string[] memory temperatures, uint256[] memory timestamps) {
        return (medicines[medicineId].temperatureReadings, medicines[medicineId].temperatureTimestamps);
    }
    
    /**
     * @dev Get location history for a medicine
     * @param medicineId ID of the medicine
     * @return locations Array of locations
     * @return timestamps Array of timestamps
     */
    function getLocationHistory(uint256 medicineId) external view medicineExists(medicineId) returns (string[] memory locations, uint256[] memory timestamps) {
        return (medicines[medicineId].locationHistory, medicines[medicineId].locationTimestamps);
    }
    
    /**
     * @dev Check if medicine is expired
     * @param medicineId ID of the medicine
     * @return bool True if expired
     */
    function isExpired(uint256 medicineId) external view medicineExists(medicineId) returns (bool) {
        return block.timestamp > medicines[medicineId].expiryDate;
    }
    
    /**
     * @dev Mark medicine as expired
     * @param medicineId ID of the medicine
     */
    function markAsExpired(uint256 medicineId) external medicineExists(medicineId) onlyOwnerOrAuthorized(medicineId) {
        require(block.timestamp > medicines[medicineId].expiryDate, "MedicineSupplyChain: medicine is not expired yet");
        
        MedicineStatus oldStatus = medicines[medicineId].status;
        medicines[medicineId].status = MedicineStatus.EXPIRED;
        
        emit MedicineStatusChanged(medicineId, oldStatus, MedicineStatus.EXPIRED);
    }
    
    /**
     * @dev Recall a medicine
     * @param medicineId ID of the medicine
     * @param reason Reason for recall
     */
    function recallMedicine(uint256 medicineId, string memory reason) external medicineExists(medicineId) onlyRole(AccessControl.Role.MANUFACTURER) {
        require(medicines[medicineId].manufacturer == msg.sender, "MedicineSupplyChain: only manufacturer can recall");
        
        MedicineStatus oldStatus = medicines[medicineId].status;
        medicines[medicineId].status = MedicineStatus.RECALLED;
        
        emit MedicineStatusChanged(medicineId, oldStatus, MedicineStatus.RECALLED);
    }
    
    /**
     * @dev Check if status transition is valid
     * @param from Current status
     * @param to New status
     * @return bool True if transition is valid
     */
    function _isValidStatusTransition(MedicineStatus from, MedicineStatus to) internal pure returns (bool) {
        if (from == MedicineStatus.MANUFACTURED) {
            return to == MedicineStatus.SHIPPED_TO_DISTRIBUTOR;
        } else if (from == MedicineStatus.SHIPPED_TO_DISTRIBUTOR) {
            return to == MedicineStatus.RECEIVED_BY_DISTRIBUTOR;
        } else if (from == MedicineStatus.RECEIVED_BY_DISTRIBUTOR) {
            return to == MedicineStatus.SHIPPED_TO_PHARMACY;
        } else if (from == MedicineStatus.SHIPPED_TO_PHARMACY) {
            return to == MedicineStatus.RECEIVED_BY_PHARMACY;
        } else if (from == MedicineStatus.RECEIVED_BY_PHARMACY) {
            return to == MedicineStatus.SOLD_TO_PATIENT;
        }
        return false;
    }
    
    /**
     * @dev Get total number of medicines
     * @return uint256 Total count
     */
    function getTotalMedicines() external view returns (uint256) {
        return medicineCounter;
    }
}
