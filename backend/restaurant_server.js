const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// CONNECT TO restaurant_db
mongoose.connect("mongodb://127.0.0.1:27017/restaurant_db")
.then(() => console.log("Connected to Restaurant DB"))
.catch(err => console.log(err));

// RESTAURANT SCHEMA (Updated with missing fields)
const restaurantSchema = new mongoose.Schema({
    restaurant_name: {
        type: String,
        required: true
    },
    owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    cuisine_type: String,
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    rating: {
        type: Number,
        min: 0,
        max: 5
    },
    is_open: {
        type: Boolean,
        default: true
    },
    opening_hours: {
        type: String
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// MODEL
const Restaurant = mongoose.model("Restaurant", restaurantSchema);

// MENU SCHEMA (Updated with missing fields)
const menuSchema = new mongoose.Schema({
    restaurant_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    item_name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    price: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
    },
    category: {
        type: String,
        enum: ['appetizer', 'main_course', 'dessert', 'beverage']
    },
    is_available: {
        type: Boolean,
        default: true
    },
    is_vegetarian: {
        type: Boolean,
        default: false
    },
    preparation_time: {
        type: Number
    }
});

const Menu = mongoose.model("Menu", menuSchema);

// REVIEWS SCHEMA
const reviewSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    restaurant_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: String,
    created_at: {
        type: Date,
        default: Date.now
    }
});

// review MODEL
const Review = mongoose.model("Review", reviewSchema);

// CREATE RESTAURANT
app.post("/restaurants", async (req, res) => {
    try {
        const newRestaurant = new Restaurant(req.body);
        await newRestaurant.save();
        res.json({ message: "Restaurant created", data: newRestaurant });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET ALL RESTAURANTS
app.get("/restaurants", async (req, res) => {
    try {
        const restaurants = await Restaurant.find();
        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE RESTAURANT (PUT /restaurant)
app.put("/restaurants/:id", async (req, res) => {
    try {
        const updated = await Restaurant.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        res.json({ message: "Restaurant updated", data: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /restaurant
app.delete("/restaurants/:id", async (req, res) => {
    try {
        const deleted = await Restaurant.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        res.json({ message: "Restaurant deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE MENU ITEM (POST/menu)
app.post("/menus", async (req, res) => {
    try {
        const menuData = {
            ...req.body,
            price: mongoose.Types.Decimal128.fromString(req.body.price.toString())
        };

        const newMenu = new Menu(menuData);
        await newMenu.save();
        res.json({ message: "Menu item created", data: newMenu });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET ALL MENU ITEMS (GET/menu)
app.get("/menus", async (req, res) => {
    try {
        const menus = await Menu.find();
        res.json(menus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE MENU (PUT /menu)
app.put("/menus/:id", async (req, res) => {
    try {
        const updateData = { ...req.body };

        if (req.body.price) {
            updateData.price = mongoose.Types.Decimal128.fromString(req.body.price);
        }

        const updated = await Menu.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Menu item not found" });
        }

        res.json({ message: "Menu updated", data: updated });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /menu
app.delete("/menus/:id", async (req, res) => {
    try {
        const deleted = await Menu.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: "Menu item not found" });
        }

        res.json({ message: "Menu deleted" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// POST /reviews
app.post("/reviews", async (req, res) => {
    try {
        const review = new Review(req.body);
        await review.save();
        res.json({ message: "Review added", data: review });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//GET /reviews
app.get("/reviews", async (req, res) => {
    try {
        const reviews = await Review.find();
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//UPDATE REVIEW (PUT /review)
app.put("/reviews/:id", async (req, res) => {
    try {
        const updated = await Review.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Review not found" });
        }

        res.json({ message: "Review updated", data: updated });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /review
app.delete("/reviews/:id", async (req, res) => {
    try {
        const deleted = await Review.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: "Review not found" });
        }

        res.json({ message: "Review deleted" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// START SERVER ON DIFFERENT PORT
app.listen(3001, () => {
    console.log("Restaurant service running on port 3001");
});