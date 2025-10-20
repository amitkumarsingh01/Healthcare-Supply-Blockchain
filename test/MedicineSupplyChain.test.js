const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Healthcare Supply Chain", function () {
  let accessControl;
  let medicineSupplyChain;
  let owner;
  let manufacturer;
  let distributor;
  let pharmacy;
  let patient;

  beforeEach(async function () {
    [owner, manufacturer, distributor, pharmacy, patient] = await ethers.getSigners();

    // Deploy AccessControl contract
    const AccessControl = await ethers.getContractFactory("AccessControl");
    accessControl = await AccessControl.deploy();
    await accessControl.waitForDeployment();

    // Deploy MedicineSupplyChain contract
    const MedicineSupplyChain = await ethers.getContractFactory("MedicineSupplyChain");
    medicineSupplyChain = await MedicineSupplyChain.deploy(await accessControl.getAddress());
    await medicineSupplyChain.waitForDeployment();

    // Grant roles
    await accessControl.grantRole(manufacturer.address, 1); // MANUFACTURER
    await accessControl.grantRole(distributor.address, 2); // DISTRIBUTOR
    await accessControl.grantRole(pharmacy.address, 3); // PHARMACY
    await accessControl.grantRole(patient.address, 4); // PATIENT
  });

  describe("AccessControl", function () {
    it("Should grant and revoke roles correctly", async function () {
      // Check initial admin role
      expect(await accessControl.getRole(owner.address)).to.equal(5); // ADMIN

      // Check granted roles
      expect(await accessControl.getRole(manufacturer.address)).to.equal(1); // MANUFACTURER
      expect(await accessControl.getRole(distributor.address)).to.equal(2); // DISTRIBUTOR
      expect(await accessControl.getRole(pharmacy.address)).to.equal(3); // PHARMACY
      expect(await accessControl.getRole(patient.address)).to.equal(4); // PATIENT

      // Revoke role
      await accessControl.revokeRole(manufacturer.address);
      expect(await accessControl.getRole(manufacturer.address)).to.equal(0); // NONE
    });

    it("Should only allow admin to grant/revoke roles", async function () {
      await expect(
        accessControl.connect(manufacturer).grantRole(patient.address, 1)
      ).to.be.revertedWith("AccessControl: account is not admin");
    });
  });

  describe("MedicineSupplyChain", function () {
    it("Should manufacture medicine correctly", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year from now
      
      await expect(
        medicineSupplyChain.connect(manufacturer).manufactureMedicine(
          "Aspirin",
          "BATCH001",
          expiryDate,
          25, // temperature threshold
          true // temperature sensitive
        )
      ).to.emit(medicineSupplyChain, "MedicineManufactured")
        .withArgs(1, "Aspirin", "BATCH001", manufacturer.address);

      const medicine = await medicineSupplyChain.getMedicine(1);
      expect(medicine.name).to.equal("Aspirin");
      expect(medicine.batchNumber).to.equal("BATCH001");
      expect(medicine.manufacturer).to.equal(manufacturer.address);
      expect(medicine.currentOwner).to.equal(manufacturer.address);
      expect(medicine.status).to.equal(0); // MANUFACTURED
      expect(medicine.temperatureSensitive).to.be.true;
    });

    it("Should transfer medicine through supply chain", async function () {
      // First manufacture a medicine
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Aspirin",
        "BATCH001",
        expiryDate,
        25,
        true
      );

      // Transfer to distributor
      await expect(
        medicineSupplyChain.connect(manufacturer).transferMedicine(
          1,
          distributor.address,
          1, // SHIPPED_TO_DISTRIBUTOR
          "Warehouse A"
        )
      ).to.emit(medicineSupplyChain, "MedicineTransferred")
        .withArgs(1, manufacturer.address, distributor.address, 1);

      let medicine = await medicineSupplyChain.getMedicine(1);
      expect(medicine.currentOwner).to.equal(distributor.address);
      expect(medicine.status).to.equal(1); // SHIPPED_TO_DISTRIBUTOR

      // Receive by distributor
      await medicineSupplyChain.connect(distributor).transferMedicine(
        1,
        distributor.address,
        2, // RECEIVED_BY_DISTRIBUTOR
        "Distributor Warehouse"
      );

      medicine = await medicineSupplyChain.getMedicine(1);
      expect(medicine.status).to.equal(2); // RECEIVED_BY_DISTRIBUTOR
    });

    it("Should update temperature readings", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Insulin",
        "BATCH002",
        expiryDate,
        8, // temperature threshold
        true
      );

      await expect(
        medicineSupplyChain.connect(manufacturer).updateTemperature(1, "5°C")
      ).to.emit(medicineSupplyChain, "TemperatureUpdated")
        .withArgs(1, "5°C", await ethers.provider.getBlockNumber());

      const [temperatures, timestamps] = await medicineSupplyChain.getTemperatureHistory(1);
      expect(temperatures[0]).to.equal("5°C");
    });

    it("Should update location", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Aspirin",
        "BATCH003",
        expiryDate,
        25,
        false
      );

      await expect(
        medicineSupplyChain.connect(manufacturer).updateLocation(1, "Manufacturing Plant A")
      ).to.emit(medicineSupplyChain, "LocationUpdated")
        .withArgs(1, "Manufacturing Plant A", await ethers.provider.getBlockNumber());

      const [locations, timestamps] = await medicineSupplyChain.getLocationHistory(1);
      expect(locations[0]).to.equal("Manufacturing Plant A");
    });

    it("Should mark medicine as expired", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Expired Medicine",
        "BATCH004",
        expiryDate,
        25,
        false
      );

      await expect(
        medicineSupplyChain.connect(manufacturer).markAsExpired(1)
      ).to.emit(medicineSupplyChain, "MedicineStatusChanged")
        .withArgs(1, 0, 6); // MANUFACTURED to EXPIRED

      const medicine = await medicineSupplyChain.getMedicine(1);
      expect(medicine.status).to.equal(6); // EXPIRED
    });

    it("Should recall medicine", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Recalled Medicine",
        "BATCH005",
        expiryDate,
        25,
        false
      );

      await expect(
        medicineSupplyChain.connect(manufacturer).recallMedicine(1, "Quality issue")
      ).to.emit(medicineSupplyChain, "MedicineStatusChanged")
        .withArgs(1, 0, 7); // MANUFACTURED to RECALLED

      const medicine = await medicineSupplyChain.getMedicine(1);
      expect(medicine.status).to.equal(7); // RECALLED
    });

    it("Should get medicines by batch", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      
      // Manufacture multiple medicines with same batch
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Aspirin",
        "BATCH006",
        expiryDate,
        25,
        false
      );
      
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Aspirin",
        "BATCH006",
        expiryDate,
        25,
        false
      );

      const medicineIds = await medicineSupplyChain.getMedicinesByBatch("BATCH006");
      expect(medicineIds.length).to.equal(2);
      expect(medicineIds[0]).to.equal(1);
      expect(medicineIds[1]).to.equal(2);
    });

    it("Should enforce role-based access", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      
      // Only manufacturer should be able to manufacture
      await expect(
        medicineSupplyChain.connect(patient).manufactureMedicine(
          "Aspirin",
          "BATCH007",
          expiryDate,
          25,
          false
        )
      ).to.be.revertedWith("MedicineSupplyChain: account does not have required role");
    });

    it("Should validate status transitions", async function () {
      const expiryDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await medicineSupplyChain.connect(manufacturer).manufactureMedicine(
        "Aspirin",
        "BATCH008",
        expiryDate,
        25,
        false
      );

      // Invalid status transition
      await expect(
        medicineSupplyChain.connect(manufacturer).transferMedicine(
          1,
          distributor.address,
          3, // RECEIVED_BY_DISTRIBUTOR (skipping SHIPPED_TO_DISTRIBUTOR)
          "Invalid"
        )
      ).to.be.revertedWith("MedicineSupplyChain: invalid status transition");
    });
  });
});
