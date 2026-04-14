const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

function decimalToNumber(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "number") return value;
    if (typeof value === "string") return parseFloat(value) || fallback;
    if (value.$numberDecimal) return parseFloat(value.$numberDecimal) || fallback;
    const parsed = parseFloat(value.toString());
    return Number.isFinite(parsed) ? parsed : fallback;
}

mongoose.connect("mongodb://127.0.0.1:27017/payment_db")
.then(() => console.log("✅ Connected to Payment DB"))
.catch(err => console.log("❌ Payment DB Error:", err));

// PAYMENT SCHEMA (Enhanced)
const paymentSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
    },
    payment_method: {
        type: String,
        enum: ["credit_card", "debit_card", "UPI", "wallet", "COD", "net_banking"],
        required: true
    },
    payment_status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed", "refunded", "partially_refunded"],
        default: "pending",
        index: true
    },
    transaction_id: {
        type: String,
        unique: true,
        sparse: true
    },
    payment_date: {
        type: Date,
        default: Date.now
    },
    payment_gateway: {
        type: String,
        enum: ["stripe", "razorpay", "paytm", "phonepe", "gpay", "manual"],
        default: "manual"
    },
    gateway_response: {
        type: mongoose.Schema.Types.Mixed
    },
    refund_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0
    },
    refund_date: {
        type: Date
    },
    refund_reason: {
        type: String
    },
    refund_transaction_id: {
        type: String
    },
    failure_reason: {
        type: String
    },
    retry_count: {
        type: Number,
        default: 0
    }
});

// Generate transaction ID before saving
paymentSchema.pre('save', function() {
    if (this.isNew && !this.transaction_id && this.payment_status === 'completed') {
        this.transaction_id = `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    }
});

const Payment = mongoose.model("Payment", paymentSchema);

// Test Route
app.get("/", (req, res) => {
    res.json({ success: true, message: "Payment Service is running", port: 3003 });
});

// ========== PAYMENT ROUTES ==========

// CREATE PAYMENT
app.post("/payments", async (req, res) => {
    try {
        const { amount, ...rest } = req.body;

        // Check if payment already exists for this order
        const existingPayment = await Payment.findOne({ order_id: req.body.order_id });
        if (existingPayment) {
            return res.status(400).json({ 
                success: false, 
                error: "Payment already exists for this order" 
            });
        }

        const paymentData = {
            ...rest,
            amount: mongoose.Types.Decimal128.fromString(amount.toString())
        };

        // Generate transaction ID for completed payments
        if (paymentData.payment_status === 'completed') {
            paymentData.transaction_id = `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        }

        const payment = new Payment(paymentData);
        await payment.save();
        
        res.status(201).json({ success: true, message: "Payment recorded", data: payment });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                error: "Payment already exists for this order" 
            });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});

// PROCESS PAYMENT (Simulated payment processing)
app.post("/payments/process", async (req, res) => {
    try {
        const { order_id, user_id, amount, payment_method, payment_gateway = "manual" } = req.body;

        if (!order_id || !user_id || !amount || !payment_method) {
            return res.status(400).json({ 
                success: false, 
                error: "Missing required fields" 
            });
        }

        // Check if payment already exists
        let payment = await Payment.findOne({ order_id });
        
        if (payment) {
            // If payment failed before, allow retry
            if (payment.payment_status === 'failed') {
                payment.retry_count += 1;
                payment.payment_status = 'processing';
            } else if (payment.payment_status === 'completed') {
                return res.status(400).json({ 
                    success: false, 
                    error: "Payment already completed for this order" 
                });
            }
        } else {
            // Create new payment
            payment = new Payment({
                order_id,
                user_id,
                amount: mongoose.Types.Decimal128.fromString(amount.toString()),
                payment_method,
                payment_gateway,
                payment_status: 'processing'
            });
        }

        // Simulate payment processing (90% success rate)
        const isSuccess = Math.random() > 0.1;

        if (isSuccess) {
            payment.payment_status = 'completed';
            payment.transaction_id = `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            payment.gateway_response = {
                status: 'success',
                message: 'Payment processed successfully',
                timestamp: new Date()
            };
        } else {
            payment.payment_status = 'failed';
            payment.failure_reason = 'Insufficient funds / Gateway error';
            payment.gateway_response = {
                status: 'failed',
                message: 'Payment processing failed',
                timestamp: new Date()
            };
        }

        await payment.save();

        res.json({ 
            success: isSuccess, 
            message: isSuccess ? "Payment successful" : "Payment failed",
            data: payment 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET ALL PAYMENTS (with filters)
app.get("/payments", async (req, res) => {
    try {
        const { user_id, order_id, status, payment_method, from_date, to_date } = req.query;
        let filter = {};
        
        if (user_id) filter.user_id = user_id;
        if (order_id) filter.order_id = order_id;
        if (status) filter.payment_status = status;
        if (payment_method) filter.payment_method = payment_method;
        
        if (from_date || to_date) {
            filter.payment_date = {};
            if (from_date) filter.payment_date.$gte = new Date(from_date);
            if (to_date) filter.payment_date.$lte = new Date(to_date);
        }

        const payments = await Payment.find(filter).sort({ payment_date: -1 });
        res.json({ success: true, count: payments.length, data: payments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET PAYMENT BY ID
app.get("/payments/:id", async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }
        res.json({ success: true, data: payment });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET PAYMENT BY ORDER ID
app.get("/payments/order/:order_id", async (req, res) => {
    try {
        const payment = await Payment.findOne({ order_id: req.params.order_id });
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found for this order" });
        }
        res.json({ success: true, data: payment });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE PAYMENT STATUS
app.put("/payments/:id", async (req, res) => {
    try {
        const updateData = { payment_status: req.body.payment_status };
        
        // If completing payment, generate transaction ID if not exists
        if (req.body.payment_status === 'completed') {
            const payment = await Payment.findById(req.params.id);
            if (!payment.transaction_id) {
                updateData.transaction_id = `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            }
        }
        
        // If marking as failed, record reason
        if (req.body.payment_status === 'failed' && req.body.failure_reason) {
            updateData.failure_reason = req.body.failure_reason;
        }

        const updated = await Payment.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        res.json({ success: true, message: "Payment status updated", data: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PROCESS REFUND
app.post("/payments/:id/refund", async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        if (payment.payment_status !== 'completed') {
            return res.status(400).json({ 
                success: false, 
                error: "Can only refund completed payments" 
            });
        }

        const { refund_amount, reason } = req.body;
        const totalAmount = parseFloat(payment.amount.toString());
        const refundAmt = refund_amount ? parseFloat(refund_amount) : totalAmount;

        if (refundAmt > totalAmount) {
            return res.status(400).json({ 
                success: false, 
                error: "Refund amount cannot exceed payment amount" 
            });
        }

        // Process refund
        payment.refund_amount = mongoose.Types.Decimal128.fromString(refundAmt.toFixed(2));
        payment.refund_date = new Date();
        payment.refund_reason = reason || 'Customer requested refund';
        payment.refund_transaction_id = `RFN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        
        if (refundAmt === totalAmount) {
            payment.payment_status = 'refunded';
        } else {
            payment.payment_status = 'partially_refunded';
        }

        await payment.save();

        res.json({ 
            success: true, 
            message: "Refund processed successfully", 
            data: payment 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE PAYMENT
app.delete("/payments/:id", async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        // Don't allow deletion of completed payments
        if (payment.payment_status === 'completed') {
            return res.status(400).json({ 
                success: false, 
                error: "Cannot delete completed payments. Use refund instead." 
            });
        }

        await Payment.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Payment deleted" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========== STATISTICS ==========

// Get payment statistics
app.get("/payments/stats/summary", async (req, res) => {
    try {
        const { user_id, from_date, to_date } = req.query;
        let filter = {};
        
        if (user_id) filter.user_id = user_id;
        
        if (from_date || to_date) {
            filter.payment_date = {};
            if (from_date) filter.payment_date.$gte = new Date(from_date);
            if (to_date) filter.payment_date.$lte = new Date(to_date);
        }

        const totalPayments = await Payment.countDocuments(filter);
        const completedPayments = await Payment.countDocuments({ ...filter, payment_status: 'completed' });
        const failedPayments = await Payment.countDocuments({ ...filter, payment_status: 'failed' });
        const refundedPayments = await Payment.countDocuments({ 
            ...filter, 
            payment_status: { $in: ['refunded', 'partially_refunded'] } 
        });

        const allPayments = await Payment.find({ ...filter, payment_status: 'completed' });
        const totalRevenue = allPayments.reduce((sum, payment) => {
            const amount = decimalToNumber(payment.amount, 0);
            const refund = decimalToNumber(payment.refund_amount, 0);
            return sum + (amount - refund);
        }, 0);

        // Payment method breakdown
        const paymentMethods = await Payment.aggregate([
            { $match: { ...filter, payment_status: 'completed' } },
            { $group: { _id: "$payment_method", count: { $sum: 1 } } }
        ]);

        res.json({ 
            success: true, 
            data: {
                total_payments: totalPayments,
                completed_payments: completedPayments,
                failed_payments: failedPayments,
                refunded_payments: refundedPayments,
                success_rate: totalPayments > 0 ? ((completedPayments / totalPayments) * 100).toFixed(2) + '%' : '0%',
                total_revenue: totalRevenue.toFixed(2),
                payment_methods: paymentMethods
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify payment status
app.get("/payments/:id/verify", async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        res.json({ 
            success: true,
            data: {
                payment_id: payment._id,
                order_id: payment.order_id,
                status: payment.payment_status,
                transaction_id: payment.transaction_id,
                amount: payment.amount,
                is_verified: payment.payment_status === 'completed' && payment.transaction_id
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// START SERVER
app.listen(3003, () => {
    console.log("🚀 Payment service running on port 3003");
});
