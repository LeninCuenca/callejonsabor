/*
CommonJS wrapper for seed script so it runs when project `type` is "module".
*/

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

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
let db;

if (process.env.FIRESTORE_EMULATOR_HOST) {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-project';
  admin.initializeApp({ projectId });
  db = admin.firestore();
  console.log('Using Firestore emulator at', process.env.FIRESTORE_EMULATOR_HOST);
} else {
  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    console.error('SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS must point to a valid service account JSON file when not using emulator');
    process.exit(1);
  }

  const serviceAccount = require(path.resolve(process.cwd(), serviceAccountPath));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
}

async function seed() {
  console.log('Cleaning existing database collections...');
  const collectionsToClean = ['products', 'orders', 'order_items', 'payments'];
  for (const collName of collectionsToClean) {
    const snap = await db.collection(collName).get();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Cleared ${collName}`);
  }

  console.log('Seeding Firestore with sample data...');

  const products = [
    // PLATOS FUERTES
    { name: 'Filete de Pollo', price: 2.5, category: 'PLATOS FUERTES', requires_packaging: true, stock: 50 },
    { name: 'Chuleta de Cerdo', price: 3.5, category: 'PLATOS FUERTES', requires_packaging: true, stock: 50 },
    { name: 'Costilla de Cerdo', price: 4.0, category: 'PLATOS FUERTES', requires_packaging: true, stock: 50 },
    { name: 'Presa de Pollo', price: 2.5, category: 'PLATOS FUERTES', requires_packaging: true, stock: 50 },
    { name: 'Pincho de Camarón', price: 3.5, category: 'PLATOS FUERTES', requires_packaging: true, stock: 50 },
    { name: 'Papi Pollo', price: 2.5, category: 'PLATOS FUERTES', requires_packaging: true, stock: 50 },
    { name: 'Salchipapa', price: 1.5, category: 'PLATOS FUERTES', requires_packaging: true, stock: 50 },
    { name: 'Choclo Asado', price: 1.5, category: 'PLATOS FUERTES', requires_packaging: false, stock: 50 },

    // PORCIONES
    { name: 'Papa', price: 1.0, category: 'PORCIONES', requires_packaging: false, stock: 50 },
    { name: 'Arroz', price: 1.0, category: 'PORCIONES', requires_packaging: false, stock: 50 },
    { name: 'Menestra', price: 1.0, category: 'PORCIONES', requires_packaging: false, stock: 50 },
    // BEBIDAS
    { name: 'Jarra de Horchata', price: 3.0, category: 'BEBIDAS', requires_packaging: false, stock: 50 },
    { name: '1/2 Jarra de Horchata', price: 1.5, category: 'BEBIDAS', requires_packaging: false, stock: 50 },
    { name: 'Vaso de Horchata', price: 0.5, category: 'BEBIDAS', requires_packaging: false, stock: 50 },
    { name: 'Café', price: 0.75, category: 'BEBIDAS', requires_packaging: false, stock: 50 },
    { name: 'Cola Personal', price: 0.75, category: 'BEBIDAS', requires_packaging: false, stock: 50 },
    { name: 'Cola de Litro', price: 1.25, category: 'BEBIDAS', requires_packaging: false, stock: 50 },
    { name: 'Cerveza', price: 3.5, category: 'BEBIDAS', requires_packaging: false, stock: 50 }
  ];

  const productRefs = [];
  for (const p of products) {
    const ref = await db.collection('products').add(p);
    productRefs.push({ id: ref.id, ...p });
  }

  // Example Order
  const order = {
    order_type: 'dine_in',
    table_number: 5,
    status: 'active',
    subtotal: 5.0,
    packaging_fee: 0.0,
    total: 5.0,
    amount_paid: 0,
    balance: 5.0,
    created_at: new Date().toISOString()
  };

  const orderRef = await db.collection('orders').add(order);

  const orderItems = [
    {
      order_id: orderRef.id,
      product_id: productRefs[0].id, // Filete de Pollo
      product_name: productRefs[0].name,
      category: productRefs[0].category,
      quantity: 2,
      unit_price: productRefs[0].price,
      packaging_surcharge: 0,
      item_total: productRefs[0].price * 2,
      is_takeaway: false,
      paid: false
    }
  ];

  for (const it of orderItems) {
    await db.collection('order_items').add(it);
  }

  console.log('Seed completed.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
