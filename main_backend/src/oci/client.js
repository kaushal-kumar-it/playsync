import * as os from "oci-objectstorage";
import { 
  InstancePrincipalsAuthenticationDetailsProviderBuilder,
  Region 
} from "oci-common";
import dotenv from "dotenv";

dotenv.config();

export const namespace = process.env.OCI_NAMESPACE;
export const bucket = process.env.OCI_BUCKET_NAME;
const region = process.env.OCI_REGION || "ap-mumbai-1";

if (!namespace || !bucket) {
  console.error("OCI Configuration Error:");
  console.error("OCI_NAMESPACE:", namespace || "MISSING");
  console.error("OCI_BUCKET_NAME:", bucket || "MISSING");
  throw new Error("Missing OCI_NAMESPACE or OCI_BUCKET_NAME");
}

let objectStorageClient;
let clientInitialized = false;

async function initClient() {
  if (clientInitialized) return;
  
  const provider = await new InstancePrincipalsAuthenticationDetailsProviderBuilder().build();
  
  objectStorageClient = new os.ObjectStorageClient({
    authenticationDetailsProvider: provider,
  });
  objectStorageClient.region = Region.fromRegionId(region);
  
  clientInitialized = true;
}

export async function generateUploadUrl(filename) {
  await initClient();
  
  const objectName = `${Date.now()}_${filename}`;

  const request = {
    namespaceName: namespace,
    bucketName: bucket,
    createPreauthenticatedRequestDetails: {
      name: `upload-${objectName}`,
      objectName,
      accessType: os.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectWrite,
      timeExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  };

  const response = await objectStorageClient.createPreauthenticatedRequest(request);

  return {
    uploadUrl: `https://objectstorage.${region}.oraclecloud.com${response.preauthenticatedRequest.accessUri}`,
    objectName,
    expiresAt: response.preauthenticatedRequest.timeExpires,
  };
}

export async function generateReadUrl(objectKey) {
  await initClient();
  
  const request = {
    namespaceName: namespace,
    bucketName: bucket,
    createPreauthenticatedRequestDetails: {
      name: `read-${objectKey}`,
      objectName: objectKey,
      accessType: os.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectRead,
      timeExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  };

  const response = await objectStorageClient.createPreauthenticatedRequest(request);

  return {
    playbackUrl: `https://objectstorage.${region}.oraclecloud.com${response.preauthenticatedRequest.accessUri}`,
    objectName: objectKey,
    expiresAt: response.preauthenticatedRequest.timeExpires,
  };
}

export async function deleteFromOCI(objectKey) {
  await initClient();
  
  await objectStorageClient.deleteObject({
    namespaceName: namespace,
    bucketName: bucket,
    objectName: objectKey,
  });
}