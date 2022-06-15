import { ethers } from 'hardhat';

export const DEADLINE = '9999999999999999';
export const DST_CHAIN_ID = 5;
export const VERSION_V2 = 0;
export const VERSION_V3 = 1;
export const VERSION = 2;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const INTEGRATOR = '0x23a05b3673DFBf0d1Ce9Bfa6407eD0DbD068aF2D'; // random address
export const feeDecimals = 10 ** 6;
export const EXECUTOR_ADDRESS = '0x503CEF47CE5e37AA62544A363BEF3C9b62d42116';
export const DEFAULT_AMOUNT_IN = ethers.utils.parseEther('1000');
export const DEFAULT_AMOUNT_OUT_MIN = ethers.utils.parseEther('1000');
//export const DEFAULT_AMOUNT_IN_USDC = ethers.BigNumber.from('1000000000');
export const DEFAULT_AMOUNT_IN_USDC = ethers.utils.parseEther('1000');
export const DEFAULT_AMOUNT_IN_SWAPTOKEN = ethers.BigNumber.from('100000000000000000000');
