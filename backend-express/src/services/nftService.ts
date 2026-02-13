import { ethers } from "ethers";


const ABI = [
  "function mintBatteryNFT(address to, string memory cid) public returns (uint256)",
  "function updateBatteryMetadata(uint256 tokenId, string memory cid) public",
  "function safeTransferFrom(address from, address to, uint256 tokenId) public",
  "function burn(uint256 tokenId) public",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function ownerOf(uint256 tokenId) public view returns (address)"
];

let contract: ethers.Contract | null = null;


function getContract(): ethers.Contract {
  if (contract) return contract;

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL not found in environment variables");
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let privateKey = process.env.PRIVATE_KEY || process.env.MINTER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Private key not found in environment variables");
  }

  // Sanitize private key
  privateKey = privateKey.trim();
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const wallet = new ethers.Wallet(
    privateKey,
    provider
  );

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS not found in environment variables");

  contract = new ethers.Contract(
    contractAddress,
    ABI,
    wallet
  );

  return contract;
}

export async function mintBatteryNFT(
  batteryId: string,
  healthScore: number,
  cid: string,
  to: string
) {
  const contract = getContract();
  const tokenURI = `ipfs://${cid}`;

  const tx = await contract.mintBatteryNFT(
    to,
    batteryId,
    Math.floor(healthScore),
    "active",
    tokenURI
  );

  const receipt = await tx.wait();

  const tokenId = receipt.logs[0].args[2].toString();

  return {
    tokenId,
    txHash: receipt.hash
  };
}


export async function updateBatteryHealth(
  tokenId: string,
  newHealth: number
) {
  const contract = getContract();
  const tx = await contract.updateBatteryHealth(
    tokenId,
    Math.floor(newHealth)
  );

  const receipt = await tx.wait();

  return {
    txHash: receipt.hash
  };
}

export async function updateBatteryMetadata(
  tokenId: string,
  cid: string
) {
  const contract = getContract();
  const tx = await contract.updateBatteryMetadata(
    tokenId,
    cid
  );

  const receipt = await tx.wait();

  return receipt.hash;
}

export async function transferBatteryNFT(
  tokenId: string,
  from: string,
  to: string
) {
  const contract = getContract();
  const tx = await contract.safeTransferFrom(
    from,
    to,
    tokenId
  );

  const receipt = await tx.wait();

  return receipt.hash;
}

export async function burnBatteryNFT(
  tokenId: string
) {
  const contract = getContract();
  const tx = await contract.burn(
    tokenId
  );

  const receipt = await tx.wait();

  return receipt.hash;
}

export async function getBatteryOnChain(
  tokenId: string
) {
  const contract = getContract();
  const uri = await contract.tokenURI(tokenId);
  const owner = await contract.ownerOf(tokenId);

  return {
    tokenId,
    tokenURI: uri,
    owner
  };
}

