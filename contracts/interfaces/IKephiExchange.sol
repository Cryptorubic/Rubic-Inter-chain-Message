pragma solidity ^0.8.0;

interface IKephiExchange {
    struct NftTokenInfo {
        address tokenAddress;
        uint256 id;
        uint256 amount;
    }

    function makeExchangeERC721(
        bytes32 idOrder,
        address[2] calldata SellerBuyer,
        NftTokenInfo calldata tokenToBuy,
        NftTokenInfo calldata tokenToSell,
        address[] calldata feeAddresses,
    	uint256[] calldata feeAmounts,
        bytes calldata signature
    ) external payable;
}