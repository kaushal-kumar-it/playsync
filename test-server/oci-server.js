// OCI Object Storage upload/delete server
// Run: node oci-server.js

console.log("Starting server...");

const express = require("express");
console.log("✓ express loaded");
const multer = require("multer");
console.log("✓ multer loaded");
const cors = require("cors");
console.log("✓ cors loaded");
const dotenv = require("dotenv");
console.log("✓ dotenv loaded");
const fs = require("fs");
const path = require("path");
console.log("✓ fs/path loaded");

console.log("Loading oci-sdk...");
const oci = require("oci-sdk");
console.log("✓ oci-sdk loaded");

dotenv.config();
console.log("✓ .env loaded");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Setup upload directory
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOAD_DIR });

// Initialize OCI client
let objectStorage = null;
let namespace = process.env.OCI_NAMESPACE;
let bucket = process.env.OCI_BUCKET_NAME;

console.log("Initializing OCI client...");
console.log(`Config file: ${process.env.OCI_PRIVATE_KEY_PATH}`);

try {
  const provider = new oci.ConfigFileAuthenticationDetailsProvider({
    configurationFilePath: process.env.OCI_PRIVATE_KEY_PATH,
    profile: process.env.OCI_PROFILE || "DEFAULT",
  });

  console.log("Provider created, creating ObjectStorageClient...");

  objectStorage = new oci.ObjectStorageClient({
    authenticationDetailsProvider: provider,
  });

  console.log("✅ OCI client initialized");
  console.log(`   Namespace: ${namespace}`);
  console.log(`   Bucket: ${bucket}`);
} catch (err) {
  console.error("❌ Failed to initialize OCI client:");
  console.error(err);
  process.exit(1);
}

// Health check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "OCI Object Storage Server",
    namespace,
    bucket,
  });
});

// Upload file
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  const filePath = req.file.path;
  const objectName = `${Date.now()}_${req.file.originalname}`;

  try {
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);

    await objectStorage.putObject({
      namespaceName: namespace,
      bucketName: bucket,
      objectName: objectName,
      putObjectBody: fileStream,
      contentLength: stats.size,
    });

    // Cleanup temp file
    fs.unlinkSync(filePath);

    const fileUrl = `https://objectstorage.${process.env.OCI_REGION}.oraclecloud.com/n/${namespace}/b/${bucket}/o/${encodeURIComponent(objectName)}`;

    console.log(`✅ Uploaded: ${objectName}`);

    res.json({
      success: true,
      objectName,
      url: fileUrl,
      size: stats.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    
    // Cleanup temp file on error
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}

    res.status(500).json({ error: err.message });
  }
});

// Delete file
app.delete("/api/delete/:objectName", async (req, res) => {
  const objectName = req.params.objectName;

  if (!objectName) {
    return res.status(400).json({ error: "Object name required" });
  }

  try {
    await objectStorage.deleteObject({
      namespaceName: namespace,
      bucketName: bucket,
      objectName: objectName,
    });

    console.log(`🗑️  Deleted: ${objectName}`);

    res.json({
      success: true,
      deleted: objectName,
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// List objects
app.get("/api/list", async (req, res) => {
  try {
    const response = await objectStorage.listObjects({
      namespaceName: namespace,
      bucketName: bucket,
    });

    const objects = response.listObjects.objects.map((obj) => ({
      name: obj.name,
      size: obj.size,
      timeCreated: obj.timeCreated,
    }));

    res.json({
      success: true,
      objects,
      count: objects.length,
    });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST   /api/upload          - Upload file`);
  console.log(`  DELETE /api/delete/:name    - Delete file`);
  console.log(`  GET    /api/list            - List all files`);
  console.log(`  GET    /                    - Health check\n`);
});
