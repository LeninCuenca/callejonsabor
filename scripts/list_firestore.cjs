// scripts/list_firestore.cjs
// Lista colecciones y hasta 10 documentos de cada una en Firestore.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'demo-project';

const admin = require('firebase-admin');

admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
const db = admin.firestore();

(async () => {
  try {
    console.log('Using Firestore emulator at', process.env.FIRESTORE_EMULATOR_HOST);
    const collections = await db.listCollections();
    if (!collections || collections.length === 0) {
      console.log('No collections found.');
      process.exit(0);
    }

    console.log('Collections:');
    for (const c of collections) {
      console.log('- ' + c.id);
      const snap = await c.limit(10).get();
      if (snap.empty) {
        console.log('   (empty)');
        continue;
      }
      snap.forEach(doc => {
        try {
          console.log('   ', doc.id, JSON.stringify(doc.data()));
        } catch (e) {
          console.log('   ', doc.id, doc.data());
        }
      });
    }
  } catch (err) {
    console.error('Error listing collections:', err);
    process.exit(2);
  }
  process.exit(0);
})();
