const firebaseConfig = {
  apiKey: "AIzaSyCyjpwTht572LFot2sqqi-83yOgp000POQ",
  authDomain: "crm-three-ar.firebaseapp.com",
  projectId: "crm-three-ar",
  storageBucket: "crm-three-ar.appspot.com",
  messagingSenderId: "261822606732",
  appId: "1:261822606732:web:f6331eee541477af2fbaa9",
  measurementId: "G-3BLVZMFGP2",
};
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
window.auth = firebase.auth();
