// --- Configuration ---
// If you host the backend separately, replace the URL below with your production backend URL
// Example: var API_BASE = 'https://lumina-backend.onrender.com/api';
var API_BASE = window.API_BASE || (window.location.origin.includes('localhost') ? 'http://localhost:3000/api' : `${window.location.origin}/api`);
window.API_BASE = API_BASE;

// --- Cookie Helpers ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/';
}

let currentLang = getCookie('lang') || 'en';
let currentTheme = getCookie('theme') || 'dark';
let currentUser = null;

// Initialize App
async function initApp() {
    const userId = getCookie('userId');
    if (userId) {
        try {
            const response = await fetch(`${API_BASE}/auth/profile?id=${userId}`);
            if (response.ok) {
                currentUser = await response.json();
                updateUserArea();
            } else {
                eraseCookie('userId');
            }
        } catch (err) {
            console.error('Init Auth Error:', err);
        }
    }
    
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        renderHomeProducts();
        renderAIProducts();
    }
    
    if (window.lucide) lucide.createIcons();
}

function updateUserArea() {
    const navUserArea = document.getElementById('nav-user-area');
    if (!navUserArea) return;

    if (currentUser) {
        const photoUrl = currentUser.photo ? (currentUser.photo.startsWith('http') ? currentUser.photo : `${API_BASE.replace('/api', '')}${currentUser.photo}`) : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100';
        const dashboardLink = currentUser.role === 'designer' ? 'designer-portal.html' : 'customer-dashboard.html';

        navUserArea.innerHTML = `
            <a href="${dashboardLink}" class="flex items-center gap-3 glass px-4 py-2 rounded-full border-white/10 hover:border-primary-cyan transition-all">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-cyan to-primary-magenta p-px overflow-hidden">
                    <img src="${photoUrl}" class="w-full h-full rounded-full object-cover border-2 border-dark-bg" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'">
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest text-white hidden sm:block">${currentUser.username}</span>
            </a>
        `;
    }
}

async function renderHomeProducts() {
    const grid = document.getElementById('designer-products-grid');
    if (!grid) return;

    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    const mainProducts = products.filter(p => !p.isAI);

    grid.innerHTML = mainProducts.map(p => `
        <div class="glass p-4 rounded-[2.5rem] border-white/5 hover:border-primary-cyan/30 transition-all group relative overflow-hidden">
            <a href="product-detail.html?id=${p.id}" class="block">
                <div class="aspect-square rounded-[2rem] overflow-hidden mb-6 relative">
                    <img src="${API_BASE.replace('/api', '')}${p.img}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">
                </div>
                <div class="space-y-2">
                    <div class="flex justify-between items-start">
                        <h3 class="text-sm font-black text-white uppercase tracking-tighter">${p.name}</h3>
                        <span class="text-primary-cyan text-xs font-black">$${p.price}</span>
                    </div>
                    <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest">${p.architect}</p>
                </div>
            </a>
            <div class="mt-6">
                <button onclick="addToCart('${p.id}', '${p.name}', '${p.price}', '${p.img}', '${p.architect}')" class="w-full bg-white text-black py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-cyan transition-all">Add to Cart</button>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

async function renderAIProducts() {
    const grid = document.getElementById('ai-products-grid');
    if (!grid) return;

    const res = await fetch(`${API_BASE}/ai/products`);
    const products = await res.json();

    grid.innerHTML = products.map(p => `
        <div class="glass p-4 rounded-[2.5rem] border-white/5 hover:border-primary-cyan/30 transition-all group relative overflow-hidden">
            <div class="absolute top-4 right-4 z-10 bg-primary-cyan/20 backdrop-blur-md text-primary-cyan px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-primary-cyan/30">AI GENERATED</div>
            <a href="product-detail.html?id=${p.id}" class="block">
                <div class="aspect-square rounded-[2rem] overflow-hidden mb-6 relative">
                    <img src="${p.img}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">
                </div>
                <div class="space-y-2">
                    <div class="flex justify-between items-start">
                        <h3 class="text-sm font-black text-white uppercase tracking-tighter">${p.name}</h3>
                        <span class="text-primary-cyan text-xs font-black">$${p.price}</span>
                    </div>
                    <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest">${p.architect}</p>
                </div>
            </a>
            <div class="mt-6">
                <button onclick="addToCart('${p.id}', '${p.name}', '${p.price}', '${p.img}', '${p.architect}')" class="w-full bg-white text-black py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-cyan transition-all">Acquire Masterpiece</button>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

async function addToCart(id, name, price, img, architect) {
    if (!currentUser) {
        showToast('Please login to add to cart', 'error');
        window.location.href = 'login.html';
        return;
    }

    const res = await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_email: currentUser.email,
            product_id: id,
            name, price, img, architect,
            quantity: 1
        })
    });

    if (res.ok) {
        showToast('Added to cart!');
    }
}

function showToast(message, type = 'success') {
    alert(message); // Simple fallback for now
}

function logout() {
    eraseCookie('userId');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', initApp);
