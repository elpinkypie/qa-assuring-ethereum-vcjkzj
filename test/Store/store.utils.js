const { ethers } = require("hardhat");

class StoreUtils {
    static async deployStoreContract() {
        const Store = await ethers.getContractFactory("Store");
        return await Store.deploy();
    }

    static async addProduct(storeContract, owner, name, quantity) {
        await storeContract.connect(owner).addProduct(name, quantity);
    }

    static async getProductByName(storeContract, name) {
        return await storeContract.getProductByName(name);
    }

    static async getProductById(storeContract, productId) {
        return await storeContract.getProductById(productId);
    }

    static async getAllProducts(storeContract) {
        return await storeContract.getAllProducts();
    }

    static async buyProduct(storeContract, buyer, productId) {
        await storeContract.connect(buyer).buyProduct(productId);
    }

    static async refundProduct(storeContract, buyer, productId) {
        await storeContract.connect(buyer).refundProduct(productId);
    }

    static async setRefundPolicy(storeContract, owner, blockNumber) {
        await storeContract.connect(owner).setRefundPolicyNumber(blockNumber);
    }
}

module.exports = StoreUtils;
