// Simple OCI Object Storage server using REST API (no oci-sdk needed)
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Load config from .env manually
const envPath = path.join(__dirname, ".env");
const envVars = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const cleaned = line.replace(/\r/g, "").trim();
    if (!cleaned || cleaned.startsWith("#")) return;
    const match = cleaned.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ""); // remove quotes
      envVars[key] = value;
    }
  });
}

console.log("Environment variables loaded:", Object.keys(envVars));

const CONFIG = {
  tenancy: envVars.OCI_TENANCY_ID,
  user: envVars.OCI_USER_ID,
  fingerprint: envVars.OCI_FINGERPRINT,
  keyFile: envVars.OCI_PRIVATE_KEY_PATH,
  region: envVars.OCI_REGION || "ap-mumbai-1",
  namespace: envVars.OCI_NAMESPACE,
  bucket: envVars.OCI_BUCKET_NAME,
};

console.log("Config loaded:");
console.log(`  Region: ${CONFIG.region}`);
console.log(`  Namespace: ${CONFIG.namespace}`);
console.log(`  Bucket: ${CONFIG.bucket}`);

// Setup uploads
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

// Load private key
let privateKey;
try {
  privateKey = fs.readFileSync(CONFIG.keyFile, "utf8");
  console.log("✅ Private key loaded");
} catch (err) {
  console.error("❌ Failed to load private key:", err.message);
  process.exit(1);
}

// Sign OCI request
function signRequest(method, path, host, body, contentType) {
  const signDate = new Date().toUTCString();
  
  const requestTarget = `${method.toLowerCase()} ${path}`;
  const headersToSign = ["(request-target)", "date", "host"];
  
  const signingHeaders = {
    "(request-target)": requestTarget,
    "date": signDate,
    "host": host,
  };
  
  if (body) {
    const contentLength = Buffer.byteLength(body);
    headersToSign.push("content-length", "content-type");
    signingHeaders["content-length"] = contentLength.toString();
    signingHeaders["content-type"] = contentType;
  }

  const signingString = headersToSign
    .map((h) => `${h}: ${signingHeaders[h]}`)
    .join("\n");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingString);
  const signature = sign.sign(privateKey, "base64");

  const authHeader = `Signature version="1",keyId="${CONFIG.tenancy}/${CONFIG.user}/${CONFIG.fingerprint}",algorithm="rsa-sha256",headers="${headersToSign.join(" ")}",signature="${signature}"`;

  return { 
    authHeader, 
    signDate, 
    contentLength: body ? Buffer.byteLength(body) : undefined,
    contentType: body ? contentType : undefined
  };
}

// Make OCI API request
function ociRequest(method, path, body = null, contentType = "application/json") {
  return new Promise((resolve, reject) => {
    const host = `objectstorage.${CONFIG.region}.oraclecloud.com`;
    
    const signResult = signRequest(method, path, host, body, contentType);
    
    const headers = {
      "date": signResult.signDate,
      "host": host,
      "authorization": signResult.authHeader,
    };

    if (body) {
      headers["content-length"] = signResult.contentLength.toString();
      headers["content-type"] = signResult.contentType;
    }

    const options = {
      hostname: host,
      port: 443,
      path,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        } else {
          reject(new Error(`OCI API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "OCI Simple Server", namespace: CONFIG.namespace, bucket: CONFIG.bucket });
});

// Upload file
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const filePath = req.file.path;
  const objectName = `${Date.now()}_${req.file.originalname}`;

  try {
    const fileContent = fs.readFileSync(filePath);
    const path = `/n/${CONFIG.namespace}/b/${CONFIG.bucket}/o/${encodeURIComponent(objectName)}`;

    await ociRequest("PUT", path, fileContent, req.file.mimetype || "application/octet-stream");

    fs.unlinkSync(filePath);

    const url = `https://objectstorage.${CONFIG.region}.oraclecloud.com${path}`;
    console.log(`✅ Uploaded: ${objectName}`);

    res.json({ success: true, objectName, url, size: fileContent.length });
  } catch (err) {
    console.error("Upload error:", err.message);
    try { fs.unlinkSync(filePath); } catch (e) {}
    res.status(500).json({ error: err.message });
  }
});

// Delete file
app.delete("/api/delete/:objectName", async (req, res) => {
  const objectName = req.params.objectName;
  if (!objectName) return res.status(400).json({ error: "Missing object name" });

  try {
    const path = `/n/${CONFIG.namespace}/b/${CONFIG.bucket}/o/${encodeURIComponent(objectName)}`;
    await ociRequest("DELETE", path);

    console.log(`🗑️  Deleted: ${objectName}`);
    res.json({ success: true, deleted: objectName });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// List objects
app.get("/api/list", async (req, res) => {
  try {
    const path = `/n/${CONFIG.namespace}/b/${CONFIG.bucket}/o`;
    const result = await ociRequest("GET", path);
    const objects = JSON.parse(result.data).objects || [];

    res.json({
      success: true,
      objects: objects.map((o) => ({ name: o.name, size: o.size, timeCreated: o.timeCreated })),
      count: objects.length,
    });
  } catch (err) {
    console.error("List error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST   /api/upload       - Upload file`);
  console.log(`  DELETE /api/delete/:name - Delete file`);
  console.log(`  GET    /api/list         - List files\n`);
});
