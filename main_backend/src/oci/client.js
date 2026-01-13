import * as os from "oci-objectstorage";
import * as common from "oci-common";
import dotenv from "dotenv";

dotenv.config();

export const namespace = process.env.OCI_NAMESPACE;
export const bucket = process.env.OCI_BUCKET_NAME;
const region = process.env.OCI_REGION || "ap-mumbai-1";

if (!namespace || !bucket) {
  console.error("OCI Configuration Error:");
  console.error("   OCI_NAMESPACE:", namespace || "MISSING");
  console.error("   OCI_BUCKET_NAME:", bucket || "MISSING");
  throw new Error("Missing OCI_NAMESPACE or OCI_BUCKET_NAME in environment");
}

//CORRECT AUTH FOR ORACLE VM
const provider =
  new common.InstancePrincipalsAuthenticationDetailsProvider();

const objectStorageClient = new os.ObjectStorageClient({
  authenticationDetailsProvider: provider,
});

objectStorageClient.region = common.Region.fromRegionId(region);

export async function generateUploadUrl(filename) {
  const objectName = `${Date.now()}_${filename}`;

  const createPreauthenticatedRequestDetails = {
    name: `upload-${objectName}`,
    objectName,
    accessType:
      os.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectWrite,
    timeExpires: new Date(Date.now() + 3600000),
  };

  const request = {
    namespaceName: namespace,
    bucketName: bucket,
    createPreauthenticatedRequestDetails,
  };

  const response =
    await objectStorageClient.createPreauthenticatedRequest(request);

  const fullUrl = `https://objectstorage.${region}.oraclecloud.com${response.preauthenticatedRequest.accessUri}`;

  return {
    uploadUrl: fullUrl,
    objectName,
    expiresAt: response.preauthenticatedRequest.timeExpires,
  };
}

export async function generateReadUrl(objectKey) {
  const createPreauthenticatedRequestDetails = {
    name: `read-${objectKey}`,
    objectName: objectKey,
    accessType:
      os.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectRead,
    timeExpires: new Date(Date.now() + 3600000),
  };

  const request = {
    namespaceName: namespace,
    bucketName: bucket,
    createPreauthenticatedRequestDetails,
  };

  const response =
    await objectStorageClient.createPreauthenticatedRequest(request);

  const fullUrl = `https://objectstorage.${region}.oraclecloud.com${response.preauthenticatedRequest.accessUri}`;

  return {
    playbackUrl: fullUrl,
    objectName: objectKey,
    expiresAt: response.preauthenticatedRequest.timeExpires,
  };
}

export async function deleteFromOCI(objectKey) {
  const deleteObjectRequest = {
    namespaceName: namespace,
    bucketName: bucket,
    objectName: objectKey,
  };

  await objectStorageClient.deleteObject(deleteObjectRequest);
}
