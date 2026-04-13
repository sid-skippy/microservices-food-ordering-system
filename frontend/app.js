// Service URLs
const USER_API = "http://localhost:3000";
const RESTAURANT_API = "http://localhost:3001";
const ORDER_API = "http://localhost:3002";
const PAYMENT_API = "http://localhost:3003";

// State
let currentUser = null;
let systemRoles = [];
let currentRestaurantId = null;
let cart = [];
let menuItemsCache = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await fetchRoles();
    const savedUser = localStorage.getItem('indicrave_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateNav();
        routeUserByRole();
    }
});

// --- CORE UTILITIES ---
async function fetchRoles() {
    try {
        const res = await fetch(`${USER_API}/roles`);
        systemRoles = await res.json();
    } catch (err) {
        console.error("Failed to fetch roles. Is Port 3000 running?", err);
    }
}

function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function updateNav() {
    const navLinks = document.getElementById('nav-links');
    if (currentUser) {
        let navHtml = `<span>Welcome, <b>${currentUser.full_name}</b> (${currentUser.roleName})</span>`;
        if (currentUser.roleName === 'customer') {
            navHtml += `<button style="width:auto; padding:0.4rem 1rem; margin-left:1rem; background-color:#1976D2;" onclick="loadMyOrders()">My Orders</button>`;
            navHtml += `<button style="width:auto; padding:0.4rem 1rem; margin-left:0.5rem; background-color:#333;" onclick="loadProfile()">Profile</button>`;
            navHtml += `<button style="width:auto; padding:0.4rem 1rem; margin-left:0.5rem;" onclick="loadRestaurants()">Home</button>`;
        }
        navHtml += `<button style="width:auto; padding:0.4rem 1rem; margin-left:0.5rem;" onclick="logout()">Logout</button>`;
        navLinks.innerHTML = navHtml;
    } else {
        navLinks.innerHTML = ``;
    }
}

function parseDecimal(mongoDecimalObj) {
    return mongoDecimalObj && mongoDecimalObj.$numberDecimal ? 
           parseFloat(mongoDecimalObj.$numberDecimal) : parseFloat(mongoDecimalObj);
}

function routeUserByRole() {
    if (!currentUser) return showView('auth-section');

    switch(currentUser.roleName) {
        case 'customer':
            checkCustomerProfileCompletion();
            break;
        case 'restaurant_owner':
            loadOwnerDashboard();
            break;
        case 'delivery_partner':
            loadDeliveryDashboard();
            break;
        case 'admin':
            alert("Admin dashboard not implemented in this demo.");
            break;
        default:
            showView('auth-section');
    }
}

// --- AUTHENTICATION ---
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    try {
        if (systemRoles.length === 0) await fetchRoles();

        const res = await fetch(`${USER_API}/users`);
        const users = await res.json();
        let user = users.find(u => u.email === email);
        
        if (user) {
            const userRole = systemRoles.find(r => r._id === user.role_id);
            user.roleName = userRole ? userRole.role_name : 'customer';

            currentUser = user;
            localStorage.setItem('indicrave_user', JSON.stringify(user));
            updateNav();
            routeUserByRole();
        } else {
            alert("User not found. Please register.");
        }
    } catch (err) {
        console.error(err);
        alert("Failed to connect to User Service (Port 3000). Is it running?");
    }
}

async function handleRegister() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;

    if (!name || !email || !phone) return alert("Please fill in your Name, Email, and Phone.");

    try {
        if (systemRoles.length === 0) await fetchRoles();
        const customerRole = systemRoles.find(r => r.role_name === 'customer');

        if (!customerRole) return alert("Error: 'customer' role not found. Ensure DB is seeded.");

        const newUser = {
            full_name: name,
            email: email,
            phone: phone,
            password_hash: "mock_hash_for_demo", 
            role_id: customerRole._id
        };

        const res = await fetch(`${USER_API}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });

        const data = await res.json();
        
        if (res.ok && data.data) {
            alert("Registration successful! Please login.");
            document.querySelectorAll('#auth-section input').forEach(input => input.value = '');
        } else {
            alert("Registration failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        console.error(err);
        alert("Failed to connect. Make sure your User Service is running.");
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('indicrave_user');
    updateNav();
    showView('auth-section');
}

// --- PROFILE LOGIC ---
function checkCustomerProfileCompletion() {
    if (!currentUser.address || !currentUser.address.street) {
        alert("Please provide your delivery address before ordering.");
        loadProfile();
        document.getElementById('btn-cancel-profile').style.display = 'none';
    } else {
        loadRestaurants();
    }
}

function loadProfile() {
    if (currentUser.address) {
        document.getElementById('prof-street').value = currentUser.address.street || "";
        document.getElementById('prof-city').value = currentUser.address.city || "";
        document.getElementById('prof-state').value = currentUser.address.state || "";
        document.getElementById('prof-pincode').value = currentUser.address.pincode || "";
        document.getElementById('btn-cancel-profile').style.display = 'inline-block';
    } else {
        document.getElementById('btn-cancel-profile').style.display = 'none';
    }
    showView('profile-section');
}

async function saveProfile() {
    const street = document.getElementById('prof-street').value;
    const city = document.getElementById('prof-city').value;
    const state = document.getElementById('prof-state').value;
    const pincode = document.getElementById('prof-pincode').value;

    if (!street || !city || !state || !pincode) return alert("Please fill out all address fields.");

    try {
        const addressData = { address: { street, city, state, pincode } };

        const res = await fetch(`${USER_API}/users/${currentUser._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(addressData)
        });

        if (res.ok) {
            const updatedData = await res.json();
            currentUser.address = updatedData.data.address; 
            localStorage.setItem('indicrave_user', JSON.stringify(currentUser));
            alert("Profile saved successfully!");
            routeUserByRole(); 
        } else {
            const errData = await res.json();
            alert("Failed to update profile: " + (errData.error || errData.message));
        }
    } catch (err) {
        console.error(err);
        alert("Network Error: Ensure User Service is running.");
    }
}

// ==========================================
// ROLE: CUSTOMER FLOW (RESTAURANTS, MENU, CART, ORDERS)
// ==========================================

async function loadRestaurants() {
    try {
        const res = await fetch(`${RESTAURANT_API}/restaurants`);
        const restaurants = await res.json();
        
        const grid = document.getElementById('restaurants-grid');
        grid.innerHTML = restaurants.map(r => `
            <div class="card">
                <h3>${r.restaurant_name}</h3>
                <p>Cuisine: ${r.cuisine_type || 'Various'}</p>
                <p>Rating: ⭐ ${r.rating || 'N/A'}</p>
                <p>Hours: ${r.opening_hours || 'Not specified'}</p>
                <button onclick="loadMenu('${r._id}', '${r.restaurant_name}')">View Menu</button>
            </div>
        `).join('');
        
        showView('restaurants-section');
    } catch (err) {
        console.error(err);
    }
}

async function loadMenu(restaurantId, restaurantName) {
    currentRestaurantId = restaurantId;
    document.getElementById('current-restaurant-name').innerText = `${restaurantName} - Menu`;
    cart = []; 
    updateCartUI();

    try {
        const res = await fetch(`${RESTAURANT_API}/menus`);
        const allMenus = await res.json();
        menuItemsCache = allMenus.filter(m => m.restaurant_id === restaurantId);

        const grid = document.getElementById('menu-grid');
        grid.innerHTML = menuItemsCache.map(m => `
            <div class="card">
                <h4>${m.item_name}</h4>
                <p style="font-size: 0.9em; color: #666; margin-top: -10px;">${m.description || ''}</p>
                <p style="font-size: 0.9em;">${m.category} | ${m.is_vegetarian ? '🟢 Veg' : '🔴 Non-Veg'} | ⏳ ${m.preparation_time || '--'} mins</p>
                <p><b>₹${parseDecimal(m.price).toFixed(2)}</b></p>
                <button onclick="addToCart('${m._id}')">Add to Cart</button>
            </div>
        `).join('');

        showView('menu-section');
    } catch (err) {
        console.error(err);
    }
}

function addToCart(menuId) {
    const item = menuItemsCache.find(m => m._id === menuId);
    const existingItem = cart.find(c => c._id === menuId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1, special_instructions: "" });
    }
    updateCartUI();
}

function updateInstruction(menuId, value) {
    const item = cart.find(c => c._id === menuId);
    if (item) item.special_instructions = value;
}

function updateCartUI() {
    const cartDiv = document.getElementById('cart-items');
    const totalSpan = document.getElementById('cart-total-amount');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (cart.length === 0) {
        cartDiv.innerHTML = "<p>Cart is empty</p>";
        totalSpan.innerText = "0.00";
        checkoutBtn.disabled = true;
        return;
    }

    checkoutBtn.disabled = false;
    let totalAmount = 0;
    
    cartDiv.innerHTML = cart.map(item => {
        const itemTotal = parseDecimal(item.price) * item.quantity;
        totalAmount += itemTotal;
        return `
            <div class="cart-item" style="flex-direction: column; gap: 5px;">
                <div style="display: flex; justify-content: space-between;">
                    <b>${item.item_name} (x${item.quantity})</b>
                    <span>₹${itemTotal.toFixed(2)}</span>
                </div>
                <input type="text" 
                       placeholder="Special instructions (e.g., extra cheese)" 
                       style="width: 90%; padding: 4px; font-size: 0.8rem; margin:0;"
                       value="${item.special_instructions}"
                       onchange="updateInstruction('${item._id}', this.value)">
            </div>
        `;
    }).join('');

    totalSpan.innerText = totalAmount.toFixed(2);
}

async function processCheckout() {
    if (!currentUser.address || !currentUser.address.street) return checkCustomerProfileCompletion();

    document.getElementById('checkout-btn').disabled = true;
    document.getElementById('checkout-btn').innerText = "Processing...";
    let totalAmount = cart.reduce((sum, item) => sum + (parseDecimal(item.price) * item.quantity), 0);

    try {
        const estimatedTime = new Date(Date.now() + 45 * 60000);

        // 1. Create Order 
        const orderData = {
            user_id: currentUser._id,
            restaurant_id: currentRestaurantId,
            total_amount: totalAmount.toString(),
            status: "pending",
            delivery_address: currentUser.address, 
            estimated_delivery_time: estimatedTime.toISOString()
        };

        const orderRes = await fetch(`${ORDER_API}/orders`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData)
        });
        const createdOrder = await orderRes.json();
        if (!orderRes.ok) throw new Error(createdOrder.error || "Failed to create order");
        const orderId = createdOrder.data._id;

        // 2. Add Order Items 
        for (const item of cart) {
            const itemRes = await fetch(`${ORDER_API}/order_items`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId, 
                    menu_id: item._id, 
                    quantity: item.quantity,
                    price_at_order: parseDecimal(item.price).toString(),
                    special_instructions: item.special_instructions ? item.special_instructions : null
                })
            });
            if (!itemRes.ok) {
                const itemErr = await itemRes.json();
                throw new Error(`Failed to add ${item.item_name} to order: ${itemErr.error}`);
            }
        }

        // 3. Process Payment 
        const paymentRes = await fetch(`${PAYMENT_API}/payments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: orderId, user_id: currentUser._id, amount: totalAmount.toString(),
                payment_method: "UPI", payment_status: "completed", transaction_id: "TXN" + Date.now() 
            })
        });
        if (!paymentRes.ok) {
            const paymentError = await paymentRes.json();
            throw new Error(`Payment failed: ${paymentError.error}`);
        }

        // 4. Confirm Order
        await fetch(`${ORDER_API}/orders/${orderId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: "confirmed" })
        });

        showView('success-section');
        document.getElementById('checkout-btn').innerText = "Proceed to Pay";
        
    } catch (err) {
        console.error(err);
        alert("Transaction failed: " + err.message);
        document.getElementById('checkout-btn').disabled = false;
        document.getElementById('checkout-btn').innerText = "Proceed to Pay";
    }
}

// --- MY ORDERS & REVIEWS ---
async function loadMyOrders() {
    try {
        const resOrders = await fetch(`${ORDER_API}/orders`);
        const allOrders = await resOrders.json();
        const myOrders = allOrders.filter(o => o.user_id === currentUser._id);

        const resRest = await fetch(`${RESTAURANT_API}/restaurants`);
        const allRestaurants = await resRest.json();

        const resReviews = await fetch(`${RESTAURANT_API}/reviews`);
        const allReviews = await resReviews.json();

        const resOrderItems = await fetch(`${ORDER_API}/order_items`);
        const allOrderItems = await resOrderItems.json();

        const resMenus = await fetch(`${RESTAURANT_API}/menus`);
        const allMenus = await resMenus.json();

        const container = document.getElementById('my-orders-container');
        
        if (myOrders.length === 0) {
            container.innerHTML = "<p style='grid-column: 1 / -1;'>You haven't placed any orders yet.</p>";
        } else {
            // Sort by newest first
            myOrders.sort((a,b) => new Date(b.order_date) - new Date(a.order_date));

            container.innerHTML = myOrders.map(order => {
                const rest = allRestaurants.find(r => r._id === order.restaurant_id);
                const restName = rest ? rest.restaurant_name : "Unknown Restaurant";
                const hasReviewed = allReviews.some(rev => rev.order_id === order._id);
                
                const itemsForThisOrder = allOrderItems.filter(item => item.order_id === order._id);
                
                const itemsHtml = itemsForThisOrder.map(item => {
                    const menuInfo = allMenus.find(m => m._id === item.menu_id);
                    const itemName = menuInfo ? menuInfo.item_name : "Unknown Item";
                    const instructions = item.special_instructions 
                                         ? `<br><small style="color: #666;">Note: ${item.special_instructions}</small>` 
                                         : "";
                    return `<li style="margin-bottom: 6px;">${itemName} <b>(x${item.quantity})</b>${instructions}</li>`;
                }).join('');

                const addr = order.delivery_address || {};
                const addressHtml = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');

                let actionHtml = '';
                if (order.status === 'delivered' && !hasReviewed) {
                    actionHtml = `<button onclick="openReviewModal('${order._id}', '${order.restaurant_id}')" style="margin-top: 15px; background-color: #1976D2;">Leave a Review</button>`;
                } else if (hasReviewed) {
                    actionHtml = `<p style="color: #2e7d32; font-weight: bold; margin-top: 15px;">✓ Reviewed</p>`;
                }

                return `
                    <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 style="margin-top: 0; margin-bottom: 5px; color: var(--primary);">${restName}</h3>
                            <p style="font-size: 0.8em; color: #888; margin-top: 0;">Order ID: ...${order._id.slice(-6)}</p>
                            
                            <div style="background: var(--bg-color); padding: 10px; border-radius: 6px; margin: 15px 0;">
                                <h4 style="margin: 0 0 8px 0; font-size: 0.95em;">Items Ordered</h4>
                                <ul style="margin: 0; padding-left: 20px; font-size: 0.9em; line-height: 1.4;">
                                    ${itemsHtml || '<li>No items found</li>'}
                                </ul>
                            </div>

                            <div style="font-size: 0.9em; line-height: 1.6;">
                                <p style="margin: 5px 0;"><b>Delivery To:</b><br> ${addressHtml || 'No address provided'}</p>
                                <p style="margin: 5px 0;"><b>Date:</b> ${new Date(order.order_date).toLocaleString()}</p>
                                <p style="margin: 5px 0; font-size: 1.1em;"><b>Total:</b> ₹${parseDecimal(order.total_amount).toFixed(2)}</p>
                            </div>
                        </div>

                        <div>
                            <p style="margin-top: 15px;"><b>Status:</b> <span class="status-badge status-${order.status}">${order.status}</span></p>
                            ${actionHtml}
                        </div>
                    </div>
                `;
            }).join('');
        }
        showView('my-orders-section');
    } catch(err) {
        console.error(err);
        alert("Failed to load past orders.");
    }
}

function openReviewModal(orderId, restaurantId) {
    document.getElementById('review-order-id').value = orderId;
    document.getElementById('review-restaurant-id').value = restaurantId;
    document.getElementById('review-rating').value = 5;
    document.getElementById('review-comment').value = '';
    document.getElementById('review-modal').style.display = 'flex';
}

function closeReviewModal() {
    document.getElementById('review-modal').style.display = 'none';
}

async function submitReview() {
    const orderId = document.getElementById('review-order-id').value;
    const restaurantId = document.getElementById('review-restaurant-id').value;
    const rating = parseInt(document.getElementById('review-rating').value);
    const comment = document.getElementById('review-comment').value;

    if (rating < 1 || rating > 5) return alert("Rating must be between 1 and 5.");

    try {
        const res = await fetch(`${RESTAURANT_API}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser._id,
                restaurant_id: restaurantId,
                order_id: orderId,
                rating: rating,
                comment: comment
            })
        });

        if (res.ok) {
            alert("Thank you! Your review has been submitted.");
            closeReviewModal();
            loadMyOrders(); 
        } else {
            const err = await res.json();
            alert("Failed to submit review: " + (err.error || err.message));
        }
    } catch(err) {
        console.error(err);
        alert("Network error submitting review.");
    }
}

// ==========================================
// ROLE: RESTAURANT OWNER FLOW
// ==========================================

async function loadOwnerDashboard() {
    showView('owner-section');
    const container = document.getElementById('owner-orders-container');
    
    try {
        const resRest = await fetch(`${RESTAURANT_API}/restaurants`);
        const allRestaurants = await resRest.json();
        const myRestaurants = allRestaurants.filter(r => r.owner_id === currentUser._id);
        const myRestaurantIds = myRestaurants.map(r => r._id);

        if (myRestaurantIds.length === 0) {
            return container.innerHTML = "<p>You don't have any restaurants registered yet.</p>";
        }

        const resOrders = await fetch(`${ORDER_API}/orders`);
        const allOrders = await resOrders.json();
        
        const activeOrders = allOrders.filter(o => 
            myRestaurantIds.includes(o.restaurant_id) && 
            o.status !== 'delivered' && o.status !== 'cancelled'
        );

        if (activeOrders.length === 0) {
            return container.innerHTML = "<p>No active orders right now.</p>";
        }

        container.innerHTML = `
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${activeOrders.map(order => `
                        <tr>
                            <td>...${order._id.slice(-6)}</td>
                            <td>₹${parseDecimal(order.total_amount).toFixed(2)}</td>
                            <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                            <td>
                                <select id="status-owner-${order._id}" style="width: auto; margin:0; padding: 4px;">
                                    <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                                    <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
                                </select>
                                <button onclick="updateOrderStatus('${order._id}', 'owner')" style="width: auto; padding: 4px 10px;">Save</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading dashboard. Ensure backend services are running.</p>";
    }
}

// ==========================================
// ROLE: DELIVERY PARTNER FLOW
// ==========================================

async function loadDeliveryDashboard() {
    showView('delivery-section');
    const container = document.getElementById('delivery-orders-container');
    
    try {
        const resOrders = await fetch(`${ORDER_API}/orders`);
        const allOrders = await resOrders.json();
        
        const deliveryOrders = allOrders.filter(o => 
            o.status === 'out_for_delivery' || o.status === 'preparing'
        );

        if (deliveryOrders.length === 0) {
            return container.innerHTML = "<p>No orders currently available for delivery.</p>";
        }

        container.innerHTML = `
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${deliveryOrders.map(order => `
                        <tr>
                            <td>${order.delivery_address?.street}, ${order.delivery_address?.city}</td>
                            <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                            <td>
                                <select id="status-delivery-${order._id}" style="width: auto; margin:0; padding: 4px;">
                                    <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Pick Up</option>
                                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Mark Delivered</option>
                                </select>
                                <button onclick="updateOrderStatus('${order._id}', 'delivery')" style="width: auto; padding: 4px 10px;">Update</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading dashboard. Ensure backend services are running.</p>";
    }
}

// --- SHARED: Update Order Status API Call ---
async function updateOrderStatus(orderId, roleContext) {
    // FIX: Grab the namespaced ID based on which dashboard the user is clicking from
    const newStatus = document.getElementById(`status-${roleContext}-${orderId}`).value;
    
    try {
        const res = await fetch(`${ORDER_API}/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res.ok) {
            alert("Order status updated!");
            if (roleContext === 'owner') loadOwnerDashboard();
            if (roleContext === 'delivery') loadDeliveryDashboard();
        } else {
            alert("Failed to update status.");
        }
    } catch (err) {
        console.error(err);
        alert("Error connecting to Order Service.");
    }
}