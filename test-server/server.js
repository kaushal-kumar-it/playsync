const express = require("express");
const multer = require("multer");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const UPLOAD_DIR = path.resolve(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

let oci;
try {
  oci = require("oci-sdk");
  console.log("✅ oci-sdk loaded");
} catch (e) {
  console.error("Warning: oci-sdk not installed. Install it with `npm install oci-sdk` to enable OCI uploads.");
  oci = null;
}

if (!process.env.OCI_NAMESPACE || !process.env.OCI_BUCKET_NAME || !process.env.OCI_PRIVATE_KEY_PATH) {
  console.warn("Warning: OCI environment variables (OCI_NAMESPACE, OCI_BUCKET_NAME, OCI_PRIVATE_KEY_PATH) are not all set. Upload/delete will fail until configured.");
}

let objectStorage = null;
if (oci) {
  try {
    const provider = new oci.ConfigFileAuthenticationDetailsProvider({
      configurationFilePath: process.env.OCI_PRIVATE_KEY_PATH,
      profile: process.env.OCI_PROFILE || "DEFAULT",
    });

    const clientConfig = { authenticationDetailsProvider: provider };
    if (process.env.OCI_REGION) clientConfig.region = process.env.OCI_REGION;

    objectStorage = new oci.ObjectStorageClient(clientConfig);
    console.log("✅ OCI ObjectStorageClient initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize OCI client:", err.message);
    console.error("   Check your .env file and OCI credentials.");
  }
}

const namespace = process.env.OCI_NAMESPACE;
const bucket = process.env.OCI_BUCKET_NAME;

app.get("/", (req, res) => {
  res.json({ ok: true, message: "OCI Object Storage test server" });
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!objectStorage) return res.status(500).json({ error: "OCI SDK not configured" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;
  const objectName = Date.now() + "_" + req.file.originalname;

  try {
    const fileStream = fs.createReadStream(filePath);

    const putReq = {
      namespaceName: namespace,
      bucketName: bucket,
      putObjectBody: fileStream,
      objectName,
    };

    await objectStorage.putObject(putReq);

    // remove temp
    fs.unlinkSync(filePath);

    const fileUrl = process.env.OCI_REGION
      ? `https://objectstorage.${process.env.OCI_REGION}.oraclecloud.com/n/${namespace}/b/${bucket}/o/${encodeURIComponent(objectName)}`
      : `oci://{namespace}/${bucket}/${encodeURIComponent(objectName)}`;

    res.json({ success: true, url: fileUrl, name: objectName });
  } catch (err) {
    console.error("upload error:", err);
    // cleanup
    try { fs.unlinkSync(filePath); } catch (e) {}
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/api/delete/:name", async (req, res) => {
  if (!objectStorage) return res.status(500).json({ error: "OCI SDK not configured" });
  const objectName = req.params.name;
  if (!objectName) return res.status(400).json({ error: "Missing object name" });

  try {
    await objectStorage.deleteObject({ namespaceName: namespace, bucketName: bucket, objectName });
    res.json({ success: true, deleted: objectName });
  } catch (err) {
    console.error("delete error:", err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Server running at http://0.0.0.0:${PORT}`));