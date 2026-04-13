const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/payment_db")
.then(() => console.log("Connected to Payment DB"))
.catch(err => console.log(err));

//PAYMENT SCHEMA
const paymentSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
    },
    payment_method: {
        type: String,
        enum: ["credit_card", "debit_card", "UPI", "wallet", "COD"],
        required: true
    },
    payment_status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        required: true
    },
    transaction_id: {
        type: String,
        unique: true,
        sparse: true
    },
    payment_date: {
        type: Date,
        default: Date.now
    }
});

//PAYMENT MODEL
const Payment = mongoose.model("Payment", paymentSchema);

//POST /payments
app.post("/payments", async (req, res) => {
    try {
        const paymentData = {
            ...req.body,
            amount: mongoose.Types.Decimal128.fromString(req.body.amount)
        };

        const payment = new Payment(paymentData);
        await payment.save();
        res.json({ message: "Payment recorded", data: payment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /payments
app.get("/payments", async (req, res) => {
    try {
        const payments = await Payment.find();
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /payments/:id (Update status)
app.put("/payments/:id", async (req, res) => {
    try {
        const updated = await Payment.findByIdAndUpdate(
            req.params.id,
            { payment_status: req.body.payment_status },
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /payments/:id
app.delete("/payments/:id", async (req, res) => {
    try {
        await Payment.findByIdAndDelete(req.params.id);
        res.json({ message: "Payment deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// START SERVER
app.listen(3003, () => {
    console.log("Payment service running on port 3003");
});