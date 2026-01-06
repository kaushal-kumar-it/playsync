
export const namespace = process.env.OCI_NAMESPACE;
export const bucket = process.env.OCI_BUCKET_NAME;
const region = process.env.OCI_REGION || "ap-mumbai-1";
const pdaUrl = process.env.PDA_URL;

export async function generateUploadUrl(filename) {
  const objectName = `${Date.now()}_${filename}`;
  const uploadUrl = `${pdaUrl}${objectName}`;

  return {
    uploadUrl: uploadUrl,
    objectName: objectName,
    expiresAt: null, 
  };
}
export async function generateDeleteUrl(objectName) {
  const deleteUrl = `${pdaUrl}${objectName}`;

  return {
    deleteUrl: deleteUrl,
    objectName: objectName,
    expiresAt: null,
  };
}

export async function deleteFromOCI(objectKey) {
  const deleteUrl = `${pdaUrl}${objectKey}`;
  
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete object: ${response.status}`);
  }
}
