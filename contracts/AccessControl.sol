// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AccessControl
 * @dev Manages role-based access control for healthcare supply chain
 */
contract AccessControl {
    // Role definitions
    enum Role {
        NONE,
        MANUFACTURER,
        DISTRIBUTOR,
        PHARMACY,
        PATIENT,
        ADMIN
    }

    // Mapping from address to role
    mapping(address => Role) public roles;
    
    // Mapping from role to boolean for role existence
    mapping(Role => bool) public roleExists;
    
    // Events
    event RoleGranted(address indexed account, Role role);
    event RoleRevoked(address indexed account, Role role);
    
    // Modifiers
    modifier onlyRole(Role role) {
        require(roles[msg.sender] == role, "AccessControl: account does not have required role");
        _;
    }
    
    modifier onlyAdmin() {
        require(roles[msg.sender] == Role.ADMIN, "AccessControl: account is not admin");
        _;
    }
    
    constructor() {
        roles[msg.sender] = Role.ADMIN;
        roleExists[Role.ADMIN] = true;
        emit RoleGranted(msg.sender, Role.ADMIN);
    }
    
    /**
     * @dev Grant role to an account
     * @param account Address to grant role to
     * @param role Role to grant
     */
    function grantRole(address account, Role role) external onlyAdmin {
        require(account != address(0), "AccessControl: account is zero address");
        require(role != Role.NONE, "AccessControl: cannot grant NONE role");
        
        roles[account] = role;
        roleExists[role] = true;
        emit RoleGranted(account, role);
    }
    
    /**
     * @dev Revoke role from an account
     * @param account Address to revoke role from
     */
    function revokeRole(address account) external onlyAdmin {
        require(account != address(0), "AccessControl: account is zero address");
        require(roles[account] != Role.NONE, "AccessControl: account has no role");
        
        Role role = roles[account];
        roles[account] = Role.NONE;
        emit RoleRevoked(account, role);
    }
    
    /**
     * @dev Check if account has specific role
     * @param account Address to check
     * @param role Role to check for
     * @return bool True if account has role
     */
    function hasRole(address account, Role role) external view returns (bool) {
        return roles[account] == role;
    }
    
    /**
     * @dev Get role of an account
     * @param account Address to get role for
     * @return Role The role of the account
     */
    function getRole(address account) external view returns (Role) {
        return roles[account];
    }
}
