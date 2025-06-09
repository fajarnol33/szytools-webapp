// Konfigurasi Firebase Anda (seharusnya sudah benar)
const firebaseConfig = {
  apiKey: "AIzaSyDApOKwNr5duAoviez8Sx1JyN4Idi68Bso",
  authDomain: "szytools-app.firebaseapp.com",
  projectId: "szytools-app",
  storageBucket: "szytools-app.firebasestorage.app",
  messagingSenderId: "903429769954",
  appId: "1:903429769954:web:8f9c2700ee36dd78b0acbb",
  measurementId: "G-SD5T7C75R7"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Kunci API Google Gemini Anda
const GEMINI_API_KEY = "AIzaSyCUlwZVtmCSO96jhVwjkSkI4uZcH5tBYRU"; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;


// Menunggu seluruh halaman HTML siap
document.addEventListener('DOMContentLoaded', function () {
    
    // "Mengenalkan" kode pada semua elemen penting di HTML
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const userInfo = document.getElementById('user-info');
    const decomposeButton = document.getElementById('decompose-button');
    const articleText = document.getElementById('article-text');
    const dashboard = document.getElementById('dashboard');
    const loadingIndicator = document.getElementById('loading-indicator');

    // --- LOGIKA UTAMA ADA DI SINI ---

    // 1. Membuat tombol Login berfungsi
    loginButton.onclick = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider);
    };

    // 2. Membuat tombol Logout berfungsi
    logoutButton.onclick = () => {
        auth.signOut();
    };

    // 3. "Penjaga" yang memantau status login pengguna
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // JIKA PENGGUNA SUDAH LOGIN:
            loginContainer.style.display = 'none';
            appContainer.style.display = 'block';

            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();

            if (!doc.exists) {
                // Pengguna baru, buatkan data untuknya
                await userRef.set({
                    email: user.email,
                    name: user.displayName,
                    credits: 10
                });
                userInfo.innerText = `Halo, ${user.displayName} | Sisa Kredit: 10`;
            } else {
                // Pengguna lama, tampilkan datanya
                const userData = doc.data();
                userInfo.innerText = `Halo, ${userData.name} | Sisa Kredit: ${userData.credits}`;
            }

        } else {
            // JIKA PENGGUNA TIDAK LOGIN:
            loginContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    });

    // --- LOGIKA DECOMPOSER ---
    async function callGemini(prompt) {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) return data.candidates[0].content.parts[0].text;
        else { console.error("API Error:", data); return "Terjadi kesalahan saat menganalisis."; }
    }

    decomposeButton.onclick = async function () {
        const user = auth.currentUser;
        if (!user) return; 

        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();
        const userData = doc.data();

        if (userData.credits <= 0) {
            alert("Kredit analisis Anda sudah habis. Silakan upgrade ke paket berbayar.");
            return;
        }

        const text = articleText.value;
        if (!text.trim()) { alert("Harap masukkan teks jurnal."); return; }

        loadingIndicator.style.display = 'block';
        dashboard.innerHTML = '';
        decomposeButton.disabled = true;
        decomposeButton.innerText = 'MENGANALISIS...';
        
        const base_prompt = `Berdasarkan teks berikut:\n---\n${text.substring(0, 30000)}\n---\n\n`;
        const prompts = {
            petaArgumen: callGemini(base_prompt + "Analisis dan buat Peta Argumen dari teks ini (Tesis Utama, Argumen Pendukung, Bukti)."),
            rontgenMetodologi: callGemini(base_prompt + "Fokus HANYA pada metodologi. Ekstrak Desain Penelitian, Sampel, dan Teknik Pengumpulan Data."),
            pemicuKritis: callGemini(base_prompt + "Bertindak sebagai penguji ahli, ajukan 3 pertanyaan kritis tentang kelemahan penelitian ini.")
        };

        try {
            const results = await Promise.all(Object.values(prompts));
            const [petaArgumen, rontgenMetodologi, pemicuKritis] = results;

            dashboard.innerHTML = `
                <div class="module"><h2>Peta Argumen</h2><p>${petaArgumen.replace(/\n/g, '<br>')}</p></div>
                <div class="module"><h2>Rontgen Metodologi</h2><p>${rontgenMetodologi.replace(/\n/g, '<br>')}</p></div>
                <div class="module"><h2>Pemicu Pemikiran Kritis</h2><p>${pemicuKritis.replace(/\n/g, '<br>')}</p></div>
            `;

            const newCredits = userData.credits - 1;
            await userRef.update({
                credits: newCredits
            });
            userInfo.innerText = `Halo, ${userData.name} | Sisa Kredit: ${newCredits}`;

        } catch (error) {
            console.error("Decomposition Error:", error);
            alert("Terjadi kesalahan saat menganalisis. Silakan coba lagi.");
        } finally {
            loadingIndicator.style.display = 'none';
            decomposeButton.disabled = false;
            decomposeButton.innerText = 'DECOMPOSE';
        }
    };
});