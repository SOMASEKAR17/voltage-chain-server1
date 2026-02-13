import { ethers } from "ethers";


const ABI = [
  "function mintBatteryNFT(address to, string _batteryId, uint256 _healthScore, string _status, string _tokenURI)",
  "function updateBatteryHealth(uint256 tokenId, uint256 newHealth)",
  "function updateBatteryStatus(uint256 tokenId, string newStatus)",
  "function burnBatteryNFT(uint256 tokenId)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
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

  let tokenId: string | null = null;

for (const log of receipt.logs) {
  try {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === "Transfer") {
      tokenId = parsed.args.tokenId.toString();
      break;
    }
  } catch {}
}

if (!tokenId) {
  console.error("Logs parsing failed. Logs:", JSON.stringify(receipt.logs, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value // Handle BigInt serialization
  , 2));
  throw new Error("Mint succeeded but tokenId not found in logs");
}

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

