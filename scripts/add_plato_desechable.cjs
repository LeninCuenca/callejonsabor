const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load .env manually if it exists
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.length > 0 && val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
          val = val.substring(1, val.length - 1);
        }
        if (val.length > 0 && val.charAt(0) === "'" && val.charAt(val.length - 1) === "'") {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.warn('Could not load .env file:', e.message);
}

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || 'callejon-del-sabor-firebase-adminsdk-fbsvc-9cbd6d0354.json';
const resolvedServiceAccountPath = path.resolve(__dirname, '..', serviceAccountPath);

if (!fs.existsSync(resolvedServiceAccountPath)) {
  console.error('SERVICE_ACCOUNT_PATH must point to a valid service account JSON file. Checked:', resolvedServiceAccountPath);
  process.exit(1);
}

const serviceAccount = require(resolvedServiceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function run() {
  const productsColl = db.collection('products');
  
  // Check if "Plato Desechable" already exists
  const querySnapshot = await productsColl.where('name', '==', 'Plato Desechable').get();
  
  if (!querySnapshot.empty) {
    console.log('Product "Plato Desechable" already exists.');
    process.exit(0);
  }
  
  // Add product
  const newProduct = {
    name: 'Plato Desechable',
    price: 0.25,
    category: 'EXTRAS',
    requires_packaging: false,
    stock: 9999
  };
  
  const ref = await productsColl.add(newProduct);
  console.log(`Added "Plato Desechable" with ID: ${ref.id}`);
}

run().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
