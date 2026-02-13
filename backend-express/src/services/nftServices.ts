import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

const ABI = [
  "function mintBatteryNFT(address to, string memory cid) public returns (uint256)",
  "function updateBatteryMetadata(uint256 tokenId, string memory cid) public",
  "function safeTransferFrom(address from, address to, uint256 tokenId) public",
  "function burn(uint256 tokenId) public",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function ownerOf(uint256 tokenId) public view returns (address)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

export const mintBatteryNFT = async (
  batteryCode: string,
  ownerWallet: string,
  cid: string
) => {
  const tx = await contract.mintBatteryNFT(ownerWallet, cid);
  const receipt = await tx.wait();

  const event = receipt.logs.find((log: any) => log.fragment?.name === "Transfer");
  const tokenId = event?.args?.tokenId?.toString();

  return {
    tokenId,
    txHash: tx.hash,
  };
};

export const updateBatteryMetadata = async (
  tokenId: string,
  cid: string
) => {
  const tx = await contract.updateBatteryMetadata(tokenId, cid);
  await tx.wait();
  return tx.hash;
};
