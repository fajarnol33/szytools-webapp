// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyDApOKwNr5duAoviez8Sx1JyN4Idi68Bso",
    authDomain: "szytools-app.firebaseapp.com",
    projectId: "szytools-app",
    storageBucket: "szytools-app.firebasestorage.app",
    messagingSenderId: "903429769954",
    appId: "1:903429769954:web:8f9c2700ee36dd78b0acbb",
    measurementId: "G-SD5T7C75R7"
};
const GEMINI_API_KEY = "AIzaSyCUlwZVtmCSO96jhVwjkSkI4uZcH5tBYRU";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', function () {
    const loader = document.getElementById('loader');
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const userInfo = document.getElementById('user-info');
    const decomposeButton = document.getElementById('decompose-button');
    const articleText = document.getElementById('article-text');
    const dashboard = document.getElementById('dashboard');
    const loadingIndicator = document.getElementById('loading-indicator');

    loginButton.onclick = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider);
    };

    logoutButton.onclick = () => {
        auth.signOut();
    };

    auth.onAuthStateChanged(async (user) => {
        // Apapun statusnya, sembunyikan layar tunggu
        loader.style.display = 'none';

        if (user) {
            // JIKA PENGGUNA SUDAH LOGIN:
            appContainer.classList.remove('initial-hidden');
            loginContainer.classList.add('initial-hidden');
            
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();
            if (!doc.exists) {
                await userRef.set({ email: user.email, name: user.displayName, credits: 10 });
                userInfo.innerText = `Halo, ${user.displayName} | Sisa Kredit: 10`;
            } else {
                const userData = doc.data();
                userInfo.innerText = `Halo, ${userData.name} | Sisa Kredit: ${userData.credits}`;
            }
        } else {
            // JIKA PENGGUNA TIDAK LOGIN:
            loginContainer.classList.remove('initial-hidden');
            appContainer.classList.add('initial-hidden');
        }
    });

    // (Sisa kode decomposeButton.onclick tetap sama seperti sebelumnya)
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
        if(!doc.exists) return;
        const userData = doc.data();
        if (userData.credits <= 0) { alert("Kredit analisis Anda sudah habis."); return; }
        const text = articleText.value;
        if (!text.trim()) { alert("Harap masukkan teks jurnal."); return; }
        loadingIndicator.style.display = 'block';
        dashboard.innerHTML = '';
        decomposeButton.disabled = true;
        decomposeButton.innerText = 'MENGANALISIS...';
        const base_prompt = `Berdasarkan teks berikut:\n---\n${text.substring(0, 30000)}\n---\n\n`;
        const prompts = {
            petaArgumen: callGemini(base_prompt + "Analisis dan buat Peta Argumen dari teks ini (Tesis Utama, Argumen Pendukung, Bukti). Format jawabanmu menggunakan Markdown untuk bold dan list."),
            rontgenMetodologi: callGemini(base_prompt + "Fokus HANYA pada metodologi. Ekstrak Desain Penelitian, Sampel, dan Teknik Pengumpulan Data. Format jawabanmu menggunakan Markdown."),
            pemicuKritis: callGemini(base_prompt + "Bertindak sebagai penguji ahli, ajukan 3 pertanyaan kritis tentang kelemahan penelitian ini dalam bentuk numbered list Markdown.")
        };
        try {
            const results = await Promise.all(Object.values(prompts));
            const [petaArgumen, rontgenMetodologi, pemicuKritis] = results;
            dashboard.innerHTML = `<div class="module"><h2>Peta Argumen</h2><div>${marked.parse(petaArgumen)}</div></div><div class="module"><h2>Rontgen Metodologi</h2><div>${marked.parse(rontgenMetodologi)}</div></div><div class="module"><h2>Pemicu Pemikiran Kritis</h2><div>${marked.parse(pemicuKritis)}</div></div>`;
            const newCredits = userData.credits - 1;
            await userRef.update({ credits: newCredits });
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