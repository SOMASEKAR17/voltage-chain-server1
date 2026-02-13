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

