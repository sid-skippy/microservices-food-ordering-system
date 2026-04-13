const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// CONNECT TO order_db
mongoose.connect("mongodb://127.0.0.1:27017/order_db")
.then(() => console.log("Connected to Order DB"))
.catch(err => console.log(err));

// ORDER SCHEMA
const orderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    restaurant_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    order_date: { type: Date, default: Date.now },
    delivery_address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    total_amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
        required: true
    },
    delivery_partner_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    estimated_delivery_time: { type: Date }
});

const Order = mongoose.model("Order", orderSchema);

// ORDER ITEM SCHEMA (FIXED: Explicitly set collection name)
const orderItemSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    menu_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price_at_order: { type: mongoose.Schema.Types.Decimal128, required: true },
    special_instructions: { type: String, default: null }
}, { collection: 'order_items' }); // <--- THIS FIXES THE MISSING ITEMS

const OrderItem = mongoose.model("OrderItem", orderItemSchema);

// CREATE ORDER (POST/orders)
app.post("/orders", async (req, res) => {
    try {
        const orderData = {
            ...req.body,
            total_amount: mongoose.Types.Decimal128.fromString(req.body.total_amount)
        };
        const newOrder = new Order(orderData);
        await newOrder.save();
        res.json({ message: "Order created", data: newOrder });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET ALL ORDERS (GET/orders)
app.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE ORDER STATUS (PUT/orders)
app.put("/orders/:id", async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
        res.json({ message: "Order status updated", data: updatedOrder });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//DELETE /order
app.delete("/orders/:id", async (req, res) => {
    try {
        const deleted = await Order.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Order not found" });
        res.json({ message: "Order deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE ORDER ITEM (POST/order_items)
app.post("/order_items", async (req, res) => {
    try {
        const itemData = {
            ...req.body,
            price_at_order: mongoose.Types.Decimal128.fromString(req.body.price_at_order)
        };
        const newItem = new OrderItem(itemData);
        await newItem.save();
        res.json({ message: "Order item added", data: newItem });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET ALL ORDER ITEMS (GET/order_items)
app.get("/order_items", async (req, res) => {
    try {
        const items = await OrderItem.find();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//START SERVER
app.listen(3002, () => {
    console.log("Order service running on port 3002");
});