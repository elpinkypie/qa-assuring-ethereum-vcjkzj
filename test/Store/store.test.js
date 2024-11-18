const { expect } = require("chai");
const { ethers } = require("hardhat");
const StoreUtils = require("./store.utils");
const { PRODUCTS, REFUND } = require("./constants"); // For future purposes i would generate randomly these parameters

describe("Store Contract", function () {
    let storeContract, owner, buyer1, buyer2;

    // Deploy new contract instance before each test
    beforeEach(async function () {
        [owner, buyer1, buyer2] = await ethers.getSigners();
        storeContract = await StoreUtils.deployStoreContract();
    });

    // This is basic check for every contract in the future and should be transferred inside utils/helpers and should be called beforeEach test
    it("should deploy the contract correctly", async function () {
        // Validate that the contract received a valid address
        expect(storeContract.address).to.be.properAddress;

        // Validate that deployed code exists
        const code = await ethers.provider.getCode(storeContract.address);
        expect(code).to.not.equal("0x"); // indicates no code at the address

        // Validate correct initialization (e.g., owner is correctly set)
        const ownerAddress = await storeContract.owner();
        expect(ownerAddress).to.equal(owner.address); // Ensure the owner is the deploying account
    });

    it("should allow adding a new product", async function () {
        // Add a new product
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);

        // Fetch the product
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);

        // Validate the product's properties
        expect(product.name).to.equal(PRODUCTS.DEFAULT_NAME);
        expect(product.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY);
    });

    it("should update an existing product's quantity and emit the correct event", async function () {
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);

        // Update the product's quantity
        await expect(
            StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.UPDATE_QUANTITY)
        ).to.emit(storeContract, "ProductUpdated")
            .withArgs(0, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY + PRODUCTS.UPDATE_QUANTITY);

        // Fetch and validate the updated product
        const updatedProduct = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        expect(updatedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY + PRODUCTS.UPDATE_QUANTITY);
    });

    it("should allow buyers to view available products and purchase a product", async function () {
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);

        // Fetch all available products
        const allProducts = await StoreUtils.getAllProducts(storeContract);

        // Validate the product is visible in the available products list
        expect(allProducts.length).to.equal(PRODUCTS.SINGLE_PRODUCT_ADDED);
        expect(allProducts[0].name).to.equal(PRODUCTS.DEFAULT_NAME);
        expect(allProducts[0].quantity).to.equal(PRODUCTS.INITIAL_QUANTITY);

        // Fetch the product ID by name
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        const productId = product.id;

        // Buyer1 purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Fetch and validate the updated product
        const updatedProduct = await StoreUtils.getProductById(storeContract, productId);
        expect(updatedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY - 1);

        // Fetch all available products again and validate the quantity is updated
        const updatedProducts = await StoreUtils.getAllProducts(storeContract);
        expect(updatedProducts[0].quantity).to.equal(PRODUCTS.INITIAL_QUANTITY - 1);
    });

    it("should emit the ProductRefund event when a product is returned", async function () {
        // Add a new product
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);

        // Fetch the product ID by name
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        const productId = product.id;

        // Buyer purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Buyer returns the product and check the event
        await expect(
            StoreUtils.refundProduct(storeContract, buyer1, productId)
        ).to.emit(storeContract, "ProductRefund")
            .withArgs(productId);
    });

    it("should allow buyers to return a purchased product", async function () {
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        const productId = product.id;

        // Buyer1 purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Validate the product quantity decreases
        const purchasedProduct = await StoreUtils.getProductById(storeContract, productId);
        expect(purchasedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY - 1);

        // Validate the buyer is recorded
        const buyerPurchaseBlock = await storeContract.buyers(buyer1.address, productId);
        expect(buyerPurchaseBlock).to.be.greaterThan(0);

        // Buyer1 returns the product
        await expect(
            StoreUtils.refundProduct(storeContract, buyer1, productId)
        ).to.emit(storeContract, "ProductRefund")
            .withArgs(productId);

        // Validate the product quantity is restored
        const refundedProduct = await StoreUtils.getProductById(storeContract, productId);
        expect(refundedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY);

        // Validate the buyer's refund state is reset
        const buyerRefundState = await storeContract.buyers(buyer1.address, productId);
        expect(buyerRefundState).to.equal(0);
    });


    it("should not allow the same buyer to purchase the same product twice unless they return it", async function () {
        // Add a new product
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        const productId = product.id;

        // Buyer1 purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Validate the buyer's purchase is recorded
        const buyerPurchaseBlock = await storeContract.buyers(buyer1.address, productId);
        expect(buyerPurchaseBlock).to.be.greaterThan(0);

        // Attempt to purchase the same product again (should fail)
        await expect(
            StoreUtils.buyProduct(storeContract, buyer1, productId)
        ).to.be.revertedWith("You cannot buy the same product more than once!");

        // Buyer1 returns the product
        await StoreUtils.refundProduct(storeContract, buyer1, productId);

        // Validate the buyer's refund state is reset
        const buyerRefundState = await storeContract.buyers(buyer1.address, productId);
        expect(buyerRefundState).to.equal(0); // Indicates refund processed

        // Buyer1 re-purchases the product after returning it
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Fetch the updated product and validate quantity
        const updatedProduct = await StoreUtils.getProductById(storeContract, productId);
        expect(updatedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY - 1);

        // Validate the buyer's purchase state is updated again
        const newBuyerPurchaseBlock = await storeContract.buyers(buyer1.address, productId);
        expect(newBuyerPurchaseBlock).to.be.greaterThan(0);
    });


    it("should deny refunds after 100 blocks", async function () {
        // Add a new product
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);

        // Fetch the product ID by name
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        const productId = product.id;

        // Buyer purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Set refund policy to 100 blocks
        await StoreUtils.setRefundPolicy(storeContract, owner, 100);

        // Validate refund within block limit
        await ethers.provider.send("evm_mine"); // Simulate 1 block
        await StoreUtils.refundProduct(storeContract, buyer1, productId); // Should succeed

        // Buyer purchases the product again
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Simulate 101 blocks
        for (let i = 0; i <= 100; i++) {
            await ethers.provider.send("evm_mine");
        }

        // Attempt refund after 100 blocks (should fail)
        await expect(
            StoreUtils.refundProduct(storeContract, buyer1, productId)
        ).to.be.revertedWith("Sorry, your request for refund has been denied.");
    });


    it("should not allow a buyer to purchase the same product twice without returning it", async function () {
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);

        // Fetch the product ID by name
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        const productId = product.id;

        // Buyer purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Attempt to purchase the same product again (should fail)
        await expect(
            StoreUtils.buyProduct(storeContract, buyer1, productId)
        ).to.be.revertedWith("You cannot buy the same product more than once!");

        // Buyer returns the product
        await StoreUtils.refundProduct(storeContract, buyer1, productId);

        // Buyer re-purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Validate updated quantity
        const updatedProduct = await StoreUtils.getProductById(storeContract, productId);
        expect(updatedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY - 1);
    });

    it("should not allow a buyer to return a product twice", async function () {
        await StoreUtils.addProduct(storeContract, owner, PRODUCTS.DEFAULT_NAME, PRODUCTS.INITIAL_QUANTITY);
        const product = await storeContract.getProductByName(PRODUCTS.DEFAULT_NAME);
        const productId = product.id;

        // Buyer1 purchases the product
        await StoreUtils.buyProduct(storeContract, buyer1, productId);

        // Validate the product quantity decreases
        const purchasedProduct = await StoreUtils.getProductById(storeContract, productId);
        expect(purchasedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY - 1);

        // Buyer1 returns the product
        await expect(
            StoreUtils.refundProduct(storeContract, buyer1, productId)
        ).to.emit(storeContract, "ProductRefund")
            .withArgs(productId);

        // Validate the product quantity is restored
        const refundedProduct = await StoreUtils.getProductById(storeContract, productId);
        expect(refundedProduct.quantity).to.equal(PRODUCTS.INITIAL_QUANTITY);

        // Attempt to return the product again (should fail)
        await expect(
            StoreUtils.refundProduct(storeContract, buyer1, productId)
        ).to.be.revertedWith("You've already returned your product or didn't even bought it.");
    });

});
