const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Healthcare Supply Chain contracts...");

  // Deploy AccessControl contract first
  const AccessControl = await ethers.getContractFactory("AccessControl");
  const accessControl = await AccessControl.deploy();
  await accessControl.deployed();
  
  const accessControlAddress = accessControl.address;
  console.log("AccessControl deployed to:", accessControlAddress);

  // Deploy MedicineSupplyChain contract
  const MedicineSupplyChain = await ethers.getContractFactory("MedicineSupplyChain");
  const medicineSupplyChain = await MedicineSupplyChain.deploy(accessControlAddress);
  await medicineSupplyChain.deployed();
  
  const medicineSupplyChainAddress = medicineSupplyChain.address;
  console.log("MedicineSupplyChain deployed to:", medicineSupplyChainAddress);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Grant roles to deployer for testing
  console.log("Setting up roles for testing...");
  
  try {
    // Grant manufacturer role
    await accessControl.grantRole(deployer.address, 1); // MANUFACTURER
    console.log("Granted MANUFACTURER role to deployer");
    
    // Grant distributor role
    await accessControl.grantRole(deployer.address, 2); // DISTRIBUTOR
    console.log("Granted DISTRIBUTOR role to deployer");
    
    // Grant pharmacy role
    await accessControl.grantRole(deployer.address, 3); // PHARMACY
    console.log("Granted PHARMACY role to deployer");
    
    // Grant patient role
    await accessControl.grantRole(deployer.address, 4); // PATIENT
    console.log("Granted PATIENT role to deployer");
  } catch (error) {
    console.log("Roles already granted or deployer is already admin");
  }

  console.log("\n=== Deployment Summary ===");
  console.log("AccessControl Address:", accessControlAddress);
  console.log("MedicineSupplyChain Address:", medicineSupplyChainAddress);
  console.log("Deployer Address:", deployer.address);
  
  console.log("\n=== Contract ABI Information ===");
  console.log("AccessControl ABI:", JSON.stringify(AccessControl.interface.format("json")));
  console.log("MedicineSupplyChain ABI:", JSON.stringify(MedicineSupplyChain.interface.format("json")));

  // Save deployment info to a file
  const deploymentInfo = {
    network: "localhost",
    chainId: 1337,
    contracts: {
      AccessControl: {
        address: accessControlAddress,
        abi: AccessControl.interface.format("json")
      },
      MedicineSupplyChain: {
        address: medicineSupplyChainAddress,
        abi: MedicineSupplyChain.interface.format("json")
      }
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync('./deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
